import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addCalendarDays,
  addCalendarMonths,
  apiErrorSchema,
  catalogPageSchema,
  civilDateAt,
  CSRF_HEADER,
  pathwayOverviewSchema,
  priorStageListSchema,
  priorStageRecognitionSchema,
  scoutDetailSchema,
  scoutPathwaySchema,
  stagePreviewSchema,
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
  createTestPrisma,
  installTestAgeRules,
  resetDatabase,
  testDatabaseUrl,
} from './int-database.js';

// D181 : un routier actif a toujours une étape déterminée ; parcours antérieur reconnu par le plein
// seul, historisé, révocable ; rattrapages des étapes reconnues levés sans acquis fabriqué ; lecture
// libre des cours publiés. PostgreSQL réel, données fictives, référentiel fictif des tests.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const today = civilDateAt(new Date());
/** Date de naissance plaçant aujourd'hui la personne à `years` ans + 10 jours. */
const bornYearsAgo = (years: number) => addCalendarDays(addCalendarMonths(today, -12 * years), -10);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Parcours officiel et parcours antérieur (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;
  let stages: Record<string, string> = {};

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

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `parcours${counter}@example.test`,
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

  async function community() {
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
    return { admin, plein, assistant };
  }

  const scout = (n: number, extra: object = {}) => ({
    firstName: 'Fictif',
    lastName: `Parcours ${n}`,
    birthDate: bornYearsAgo(19),
    ...extra,
  });

  async function mandatoryModule(slug: string, stageCode: string) {
    const module = await prisma.pedagogicalModule.create({ data: { slug } });
    const version = await prisma.moduleVersion.create({
      data: {
        moduleId: module.id,
        version: 1,
        title: `Module fictif ${slug}`,
        stageId: stages[stageCode]!,
        category: 'ETAPE',
        obligation: 'OBLIGATOIRE',
        officialSource: 'Source officielle fictive (tests)',
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

  it('scénario A : un nouveau routier n’est inscrit qu’avec une étape déterminée par l’API', async () => {
    const { plein, admin } = await community();
    // Aperçu calculé par le serveur, sans écriture.
    const preview = await json(
      plein.get(`/scouts/stage-preview?birthDate=${bornYearsAgo(19)}`),
      200,
      stagePreviewSchema,
    );
    expect(preview).toMatchObject({ stage: { code: 'COMPAGNONNAGE' }, issue: null });
    expect(preview.priorStages.map((stage) => stage.code)).toEqual(['NOVICIAT', 'APPRENTISSAGE']);
    const young = await json(
      plein.get(`/scouts/stage-preview?birthDate=${bornYearsAgo(17)}`),
      200,
      stagePreviewSchema,
    );
    expect(young).toMatchObject({ stage: null, issue: 'BELOW_ROUTE_AGE', priorStages: [] });
    expect(await prisma.scoutProfile.count()).toBe(0);

    // Création refusée sans date de naissance, trop jeune ou trop âgé : rien n'est écrit.
    await plein.post('/scouts', { firstName: 'Fictif', lastName: 'Sans date' }).expect(400);
    expect(
      await errorCode(plein.post('/scouts', scout(1, { birthDate: bornYearsAgo(17) })), 422),
    ).toBe('BELOW_ROUTE_AGE');
    expect(
      await errorCode(plein.post('/scouts', scout(1, { birthDate: bornYearsAgo(22) })), 422),
    ).toBe('ABOVE_ROUTE_AGE');
    expect(await prisma.scoutProfile.count()).toBe(0);

    // Création valide (administrateur comme plein) : étape visible immédiatement.
    for (const [n, client] of [plein, admin].entries()) {
      const created = await json(client.post('/scouts', scout(10 + n)), 201, scoutDetailSchema);
      expect(created.stage?.code).toBe('COMPAGNONNAGE');
    }

    // Une fiche active ne perd jamais sa date de naissance (API puis base de données).
    const [first] = await prisma.scoutProfile.findMany({ orderBy: { createdAt: 'asc' } });
    expect(
      await errorCode(
        plein.patch(`/scouts/${first!.id}`, {
          birthDate: null,
          reason: 'Tentative de retrait fictive.',
          confirmCorrection: true,
        }),
        422,
      ),
    ).toBe('BIRTH_DATE_REQUIRED');
    expect(
      await errorCode(
        plein.patch(`/scouts/${first!.id}`, {
          birthDate: bornYearsAgo(16),
          reason: 'Correction fictive trop jeune.',
          confirmCorrection: true,
        }),
        422,
      ),
    ).toBe('BELOW_ROUTE_AGE');
    await expect(
      prisma.scoutProfile.update({ where: { id: first!.id }, data: { birthDate: null } }),
    ).rejects.toThrow();
  });

  it('scénario B : un ancien routier intègre la plateforme avec son parcours reconnu', async () => {
    const { plein, admin, assistant } = await community();
    const nov = await mandatoryModule('rattrapage-noviciat', 'NOVICIAT');
    const app_ = await mandatoryModule('rattrapage-apprentissage', 'APPRENTISSAGE');

    // L'administrateur ne reconnaît pas un parcours (décision officielle du plein).
    const withPrior = scout(1, {
      priorStages: [{ stageId: stages.NOVICIAT, note: 'Investiture fictive.' }],
    });
    expect(await errorCode(admin.post('/scouts', withPrior), 403)).toBe('FORBIDDEN');
    // Une étape actuelle ou future ne se reconnaît pas ; rien n'est écrit.
    expect(
      await errorCode(
        plein.post('/scouts', scout(1, { priorStages: [{ stageId: stages.COMPAGNONNAGE }] })),
        422,
      ),
    ).toBe('NOT_PRIOR_STAGE');
    expect(await prisma.scoutProfile.count()).toBe(0);

    const created = await json(plein.post('/scouts', withPrior), 201, scoutDetailSchema);
    // Noviciat reconnu : aucun rattrapage du noviciat ; l'apprentissage, non reconnu, reste dû.
    let pathway = await json(
      assistant.get(`/scouts/${created.id}/pathway`),
      200,
      scoutPathwaySchema,
    );
    expect(pathway.stage?.code).toBe('COMPAGNONNAGE');
    expect(pathway.catchUps.map((o) => o.module.id)).toEqual([app_.id]);
    expect(pathway.timeline.map((s) => [s.stage.code, s.status])).toEqual([
      ['NOVICIAT', 'RECONNUE'],
      ['APPRENTISSAGE', 'TERMINEE'],
      ['COMPAGNONNAGE', 'EN_COURS'],
      ['DEPART_ROUTIER', 'A_VENIR'],
    ]);
    expect(pathway.priorStages[0]).toMatchObject({ note: 'Investiture fictive.', revokedAt: null });

    // Reconnaissance ultérieure de l'apprentissage depuis la fiche : l'obligation existante reste
    // tracée, ne retient plus, et n'est jamais déclarée acquise.
    expect(
      await errorCode(
        assistant.post(`/scouts/${created.id}/prior-stages`, { stageId: stages.APPRENTISSAGE }),
        403,
      ),
    ).toBe('FORBIDDEN');
    const recognition = await json(
      plein.post(`/scouts/${created.id}/prior-stages`, {
        stageId: stages.APPRENTISSAGE,
        completedOn: addCalendarDays(today, -30),
      }),
      201,
      priorStageRecognitionSchema,
    );
    expect(
      await errorCode(
        plein.post(`/scouts/${created.id}/prior-stages`, { stageId: stages.APPRENTISSAGE }),
        422,
      ),
    ).toBe('ALREADY_RECOGNIZED');
    pathway = await json(plein.get(`/scouts/${created.id}/pathway`), 200, scoutPathwaySchema);
    expect(pathway.catchUps).toMatchObject([
      { module: { id: app_.id }, status: 'PARCOURS_ANTERIEUR', decision: null, blocking: false },
    ]);
    expect(pathway.catchUpLock.active).toBe(false);
    const overview = await json(plein.get('/statistics/pathways'), 200, pathwayOverviewSchema);
    expect(overview.catchUps.open).toBe(0);
    expect(await prisma.catchUpObligation.count({ where: { decision: { not: null } } })).toBe(0);
    expect(await prisma.competencyValidation.count()).toBe(0);
    expect(await prisma.catchUpObligation.count({ where: { moduleId: nov.id } })).toBe(0);

    // Révocation motivée : historique conservé, rattrapage de nouveau exigible.
    await plein
      .post(`/prior-stages/${recognition.id}/revoke`, { reason: 'Saisie erronée fictive.' })
      .expect(400);
    await plein
      .post(`/prior-stages/${recognition.id}/revoke`, {
        reason: 'Saisie erronée fictive.',
        confirm: true,
      })
      .expect(201);
    expect(
      await errorCode(
        plein.post(`/prior-stages/${recognition.id}/revoke`, {
          reason: 'Seconde révocation fictive.',
          confirm: true,
        }),
        409,
      ),
    ).toBe('PRIOR_STAGE_ALREADY_REVOKED');
    const history = await json(
      assistant.get(`/scouts/${created.id}/prior-stages`),
      200,
      priorStageListSchema,
    );
    expect(history.items.map((r) => [r.stage.code, r.revokedAt !== null])).toEqual([
      ['NOVICIAT', false],
      ['APPRENTISSAGE', true],
    ]);
    pathway = await json(plein.get(`/scouts/${created.id}/pathway`), 200, scoutPathwaySchema);
    expect(pathway.catchUps[0]?.status).not.toBe('PARCOURS_ANTERIEUR');
    // Historique figé en base : ni suppression, ni modification d'une reconnaissance.
    await expect(
      prisma.priorStageRecognition.delete({ where: { id: recognition.id } }),
    ).rejects.toThrow();
    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'PriorStageRecognition' },
      select: { action: true },
    });
    expect(audit.map((row) => row.action).sort()).toEqual([
      'priorStage.recognized',
      'priorStage.recognized',
      'priorStage.revoked',
    ]);
  });

  it('scénarios C, D, E : lecture libre sans validation ; le routier ne valide rien lui-même', async () => {
    const { plein } = await community();
    await mandatoryModule('cours-depart', 'DEPART_ROUTIER');
    await mandatoryModule('cours-noviciat', 'NOVICIAT');
    const novice = await login('ROUTIER');
    const profile = await prisma.scoutProfile.create({
      data: {
        userId: novice.user.id,
        firstName: 'Fictif',
        lastName: 'Novice',
        birthDate: new Date(`${addCalendarDays(addCalendarMonths(today, -12 * 18), -3)}T00:00:00Z`),
      },
    });
    // C. Un novice lit un cours d'une étape supérieure : aucune étude, aucune tentative créée.
    const catalog = await json(novice.get('/modules?pageSize=50'), 200, catalogPageSchema);
    expect(catalog.items).toHaveLength(2);
    await novice.get('/modules/cours-depart').expect(200);
    await novice.get('/modules/cours-depart/print').expect(200);
    await novice.get('/modules/cours-depart/offline-package').expect(200);
    expect(await prisma.moduleStudy.count()).toBe(0);
    expect(await prisma.evaluationAttempt.count()).toBe(0);
    // D. Relire le noviciat ne change pas l'étape.
    await novice.get('/modules/cours-noviciat').expect(200);
    const pathway = await json(novice.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(pathway.stage?.code).toBe('NOVICIAT');
    // E. Le routier ne reconnaît ni ne révoque aucune étape (serveur).
    expect(
      await errorCode(
        novice.post(`/scouts/${profile.id}/prior-stages`, { stageId: stages.NOVICIAT }),
        403,
      ),
    ).toBe('FORBIDDEN');
    await novice.get(`/scouts/${profile.id}/prior-stages`).expect(403);
    expect(await prisma.priorStageRecognition.count()).toBe(0);
    // Le plein ne peut pas reconnaître l'étape en cours (noviciat) d'un novice.
    expect(
      await errorCode(
        plein.post(`/scouts/${profile.id}/prior-stages`, { stageId: stages.NOVICIAT }),
        422,
      ),
    ).toBe('NOT_PRIOR_STAGE');
  });

  it('scénario G et concurrence : routier sans compte, deux reconnaissances simultanées', async () => {
    const { plein } = await community();
    const created = await json(
      plein.post('/scouts', scout(1, { birthDate: bornYearsAgo(20) })),
      201,
      scoutDetailSchema,
    );
    expect(created).toMatchObject({ account: null, stage: { code: 'DEPART_ROUTIER' } });
    expect(await prisma.user.count({ where: { role: 'ROUTIER' } })).toBe(0);
    const results = await Promise.all(
      [0, 1].map(() =>
        plein.post(`/scouts/${created.id}/prior-stages`, { stageId: stages.COMPAGNONNAGE }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(await prisma.priorStageRecognition.count()).toBe(1);
    // Version de fiche périmée : conflit explicite, aucune écriture.
    expect(
      await errorCode(
        plein.post(`/scouts/${created.id}/prior-stages`, {
          stageId: stages.NOVICIAT,
          expectedUpdatedAt: '2000-01-01T00:00:00.000Z',
        }),
        409,
      ),
    ).toBe('SCOUT_PROFILE_CHANGED');
    // Une fiche historique sans date de naissance n'est pas réactivée sans étape.
    const legacy = await prisma.scoutProfile.create({
      data: { firstName: 'Fictif', lastName: 'Historique', isActive: false },
    });
    expect(await errorCode(plein.post(`/scouts/${legacy.id}/activate`), 422)).toBe(
      'BIRTH_DATE_REQUIRED',
    );
  });

  it('lot 8 : diagnostic en lecture seule des fiches historiques', async () => {
    const { plein } = await community();
    const valid = await json(plein.post('/scouts', scout(1)), 201, scoutDetailSchema);
    const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const missing = await prisma.scoutProfile.create({
      data: { firstName: 'Fictif', lastName: 'Sans date' },
    });
    const young = await prisma.scoutProfile.create({
      data: { firstName: 'Fictif', lastName: 'Trop jeune', birthDate: date(bornYearsAgo(16)) },
    });
    const exited = await prisma.scoutProfile.create({
      data: { firstName: 'Fictif', lastName: 'Sorti', birthDate: date(bornYearsAgo(22)) },
    });
    // Reconnaissance devenue incohérente après une correction de date (simulée en base).
    await prisma.priorStageRecognition.create({
      data: {
        scoutProfileId: valid.id,
        stageId: stages.DEPART_ROUTIER!,
        recordedById: plein.user.id,
      },
    });
    await prisma.scoutProfile.create({
      data: { firstName: 'Fictif', lastName: 'Inactif', isActive: false },
    });
    const before = await prisma.scoutProfile.findMany({ orderBy: { id: 'asc' } });
    const report = await diagnoseStages(prisma);
    expect(report.activeProfiles).toBe(4);
    expect(Object.fromEntries(report.rows.map((r) => [r.scoutProfileId, r.anomalies]))).toEqual({
      [valid.id]: ['RECONNAISSANCE_INCOHERENTE'],
      [missing.id]: ['DATE_NAISSANCE_MANQUANTE'],
      [young.id]: ['AGE_AVANT_ENTREE'],
      [exited.id]: ['SORTIE_NON_ENREGISTREE'],
    });
    // Aucun nom dans le rapport ; aucune écriture.
    expect(JSON.stringify(report)).not.toContain('Fictif');
    expect(await prisma.scoutProfile.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });
});
