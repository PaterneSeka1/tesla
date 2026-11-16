import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  availableEvaluationSchema,
  CSRF_HEADER,
  myProfileSchema,
  paginatedSchema,
  scoutDetailSchema,
  scoutListItemSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { diagnoseStages } from '../src/modules/progression/stage-diagnosis.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  birthDateIsoForStage,
  createTestPrisma,
  installTestAgeRules,
  resetDatabase,
  testDatabaseUrl,
} from './int-database.js';

// Apprenants adultes (D185) : ni routiers ni encadrement. PostgreSQL réel, données fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const scoutPageSchema = paginatedSchema(scoutListItemSchema);
const availableEvaluationPageSchema = paginatedSchema(availableEvaluationSchema);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Apprenants adultes (D185, intégration PostgreSQL)', () => {
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
    await installTestAgeRules(prisma);
    stages = Object.fromEntries(
      (await prisma.progressionStage.findMany()).map((stage) => [stage.code, stage.id]),
    );
  });

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER' | 'ADULTE') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `adulte${counter}@example.test`,
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
      patch: (path: string, body: object = {}) =>
        agent.patch(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }

  async function plein() {
    const admin = await login('ADMINISTRATEUR');
    const responsable = await login('ENCADREMENT');
    await admin
      .post('/leadership/assignments', {
        userId: responsable.user.id,
        function: 'PLEIN',
        confirmReplacement: true,
      })
      .expect(201);
    return { admin, responsable };
  }

  async function publishedEvaluation(stageCode: string) {
    const evaluation = await prisma.evaluation.create({
      data: { title: `Quiz fictif ${stageCode}`, stageId: stages[stageCode]! },
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

  it('inscription par le plein ou l’administrateur ; liste séparée ; jamais « à régulariser »', async () => {
    const { admin, responsable } = await plein();
    const adult = await json(
      responsable.post('/scouts/adults', { firstName: 'Awa', lastName: 'Fictive', sex: 'FILLE' }),
      201,
      scoutDetailSchema,
    );
    expect(adult).toMatchObject({
      kind: 'ADULTE',
      stage: null,
      stageReason: 'ADULTE',
      team: null,
      birthDate: null,
      sex: 'FILLE',
    });
    await admin
      .post('/scouts/adults', { firstName: 'Koffi', lastName: 'Fictif', sex: 'GARCON' })
      .expect(201);
    // Sexe obligatoire ; un membre de l'encadrement sans fonction n'inscrit personne.
    await responsable.post('/scouts/adults', { firstName: 'X', lastName: 'Y' }).expect(400);
    const assistant = await login('ENCADREMENT');
    expect(
      await errorCode(
        assistant.post('/scouts/adults', { firstName: 'X', lastName: 'Y', sex: 'FILLE' }),
        403,
      ),
    ).toBe('FORBIDDEN');

    // Routier : liste habituelle sans adulte ; liste des adultes à part.
    await responsable
      .post('/scouts', {
        firstName: 'Routier',
        lastName: 'Fictif',
        sex: 'GARCON',
        birthDate: await birthDateIsoForStage(prisma, 'COMPAGNONNAGE'),
      })
      .expect(201);
    const routiers = await json(responsable.get('/scouts'), 200, scoutPageSchema);
    expect(routiers.items.map((item) => item.kind)).toEqual(['ROUTIER']);
    const adults = await json(responsable.get('/scouts?kind=ADULTE'), 200, scoutPageSchema);
    expect(adults.total).toBe(2);
    // Diagnostic des étapes (D181) : aucun adulte signalé.
    const report = await diagnoseStages(prisma);
    expect(report.activeProfiles).toBe(1);
    expect(report.rows.map((row) => row.scoutProfileId)).not.toContain(adult.id);
  });

  it('identité seulement : ni date, ni matricule, ni équipe, ni donnée de la Route', async () => {
    const { responsable } = await plein();
    const adult = await json(
      responsable.post('/scouts/adults', { firstName: 'Awa', lastName: 'Fictive', sex: 'FILLE' }),
      201,
      scoutDetailSchema,
    );
    for (const body of [
      { birthDate: '1980-01-01' },
      { joinedAt: '2026-09-01' },
      { matricule: '0000001A' },
    ]) {
      expect(await errorCode(responsable.patch(`/scouts/${adult.id}`, body), 422)).toBe(
        'ADULT_NOT_IN_ROUTE',
      );
    }
    // Correction d'identité : motivée et journalisée, comme pour un routier (D173).
    await responsable
      .patch(`/scouts/${adult.id}`, {
        lastName: 'Fictive-Corrigée',
        reason: 'Erreur de saisie fictive',
        confirmCorrection: true,
      })
      .expect(200);

    const team = await prisma.team.create({ data: { name: 'Équipe fictive' } });
    expect(
      await errorCode(
        responsable.post(`/scouts/${adult.id}/teams/assign`, { teamId: team.id }),
        422,
      ),
    ).toBe('ADULT_NOT_IN_ROUTE');
    expect(
      await errorCode(
        responsable.post(`/scouts/${adult.id}/observations`, {
          observedOn: '2026-11-01',
          content: 'Observation fictive',
        }),
        422,
      ),
    ).toBe('ADULT_NOT_IN_ROUTE');
    const evaluation = await publishedEvaluation('NOVICIAT');
    expect(
      await errorCode(
        responsable.post('/admin/waivers', {
          scoutProfileId: adult.id,
          evaluationId: evaluation.id,
          reason: 'Motif fictif de test',
        }),
        422,
      ),
    ).toBe('ADULT_NOT_IN_ROUTE');

    // Garde-fous SQL : contrainte des champs, type immuable, tables de la Route.
    await expect(
      prisma.scoutProfile.update({
        where: { id: adult.id },
        data: { birthDate: new Date('1980-01-01T00:00:00Z') },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.scoutProfile.update({ where: { id: adult.id }, data: { kind: 'ROUTIER' } }),
    ).rejects.toThrow();
    await expect(
      prisma.teamAssignment.create({
        data: { scoutProfileId: adult.id, teamId: team.id, startedAt: new Date() },
      }),
    ).rejects.toThrow();
    expect(await prisma.teamAssignment.count()).toBe(0);
  });

  it('compte adulte : rattaché à une fiche adulte seulement ; cours, évaluations et résultats', async () => {
    const { responsable } = await plein();
    const adult = await json(
      responsable.post('/scouts/adults', { firstName: 'Awa', lastName: 'Fictive', sex: 'FILLE' }),
      201,
      scoutDetailSchema,
    );
    // Compte et fiche du même type (D185).
    expect(
      await errorCode(
        responsable.post('/users', {
          email: 'mauvais-type@example.test',
          firstName: 'Awa',
          lastName: 'Fictive',
          role: 'ROUTIER',
          scoutProfileId: adult.id,
        }),
        409,
      ),
    ).toBe('PROFILE_KIND_MISMATCH');
    await responsable
      .post('/users', {
        email: 'adulte-cree@example.test',
        firstName: 'Awa',
        lastName: 'Fictive',
        role: 'ADULTE',
        scoutProfileId: adult.id,
      })
      .expect(201);
    expect(
      (await prisma.scoutProfile.findUniqueOrThrow({ where: { id: adult.id } })).userId,
    ).not.toBeNull();

    // Apprenant adulte connecté (compte fictif rattaché directement à une seconde fiche adulte).
    const learner = await login('ADULTE');
    await prisma.scoutProfile.create({
      data: { kind: 'ADULTE', userId: learner.user.id, firstName: 'Koffi', lastName: 'Fictif' },
    });
    const noviciat = await publishedEvaluation('NOVICIAT');
    const depart = await publishedEvaluation('DEPART_ROUTIER');
    const page = await json(learner.get('/evaluations'), 200, availableEvaluationPageSchema);
    // Toute évaluation publiée, quelle que soit son étape.
    expect(
      Object.fromEntries(page.items.map((item) => [item.id, item.eligibility?.status])),
    ).toEqual({ [noviciat.id]: 'ELIGIBLE', [depart.id]: 'ELIGIBLE' });
    // Démarrage idempotent (200) : la tentative est créée sur la fiche adulte.
    await learner.post(`/evaluations/${depart.id}/attempts`).expect(200);
    expect(await prisma.evaluationAttempt.count({ where: { evaluationId: depart.id } })).toBe(1);
    await learner.get('/me/attempts').expect(200);
    // Rien de la Route : ni parcours, ni progression, ni tableau de bord personnel.
    for (const path of ['/me/pathway', '/me/progression', '/me/dashboard']) {
      await learner.get(path).expect(403);
    }
    const profile = await json(learner.get('/auth/profile'), 200, myProfileSchema);
    expect(profile.scout).toBeNull();
  });
});
