import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ageRuleSetListSchema,
  ageRuleSetSchema,
  apiErrorSchema,
  CSRF_HEADER,
  leadershipAssignmentSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Saisie du référentiel d'âge depuis l'interface : décision officielle du plein en fonction,
// revérifiée à l'écriture (D173), périodes cohérentes, mise en vigueur explicite et définitive.
// PostgreSQL réel (base « _test »), valeurs fictives (aucune règle pédagogique réelle).
const PASSWORD = 'mot-de-passe-fictif-de-test';

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

const ruleSet = (version: string, stages: object[] = []) => ({
  version,
  sourceReference: 'Source fictive de test',
  notes: null,
  branchExitAgeYears: 21,
  catchUpDelayMonths: null,
  exitAlertMonths: null,
  stages,
});

const period = (stageCode: string, start: number, end: number | null) => ({
  stageCode,
  start: { years: start, months: 0 },
  end: end === null ? null : { years: end, months: 0 },
  sourceReference: 'Source fictive de test',
});

describe('Référentiel d’âge : saisie et mise en vigueur (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
    passwordHash = await hashPassword(PASSWORD);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(
      app,
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl(), SWAGGER_ENABLED: 'false' }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `referentiel${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        passwordHash,
      },
    });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof login>>;

  const designate = (admin: Client, userId: string, fn: 'PLEIN' | 'ASSISTANT') =>
    json(
      admin.post('/leadership/assignments', { userId, function: fn, confirmReplacement: true }),
      201,
      leadershipAssignmentSchema,
    );

  it('le plein crée un brouillon cohérent puis le met en vigueur ; il devient immuable', async () => {
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    await designate(admin, plein.user.id, 'PLEIN');

    const draft = await json(
      plein.post(
        '/age-rules',
        ruleSet('fictif-ui-1', [period('NOVICIAT', 18, 19), period('APPRENTISSAGE', 19, null)]),
      ),
      201,
      ageRuleSetSchema,
    );
    expect(draft.status).toBe('BROUILLON');
    expect(draft.stages.map((rule) => rule.stageCode)).toEqual(['NOVICIAT', 'APPRENTISSAGE']);

    expect(
      await errorCode(
        plein.post(`/age-rules/${draft.id}/activate`, { effectiveFrom: '2031-01-01' }),
        400,
      ),
    ).toBe('VALIDATION_ERROR');
    const active = await json(
      plein.post(`/age-rules/${draft.id}/activate`, { effectiveFrom: '2031-01-01', confirm: true }),
      201,
      ageRuleSetSchema,
    );
    expect(active.status).toBe('EN_VIGUEUR');
    expect(
      await errorCode(
        plein.post(`/age-rules/${draft.id}/activate`, {
          effectiveFrom: '2031-02-01',
          confirm: true,
        }),
        409,
      ),
    ).toBe('RULE_SET_NOT_DRAFT');

    const list = await json(plein.get('/age-rules'), 200, ageRuleSetListSchema);
    expect(list.items.some((item) => item.version === 'fictif-ui-1')).toBe(true);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: draft.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((entry) => entry.action)).toEqual(['ageRules.created', 'ageRules.activated']);
  });

  it('périodes incohérentes refusées : chevauchement, fin avant début, doublon, après la sortie', async () => {
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    await designate(admin, plein.user.id, 'PLEIN');
    const invalid = [
      [period('NOVICIAT', 18, 20), period('APPRENTISSAGE', 19, null)],
      [period('NOVICIAT', 19, 18)],
      [period('NOVICIAT', 18, 19), period('NOVICIAT', 19, 20)],
      [period('NOVICIAT', 22, null)],
    ];
    for (const [index, stages] of invalid.entries()) {
      expect(
        await errorCode(plein.post('/age-rules', ruleSet(`invalide-${index}`, stages)), 400),
      ).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.ageRuleSet.count({ where: { version: { startsWith: 'invalide-' } } })).toBe(
      0,
    );
  });

  it('assistant, administrateur et plein remplacé : refus, rien n’est écrit', async () => {
    const admin = await login('ADMINISTRATEUR');
    const pleinA = await login('ENCADREMENT');
    const pleinB = await login('ENCADREMENT');
    const assistant = await login('ENCADREMENT');
    await designate(admin, pleinA.user.id, 'PLEIN');
    await designate(admin, assistant.user.id, 'ASSISTANT');
    const draft = await json(
      pleinA.post('/age-rules', ruleSet('fictif-ui-2', [period('NOVICIAT', 18, 19)])),
      201,
      ageRuleSetSchema,
    );

    for (const client of [assistant, admin]) {
      expect(await errorCode(client.post('/age-rules', ruleSet('refus')), 403)).toBe('FORBIDDEN');
    }
    // Remplacement : l'ancienne session de A ne peut plus ni créer ni mettre en vigueur.
    await designate(admin, pleinB.user.id, 'PLEIN');
    expect(await errorCode(pleinA.post('/age-rules', ruleSet('refus-2')), 403)).toBe('FORBIDDEN');
    expect(
      await errorCode(
        pleinA.post(`/age-rules/${draft.id}/activate`, {
          effectiveFrom: '2032-01-01',
          confirm: true,
        }),
        403,
      ),
    ).toBe('FORBIDDEN');
    expect((await prisma.ageRuleSet.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe(
      'BROUILLON',
    );
    expect(await prisma.ageRuleSet.count({ where: { version: { startsWith: 'refus' } } })).toBe(0);
  });
});
