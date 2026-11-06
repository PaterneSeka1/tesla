import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addCalendarDays,
  addCalendarMonths,
  apiErrorSchema,
  availableEvaluationSchema,
  catalogPageSchema,
  civilDateAt,
  CSRF_HEADER,
  scoutPathwaySchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Rattrapages étape par étape et verrou des autres cours (D177). PostgreSQL réel, données fictives :
// référentiel fictif identique à la chronologie 2026.2 (21 jours par étape), en vigueur depuis 2000.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const today = civilDateAt(new Date());
const bornYearsAgo = (years: number) => addCalendarDays(addCalendarMonths(today, -12 * years), -10);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Rattrapages par étape et verrou des cours (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;
  let stages: Record<string, string>;

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
    stages = Object.fromEntries(
      (await prisma.progressionStage.findMany()).map((stage) => [stage.code, stage.id]),
    );
    const periods = {
      NOVICIAT: [18, 0, 18, 1],
      APPRENTISSAGE: [18, 1, 19, 0],
      COMPAGNONNAGE: [19, 0, 20, 0],
      DEPART_ROUTIER: [20, 0, 21, 0],
    } as const;
    const ruleSet = await prisma.ageRuleSet.create({
      data: {
        version: 'test-rattrapage',
        sourceReference: 'Référentiel fictif (tests).',
        branchExitAgeYears: 21,
        catchUpDelayDays: 21,
        stages: {
          create: Object.entries(periods).map(([code, [sy, sm, ey, em]]) => ({
            stageId: stages[code]!,
            startYears: sy,
            startMonths: sm,
            endYears: ey,
            endMonths: em,
            sourceReference: 'Fictif (tests).',
          })),
        },
      },
    });
    await prisma.ageRuleSet.update({
      where: { id: ruleSet.id },
      data: {
        status: 'EN_VIGUEUR',
        effectiveFrom: new Date('2000-01-01T00:00:00Z'),
        activatedAt: new Date(),
      },
    });
  });

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `rattrapage${counter}@example.test`,
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

  /** Module publié (contournement des écrans) ; obligatoire avec une source officielle fictive. */
  async function publishedModule(
    slug: string,
    options: { stageCode?: string; mandatory?: boolean; category?: 'ETAPE' | 'TRANSVERSAL' },
  ) {
    const module = await prisma.pedagogicalModule.create({ data: { slug } });
    const version = await prisma.moduleVersion.create({
      data: {
        moduleId: module.id,
        version: 1,
        title: `Module fictif ${slug}`,
        stageId: options.stageCode ? stages[options.stageCode] : null,
        category: options.category ?? 'ETAPE',
        obligation: options.mandatory ? 'OBLIGATOIRE' : 'FACULTATIF',
        officialSource: options.mandatory ? 'Source officielle fictive (tests)' : null,
      },
    });
    for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
      await prisma.moduleVersion.update({
        where: { id: version.id },
        data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
      });
    }
    await prisma.pedagogicalModule.update({
      where: { id: module.id },
      data: { publishedVersionId: version.id },
    });
    return module;
  }

  async function publishedEvaluation(moduleId: string, stageCode: string) {
    const evaluation = await prisma.evaluation.create({
      data: { title: `Quiz fictif ${stageCode}`, stageId: stages[stageCode]!, moduleId },
    });
    const version = await prisma.evaluationVersion.create({
      data: { evaluationId: evaluation.id, version: 1, title: `Quiz fictif ${stageCode}` },
    });
    for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const)
      await prisma.evaluationVersion.update({
        where: { id: version.id },
        data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
      });
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { publishedVersionId: version.id },
    });
    return evaluation;
  }

  it('arrivée à 20 ans : étapes rattrapées dans l’ordre, 21 jours chacune, autres cours fermés', async () => {
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    const assistant = await login('ENCADREMENT');
    for (const [userId, fn] of [
      [plein.user.id, 'PLEIN'],
      [assistant.user.id, 'ASSISTANT'],
    ] as const) {
      await admin
        .post('/leadership/assignments', { userId, function: fn, confirmReplacement: true })
        .expect(201);
    }
    const n = await publishedModule('rattrapage-noviciat', {
      stageCode: 'NOVICIAT',
      mandatory: true,
    });
    const a = await publishedModule('rattrapage-apprentissage', {
      stageCode: 'APPRENTISSAGE',
      mandatory: true,
    });
    const c = await publishedModule('rattrapage-compagnonnage', {
      stageCode: 'COMPAGNONNAGE',
      mandatory: true,
    });
    const d = await publishedModule('preparation-depart', { stageCode: 'DEPART_ROUTIER' });
    await publishedModule('transversal', { category: 'TRANSVERSAL' });
    const evalN = await publishedEvaluation(n.id, 'NOVICIAT');
    const evalA = await publishedEvaluation(a.id, 'APPRENTISSAGE');
    const evalD = await publishedEvaluation(d.id, 'DEPART_ROUTIER');

    const routier = await login('ROUTIER');
    const profile = await prisma.scoutProfile.create({
      data: {
        userId: routier.user.id,
        firstName: 'Fictif',
        lastName: 'Arrivant',
        birthDate: new Date(`${bornYearsAgo(20)}T00:00:00Z`),
        joinedAt: new Date(`${today}T00:00:00Z`),
      },
    });

    // 1. Étape normale (aucune rétrogradation) ; échéances enchaînées de 21 jours par étape.
    const pathway = await json(routier.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(pathway.stage?.code).toBe('DEPART_ROUTIER');
    const dueBy = Object.fromEntries(pathway.catchUps.map((o) => [o.originStage.code, o.dueOn]));
    expect(dueBy).toEqual({
      NOVICIAT: addCalendarDays(today, 20),
      APPRENTISSAGE: addCalendarDays(today, 41),
      COMPAGNONNAGE: addCalendarDays(today, 62),
    });
    expect(pathway.catchUpLock).toMatchObject({
      active: true,
      stage: { code: 'NOVICIAT' },
      dueOn: addCalendarDays(today, 20),
      allowedModuleIds: [n.id],
    });
    expect(pathway.catchUps.every((o) => o.blocking)).toBe(true);
    expect(pathway.stageModules.find((m) => m.id === d.id)?.locked).toBe(true);
    // Idempotence : relecture sans doublon ni échéance réécrite.
    await routier.get('/me/pathway').expect(200);
    expect(await prisma.catchUpObligation.count()).toBe(3);

    // 2. Catalogue : seul le module de l'étape en cours de rattrapage est ouvert.
    const catalog = await json(routier.get('/modules?pageSize=50'), 200, catalogPageSchema);
    const lockedBySlug = Object.fromEntries(catalog.items.map((m) => [m.slug, m.locked]));
    expect(lockedBySlug).toEqual({
      'rattrapage-noviciat': false,
      'rattrapage-apprentissage': true,
      'rattrapage-compagnonnage': true,
      'preparation-depart': true,
      transversal: true,
    });
    await routier.get('/modules/rattrapage-noviciat').expect(200);
    for (const slug of ['preparation-depart', 'transversal', 'rattrapage-apprentissage']) {
      expect(await errorCode(routier.get(`/modules/${slug}`), 403)).toBe('CATCH_UP_LOCKED');
      expect(await errorCode(routier.get(`/modules/${slug}/print`), 403)).toBe('CATCH_UP_LOCKED');
    }
    // L'encadrement n'est jamais verrouillé.
    await assistant.get('/modules/preparation-depart').expect(200);

    // 3. Évaluations : rattrapage en cours ouvert, le reste fermé (en ligne comme pour le papier).
    const eligibility = async () =>
      Object.fromEntries(
        (
          await json(
            plein.get(`/evaluations?scoutProfileId=${profile.id}`),
            200,
            z.object({ items: z.array(availableEvaluationSchema) }),
          )
        ).items.map((item) => [item.id, item.eligibility?.status]),
      );
    expect(await eligibility()).toEqual({
      [evalN.id]: 'ELIGIBLE_RATTRAPAGE',
      [evalA.id]: 'VERROUILLE_RATTRAPAGE',
      [evalD.id]: 'VERROUILLE_RATTRAPAGE',
    });
    expect(
      await errorCode(
        plein.post('/paper-attempts', { scoutProfileId: profile.id, evaluationId: evalD.id }),
        403,
      ),
    ).toBe('EVALUATION_NOT_ELIGIBLE');

    // 4. Études : seul un module ouvert peut être déclaré.
    expect(await errorCode(routier.post('/me/module-studies', { moduleId: d.id }), 403)).toBe(
      'CATCH_UP_LOCKED',
    );
    await routier.post('/me/module-studies', { moduleId: n.id }).expect(201);

    // 5. Dérogation du responsable : rouvre une évaluation précise.
    await prisma.evaluationWaiver.create({
      data: {
        scoutProfileId: profile.id,
        evaluationId: evalD.id,
        reason: 'Dérogation fictive (tests).',
        grantedById: plein.user.id,
      },
    });
    expect((await eligibility())[evalD.id]).toBe('ELIGIBLE_DEROGATION');

    // 6. Noviciat reconnu acquis : on passe à l'apprentissage, toujours dans l'ordre.
    const obligationOf = async (moduleId: string) =>
      (await prisma.catchUpObligation.findFirstOrThrow({ where: { moduleId } })).id;
    const decide = async (moduleId: string) =>
      plein
        .post(`/catch-ups/${await obligationOf(moduleId)}/decision`, {
          decision: 'ACQUIS',
          reason: 'Acquis fictif (tests).',
          confirm: true,
        })
        .expect(201);
    await decide(n.id);
    let next = await json(routier.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(next.catchUpLock.stage?.code).toBe('APPRENTISSAGE');
    expect([...next.catchUpLock.allowedModuleIds].sort()).toEqual([n.id, a.id].sort());
    expect((await eligibility())[evalA.id]).toBe('ELIGIBLE_RATTRAPAGE');

    // 7. Tous les rattrapages traités : plus aucun verrou, la préparation au Départ s'ouvre.
    await decide(a.id);
    await decide(c.id);
    next = await json(routier.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(next.catchUpLock.active).toBe(false);
    expect(next.stageModules.find((m) => m.id === d.id)?.locked).toBe(false);
    await routier.get('/modules/transversal').expect(200);
    expect((await eligibility())[evalD.id]).toMatch(/^ELIGIBLE/);
    // Rien n'est effacé.
    expect(await prisma.catchUpObligation.count()).toBe(3);
  });
});
