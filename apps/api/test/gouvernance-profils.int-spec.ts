import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  birthDateImpactSchema,
  CSRF_HEADER,
  leadershipAssignmentSchema,
  myProfileSchema,
  scoutDetailSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  birthDateIsoForStage,
  createTestPrisma,
  resetDatabase,
  testDatabaseUrl,
} from './int-database.js';

// D173 : gouvernance des données administratives (administrateur, responsable plein en fonction),
// révocation immédiate du plein remplacé, opérations concurrentes, profils protégés et étape
// calculée. PostgreSQL réel (base « _test »), données fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Gouvernance des profils et progression automatique (D173, intégration PostgreSQL)', () => {
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

  async function login(role: 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `gouvernance${counter}@example.test`,
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
    const write = (method: 'post' | 'patch', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
    };
  }
  type Client = Awaited<ReturnType<typeof login>>;

  const designate = (admin: Client, userId: string, fn: 'PLEIN' | 'ADJOINT' | 'ASSISTANT') =>
    json(
      admin.post('/leadership/assignments', { userId, function: fn, confirmReplacement: true }),
      201,
      leadershipAssignmentSchema,
    );

  const scoutBody = (n: number, extra: object = {}) => ({
    firstName: 'Routier',
    lastName: `Fictif${n}`,
    ...extra,
  });

  async function community() {
    const admin = await login('ADMINISTRATEUR');
    const pleinA = await login('ENCADREMENT');
    const pleinB = await login('ENCADREMENT');
    const adjoint = await login('ENCADREMENT');
    const assistant = await login('ENCADREMENT');
    await designate(admin, pleinA.user.id, 'PLEIN');
    await designate(admin, adjoint.user.id, 'ADJOINT');
    await designate(admin, assistant.user.id, 'ASSISTANT');
    return { admin, pleinA, pleinB, adjoint, assistant };
  }

  it('1–9, 11. le plein en fonction gère les routiers ; remplacé, il perd ces droits immédiatement ; reconduit, il les retrouve', async () => {
    const { admin, pleinA, pleinB, adjoint, assistant } = await community();
    // 1–3. Droits actifs dès la désignation.
    const scout = await json(pleinA.post('/scouts', scoutBody(1)), 201, scoutDetailSchema);
    await pleinA.patch(`/scouts/${scout.id}`, { matricule: '0000001A' }).expect(200);
    // 11. Adjoint et assistant : jamais les droits du plein.
    for (const client of [adjoint, assistant]) {
      expect(await errorCode(client.post('/scouts', scoutBody(2)), 403)).toBe('FORBIDDEN');
      expect(
        await errorCode(client.patch(`/scouts/${scout.id}`, { joinedAt: '2026-09-05' }), 403),
      ).toBe('FORBIDDEN');
    }

    // 4. Remplacement : la session de A reste ouverte mais ses droits de plein disparaissent.
    await designate(admin, pleinB.user.id, 'PLEIN');
    // 5–8. Ancienne session, appel direct à l'API : refus.
    expect(await errorCode(pleinA.post('/scouts', scoutBody(3)), 403)).toBe('FORBIDDEN');
    expect(
      await errorCode(pleinA.patch(`/scouts/${scout.id}`, { joinedAt: '2026-09-05' }), 403),
    ).toBe('FORBIDDEN');
    await pleinA.get(`/scouts/${scout.id}`).expect(200); // consultation de l'encadrement conservée
    await pleinB.patch(`/scouts/${scout.id}`, { joinedAt: '2026-09-05' }).expect(200);

    // 9. Reconduction : nouvelle désignation, droits rétablis ; B perd les siens.
    await designate(admin, pleinA.user.id, 'PLEIN');
    await pleinA.post('/scouts', scoutBody(4)).expect(201);
    expect(await errorCode(pleinB.post('/scouts', scoutBody(5)), 403)).toBe('FORBIDDEN');
    // Historique des désignations conservé (trois désignations du plein, aucune suppression).
    expect(await prisma.leadershipAssignment.count({ where: { function: 'PLEIN' } })).toBe(3);
  });

  it('10. l’administrateur gère les routiers indépendamment de toute désignation du plein', async () => {
    const { admin, pleinA } = await community();
    const scout = await json(admin.post('/scouts', scoutBody(1)), 201, scoutDetailSchema);
    await prisma.leadershipAssignment.updateMany({
      where: { userId: pleinA.user.id, endedAt: null },
      data: { endedAt: new Date(), endReason: 'Fin fictive (tests)' },
    });
    await admin
      .patch(`/scouts/${scout.id}`, { birthDate: '2008-05-10', matricule: '0000042B' })
      .expect(200);
    // Le dossier pédagogique reste hors de portée de l'administrateur.
    expect(await errorCode(admin.get(`/scouts/${scout.id}/progression`), 403)).toBe('FORBIDDEN');
    expect(await errorCode(admin.get(`/scouts/${scout.id}/pedagogical-history`), 403)).toBe(
      'FORBIDDEN',
    );
  });

  it('12. une écriture du plein concurrente à son remplacement ne contourne pas la révocation', async () => {
    const { pleinA, pleinB } = await community();
    const scout = await json(pleinA.post('/scouts', scoutBody(1)), 201, scoutDetailSchema);
    let pending: Promise<request.Response> | undefined;
    // Remplacement en cours (verrou exclusif de la désignation) pendant que A envoie sa modification.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leadership_assignments'))`;
      pending = pleinA.patch(`/scouts/${scout.id}`, { joinedAt: '2026-09-05' }).then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await tx.leadershipAssignment.updateMany({
        where: { userId: pleinA.user.id, endedAt: null },
        data: { endedAt: new Date(), endReason: 'Remplacé (tests de concurrence)' },
      });
      await tx.leadershipAssignment.create({
        data: { userId: pleinB.user.id, function: 'PLEIN', reason: 'Remplacement fictif' },
      });
    });
    const response = await pending!;
    expect(response.status).toBe(403);
    const stored = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
    expect(stored.joinedAt).toBeNull();
  });

  it('administration des chefs : l’administrateur seul ; correction du nom motivée et journalisée', async () => {
    const { admin, pleinA, adjoint } = await community();
    // Le plein ne crée ni ne modifie un compte de l'encadrement.
    await pleinA
      .post('/users', {
        email: 'nouveau-chef@example.test',
        firstName: 'Chef',
        lastName: 'Fictif',
        role: 'ENCADREMENT',
      })
      .expect(403);
    await pleinA.patch(`/users/${adjoint.user.id}`, { lastName: 'Renommé' }).expect(404);
    // L'administrateur corrige, avec motif obligatoire.
    expect(
      await errorCode(admin.patch(`/users/${adjoint.user.id}`, { lastName: 'Corrigé' }), 422),
    ).toBe('CORRECTION_REASON_REQUIRED');
    await admin
      .patch(`/users/${adjoint.user.id}`, {
        lastName: 'Corrigé',
        reason: 'Orthographe fictive corrigée.',
      })
      .expect(200);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'account.updated', entityId: adjoint.user.id },
    });
    expect(audit.metadata).toMatchObject({
      reason: 'Orthographe fictive corrigée.',
      changes: [{ field: 'lastName', previous: adjoint.user.lastName, next: 'Corrigé' }],
    });
    // Un chef ne modifie pas ses propres données protégées depuis son profil.
    await adjoint.patch('/auth/profile', { lastName: 'Moi' }).expect(404);
    const profile = await json(adjoint.get('/auth/profile'), 200, myProfileSchema);
    expect(profile).toMatchObject({ lastName: 'Corrigé', leaderFunction: 'ADJOINT', scout: null });
  });

  it('profils protégés : pré-inscription incomplète, complétion, correction motivée, matricule unique', async () => {
    const { pleinA } = await community();
    // Pré-inscription sans date d'entrée ni de naissance : aucune valeur fictive.
    const scout = await json(pleinA.post('/scouts', scoutBody(1)), 201, scoutDetailSchema);
    expect(scout).toMatchObject({
      joinedAt: null,
      birthDate: null,
      matricule: null,
      stage: null,
      stageReason: 'DATE_NAISSANCE_MANQUANTE',
    });
    // Complétion : sans motif. Zéros initiaux conservés.
    await pleinA
      .patch(`/scouts/${scout.id}`, { matricule: '0000007c', joinedAt: '2026-09-05' })
      .expect(200);
    const completed = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'scout_profile.completed', entityId: scout.id },
    });
    expect(completed.metadata).toEqual({
      changes: [
        { field: 'matricule', next: '0000007C' },
        { field: 'joinedAt', next: '2026-09-05' },
      ],
    });
    // Correction : motif et confirmation.
    expect(
      await errorCode(pleinA.patch(`/scouts/${scout.id}`, { matricule: '0000008D' }), 422),
    ).toBe('CORRECTION_REASON_REQUIRED');
    // Matricule unique.
    const other = await json(pleinA.post('/scouts', scoutBody(2)), 201, scoutDetailSchema);
    expect(
      await errorCode(pleinA.patch(`/scouts/${other.id}`, { matricule: '0000007C' }), 409),
    ).toBe('MATRICULE_ALREADY_USED');
    // Dates incohérentes refusées.
    expect(
      await errorCode(
        pleinA.patch(`/scouts/${other.id}`, { birthDate: '2026-09-10', joinedAt: '2026-09-05' }),
        422,
      ),
    ).toBe('INVALID_DATE');
    expect(
      await errorCode(pleinA.post('/scouts', scoutBody(3, { joinedAt: '2999-01-01' })), 422),
    ).toBe('INVALID_DATE');
  });

  it('routier : ne modifie rien ; consulte un profil calculé identique à la fiche', async () => {
    const { pleinA } = await community();
    const routier = await login('ROUTIER');
    const birthDate = await birthDateIsoForStage(prisma, 'NOVICIAT');
    const scout = await json(
      pleinA.post('/scouts', scoutBody(1, { birthDate, joinedAt: '2026-09-05' })),
      201,
      scoutDetailSchema,
    );
    await pleinA
      .post(`/scouts/${scout.id}/link-account`, { email: routier.user.email })
      .expect(201);
    for (const body of [
      { birthDate: '2000-01-01' },
      { joinedAt: '2020-01-01' },
      { matricule: '0000009Z' },
    ]) {
      expect(await errorCode(routier.patch(`/scouts/${scout.id}`, body), 403)).toBe('FORBIDDEN');
    }
    await routier.patch('/auth/profile', { firstName: 'Moi' }).expect(404);
    const profile = await json(routier.get('/auth/profile'), 200, myProfileSchema);
    expect(profile.scout).toMatchObject({
      birthDate,
      joinedAt: '2026-09-05',
      stage: { code: 'NOVICIAT' },
      stageReason: 'REGLE',
      age: 18,
      catchUps: { open: 0, acquired: 0 },
    });
    expect(profile.scout?.seniority).not.toBeNull();
    // Même étape sur la fiche et sur le parcours : une seule vérité.
    const fiche = await json(pleinA.get(`/scouts/${scout.id}`), 200, scoutDetailSchema);
    expect(fiche.stage?.code).toBe('NOVICIAT');
  });

  it('aperçu d’une correction de la date de naissance : conséquences sans écriture', async () => {
    const { pleinA, assistant } = await community();
    const birthDate = await birthDateIsoForStage(prisma, 'NOVICIAT');
    const next = await birthDateIsoForStage(prisma, 'COMPAGNONNAGE');
    const scout = await json(
      pleinA.post('/scouts', scoutBody(1, { birthDate })),
      201,
      scoutDetailSchema,
    );
    const impact = await json(
      pleinA.get(`/scouts/${scout.id}/birth-date-impact?birthDate=${next}`),
      200,
      birthDateImpactSchema,
    );
    expect(impact.current.stage?.code).toBe('NOVICIAT');
    expect(impact.next.stage?.code).toBe('COMPAGNONNAGE');
    expect(impact.next.age).toBe(19);
    await assistant.get(`/scouts/${scout.id}/birth-date-impact?birthDate=${next}`).expect(403);
    const stored = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
    expect(stored.birthDate?.toISOString().slice(0, 10)).toBe(birthDate);
  });
});
