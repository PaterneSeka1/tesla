import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  activityDetailSchema,
  apiErrorSchema,
  attendanceSheetSchema,
  CSRF_HEADER,
  meResponseSchema,
  OPERATION_ID_HEADER,
  scoutDetailSchema,
  teamDetailSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { STALE_OPERATION_MS } from '../src/common/idempotency.interceptor.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestPrisma,
  grantPersona,
  personaRole,
  resetDatabase,
  type TestPersona,
  testDatabaseUrl,
} from './int-database.js';

const PASSWORD = 'mot-de-passe-fictif-de-test';
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}
const errorCode = async (req: SupertestRequest, status: number) =>
  (await json(req, status, apiErrorSchema)).code;

/** File de synchronisation des appareils : idempotence, conflits, permissions (D110). */
describe('Synchronisation différée des écritures (intégration PostgreSQL)', () => {
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
    await prisma.$executeRawUnsafe('TRUNCATE client_operations');
    await resetDatabase(prisma);
  });

  async function loginAs(persona: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `sync${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${persona} ${counter}`,
        role: personaRole(persona),
        passwordHash,
      },
    });
    await grantPersona(prisma, user.id, persona);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const write =
      (method: 'post' | 'patch' | 'put') => (path: string, body: object, operationId?: string) => {
        const req = agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1');
        return (operationId ? req.set(OPERATION_ID_HEADER, operationId) : req).send(body);
      };
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: write('post'),
      patch: write('patch'),
      put: write('put'),
    };
  }
  type Client = Awaited<ReturnType<typeof loginAs>>;

  const scoutInput = (lastName: string) => ({
    lastName,
    firstName: 'Routier',
    joinedAt: daysFromToday(-30),
  });
  const createScout = (client: Client, lastName: string) =>
    json(client.post('/scouts', scoutInput(lastName)), 201, scoutDetailSchema);

  it('rejoue une création sans doublon et refuse un identifiant réutilisé', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const operationId = crypto.randomUUID();
    const first = await json(
      responsable.post('/scouts', scoutInput('Rejoué'), operationId),
      201,
      scoutDetailSchema,
    );
    // Second envoi identique (réponse perdue côté appareil) : même réponse, aucun nouvel effet.
    const replay = await json(
      responsable.post('/scouts', scoutInput('Rejoué'), operationId),
      201,
      scoutDetailSchema,
    );
    expect(replay.id).toBe(first.id);
    expect(await prisma.scoutProfile.count({ where: { lastName: 'Rejoué' } })).toBe(1);

    expect(
      await errorCode(responsable.post('/scouts', scoutInput('Autre'), operationId), 409),
    ).toBe('OPERATION_ID_REUSED');
    const other = await loginAs('RESPONSABLE');
    expect(await errorCode(other.post('/scouts', scoutInput('Rejoué'), operationId), 409)).toBe(
      'OPERATION_ID_REUSED',
    );
    expect(await errorCode(responsable.post('/scouts', scoutInput('X'), 'pas-un-uuid'), 400)).toBe(
      'INVALID_OPERATION_ID',
    );
  });

  it('libère l’identifiant après un refus et revérifie les permissions à la réception', async () => {
    const chef = await loginAs('CHEF');
    const operationId = crypto.randomUUID();
    // Chef sans mandat : la création de fiche est une décision officielle, refusée au rejeu.
    await chef.post('/scouts', scoutInput('Refusé'), operationId).expect(403);
    expect(await prisma.clientOperation.count()).toBe(0);
    expect(await prisma.scoutProfile.count()).toBe(0);

    const responsable = await loginAs('RESPONSABLE');
    const retried = crypto.randomUUID();
    await responsable.post('/scouts', { lastName: '' }, retried).expect(400);
    await json(responsable.post('/scouts', scoutInput('Corrigé'), retried), 201, scoutDetailSchema);
  });

  it('signale une réception non confirmée plutôt que de rejouer à l’aveugle', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const operationId = crypto.randomUUID();
    const path = '/api/v1/scouts';
    const { createHash } = await import('node:crypto');
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(scoutInput('Incertain')))
      .digest('hex');
    await prisma.clientOperation.create({
      data: { id: operationId, userId: responsable.user.id, method: 'POST', path, bodyHash },
    });
    expect(
      await errorCode(responsable.post('/scouts', scoutInput('Incertain'), operationId), 409),
    ).toBe('OPERATION_IN_PROGRESS');
    await prisma.clientOperation.update({
      where: { id: operationId },
      data: { createdAt: new Date(Date.now() - STALE_OPERATION_MS - 1000) },
    });
    expect(
      await errorCode(responsable.post('/scouts', scoutInput('Incertain'), operationId), 409),
    ).toBe('OPERATION_UNCONFIRMED');
    expect(await prisma.scoutProfile.count()).toBe(0);
  });

  it('détecte les conflits de présence au lieu d’écraser', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const [a, b] = [
      await createScout(responsable, 'Alpha'),
      await createScout(responsable, 'Beta'),
    ];
    const activity = await json(
      chef.post('/activities', { title: 'Sortie', plannedOn: daysFromToday(-1) }),
      201,
      activityDetailSchema,
    );
    const sheet = `/activities/${activity.id}/attendance`;
    await json(
      responsable.put(sheet, { entries: [{ scoutProfileId: a.id, status: 'PRESENT' }] }),
      200,
      attendanceSheetSchema,
    );
    // Saisie faite hors connexion avant celle du responsable : « Non renseigné » vu à la saisie.
    expect(
      await errorCode(
        chef.put(
          sheet,
          {
            entries: [{ scoutProfileId: a.id, status: 'ABSENT', expectedStatus: 'NON_RENSEIGNE' }],
          },
          crypto.randomUUID(),
        ),
        409,
      ),
    ).toBe('ATTENDANCE_CHANGED');
    // Même statut que l'autre saisie, ou référence à jour : accepté.
    const saved = await json(
      chef.put(
        sheet,
        {
          entries: [
            { scoutProfileId: a.id, status: 'PRESENT', expectedStatus: 'NON_RENSEIGNE' },
            { scoutProfileId: b.id, status: 'EXCUSE', expectedStatus: 'NON_RENSEIGNE' },
          ],
        },
        crypto.randomUUID(),
      ),
      200,
      attendanceSheetSchema,
    );
    expect(saved.entries.find((e) => e.scout.id === b.id)?.status).toBe('EXCUSE');
  });

  it('détecte une fiche ou une équipe modifiée entre-temps', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const scout = await createScout(responsable, 'Gamma');
    await json(
      responsable.patch(`/scouts/${scout.id}`, { firstName: 'Modifié' }),
      200,
      scoutDetailSchema,
    );
    expect(
      await errorCode(
        responsable.patch(`/scouts/${scout.id}`, {
          lastName: 'Hors ligne',
          expectedUpdatedAt: scout.updatedAt,
        }),
        409,
      ),
    ).toBe('SCOUT_PROFILE_CHANGED');

    const [red, blue] = [
      await json(responsable.post('/teams', { name: 'Rouge' }), 201, teamDetailSchema),
      await json(responsable.post('/teams', { name: 'Bleue' }), 201, teamDetailSchema),
    ];
    await responsable.post(`/scouts/${scout.id}/teams/assign`, { teamId: red.id }).expect(201);
    // Appareil resté sur « sans équipe » : le changement vers Bleue est signalé, pas appliqué.
    expect(
      await errorCode(
        responsable.post(`/scouts/${scout.id}/teams/assign`, {
          teamId: blue.id,
          expectedTeamId: null,
        }),
        409,
      ),
    ).toBe('TEAM_ASSIGNMENT_CHANGED');
    await responsable
      .post(`/scouts/${scout.id}/teams/assign`, { teamId: blue.id, expectedTeamId: red.id })
      .expect(201);
  });

  it('au retour du réseau, une décision préparée par un ancien plein est refusée', async () => {
    const former = await loginAs('RESPONSABLE');
    const scout = await createScout(former, 'Delta');
    const before = await json(former.get('/auth/me'), 200, meResponseSchema);
    expect(before.user.permissions).toContain('scout.setActive');
    // Remplacement pendant que l'appareil de l'ancien plein était hors ligne.
    await loginAs('RESPONSABLE');
    const after = await json(former.get('/auth/me'), 200, meResponseSchema);
    expect(after.user.leaderFunction).toBeNull();
    expect(after.user.permissions).not.toContain('scout.setActive');
    expect(after.user.permissions).toContain('scout.read');
    // Opération mise en file avant le changement, rejouée au retour du réseau : refusée, sans effet.
    expect(
      await errorCode(
        former.patch(
          `/scouts/${scout.id}`,
          { lastName: 'Hors ligne', expectedUpdatedAt: scout.updatedAt },
          crypto.randomUUID(),
        ),
        403,
      ),
    ).toBe('FORBIDDEN');
    expect(
      (await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } })).lastName,
    ).toBe('Delta');
  });
});
