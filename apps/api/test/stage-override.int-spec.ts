import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addCalendarDays,
  addCalendarMonths,
  apiErrorSchema,
  civilDateAt,
  CSRF_HEADER,
  myProfileSchema,
  pathwayOverviewSchema,
  scoutDetailSchema,
  scoutPathwaySchema,
  stageOverridePreviewSchema,
  stageOverrideSchema,
  stageSupervisionSchema,
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
  createTestPrisma,
  installTestAgeRules,
  resetDatabase,
  testDatabaseUrl,
} from './int-database.js';

// Correction exceptionnelle de l'étape (D176) : plein en fonction seul, revérifié à l'écriture ;
// exception temporaire, motivée, historisée, jamais au-delà du 21e anniversaire ; explications
// internes du calcul jamais transmises aux autres profils. PostgreSQL réel, données fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const today = civilDateAt(new Date());
const inDays = (days: number) => addCalendarDays(today, days);
/** Date de naissance plaçant aujourd'hui le routier à `years` ans + 10 jours. */
const bornYearsAgo = (years: number) => addCalendarDays(addCalendarMonths(today, -12 * years), -10);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Exception de secours de l’étape (intégration PostgreSQL)', () => {
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
    await installTestAgeRules(prisma);
  });

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER', birthDate?: string) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `exception${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        passwordHash,
      },
    });
    const profile =
      role === 'ROUTIER'
        ? await prisma.scoutProfile.create({
            data: {
              userId: user.id,
              firstName: 'Fictif',
              lastName: `Routier ${counter}`,
              birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null,
            },
          })
        : null;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return {
      user,
      profile,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof login>>;

  const designate = (admin: Client, userId: string, fn: 'PLEIN' | 'ADJOINT' | 'ASSISTANT') =>
    admin
      .post('/leadership/assignments', { userId, function: fn, confirmReplacement: true })
      .expect(201);

  async function community() {
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    const adjoint = await login('ENCADREMENT');
    const assistant = await login('ENCADREMENT');
    await designate(admin, plein.user.id, 'PLEIN');
    await designate(admin, adjoint.user.id, 'ADJOINT');
    await designate(admin, assistant.user.id, 'ASSISTANT');
    // Compagnonnage (19 ans + 10 jours) selon le référentiel fictif.
    const routier = await login('ROUTIER', bornYearsAgo(19));
    return { admin, plein, adjoint, assistant, routier, scoutId: routier.profile!.id };
  }

  const body = (overrides: object = {}) => ({
    stageCode: 'APPRENTISSAGE',
    startsOn: today,
    endsOn: inDays(30),
    reason: 'Retour après une longue absence (motif fictif).',
    confirm: true,
    ...overrides,
  });

  it('19, 33. le plein applique une exception : étape appliquée partout, étape normale conservée', async () => {
    const { plein, assistant, routier, scoutId } = await community();

    const preview = await json(
      plein.post(`/scouts/${scoutId}/stage-overrides/preview`, body({ confirm: undefined })),
      201,
      stageOverridePreviewSchema,
    );
    expect(preview).toMatchObject({
      computedStage: { code: 'COMPAGNONNAGE' },
      requestedStage: { code: 'APPRENTISSAGE' },
      days: 31,
      conflict: false,
    });
    expect(await prisma.stageOverride.count()).toBe(0);

    const created = await json(
      plein.post(`/scouts/${scoutId}/stage-overrides`, body()),
      201,
      stageOverrideSchema,
    );
    expect(created).toMatchObject({
      status: 'ACTIVE',
      stage: { code: 'APPRENTISSAGE' },
      computedStageAtRequest: { code: 'COMPAGNONNAGE' },
    });

    // Étape appliquée : fiche, parcours (encadrement et routier).
    const detail = await json(plein.get(`/scouts/${scoutId}`), 200, scoutDetailSchema);
    expect(detail.stage?.code).toBe('APPRENTISSAGE');
    const mine = await json(routier.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(mine.stage?.code).toBe('APPRENTISSAGE');
    expect(
      (await json(assistant.get(`/scouts/${scoutId}/pathway`), 200, scoutPathwaySchema)).stage
        ?.code,
    ).toBe('APPRENTISSAGE');

    // Supervision : étape normale intacte, exception en cours, périodes.
    const supervision = await json(
      plein.get(`/scouts/${scoutId}/stage-supervision`),
      200,
      stageSupervisionSchema,
    );
    expect(supervision.computedStage?.code).toBe('COMPAGNONNAGE');
    expect(supervision.effectiveStage?.code).toBe('APPRENTISSAGE');
    expect(supervision.activeOverride?.id).toBe(created.id);
    expect(supervision.periods.map((p) => p.stage.code)).toEqual([
      'NOVICIAT',
      'APPRENTISSAGE',
      'COMPAGNONNAGE',
      'DEPART_ROUTIER',
    ]);
    // Rien d'autre n'est modifié : date de naissance, étape figée, aucune obligation effacée.
    const stored = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scoutId } });
    expect(stored.birthDate?.toISOString().slice(0, 10)).toBe(bornYearsAgo(19));
    expect(stored.currentStageId).toBeNull();

    // Journal sans le motif confidentiel.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'stageOverride.created', entityId: created.id },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('absence');
    expect(audit.actorId).toBe(plein.user.id);
  });

  it('20–23. adjoint, assistant, routier, administrateur : refus, rien n’est écrit', async () => {
    const { admin, adjoint, assistant, routier, scoutId } = await community();
    for (const client of [adjoint, assistant, routier, admin]) {
      expect(await errorCode(client.post(`/scouts/${scoutId}/stage-overrides`, body()), 403)).toBe(
        'FORBIDDEN',
      );
      expect(
        await errorCode(client.post(`/scouts/${scoutId}/stage-overrides/preview`, body()), 403),
      ).toBe('FORBIDDEN');
      expect(await errorCode(client.get(`/scouts/${scoutId}/stage-supervision`), 403)).toBe(
        'FORBIDDEN',
      );
      // 34–37. Règles internes du calcul : jamais consultables.
      expect(await errorCode(client.get('/age-rules'), 403)).toBe('FORBIDDEN');
    }
    expect(await prisma.stageOverride.count()).toBe(0);
  });

  it('24, 25, 39. ancien plein : ancienne session refusée en lecture et en écriture', async () => {
    const { admin, plein, scoutId } = await community();
    const created = await json(
      plein.post(`/scouts/${scoutId}/stage-overrides`, body()),
      201,
      stageOverrideSchema,
    );
    const successor = await login('ENCADREMENT');
    await designate(admin, successor.user.id, 'PLEIN');

    expect(
      await errorCode(
        plein.post(
          `/scouts/${scoutId}/stage-overrides`,
          body({ startsOn: inDays(40), endsOn: inDays(50) }),
        ),
        403,
      ),
    ).toBe('FORBIDDEN');
    expect(
      await errorCode(
        plein.post(`/stage-overrides/${created.id}/lift`, {
          reason: 'Levée par l’ancien plein (fictif).',
          confirm: true,
        }),
        403,
      ),
    ).toBe('FORBIDDEN');
    expect(await errorCode(plein.get(`/scouts/${scoutId}/stage-supervision`), 403)).toBe(
      'FORBIDDEN',
    );
    expect(await errorCode(plein.get('/age-rules'), 403)).toBe('FORBIDDEN');
    // Le successeur, lui, supervise.
    await successor.get(`/scouts/${scoutId}/stage-supervision`).expect(200);
    expect(await prisma.stageOverride.count()).toBe(1);
  });

  it('25. écriture concurrente au remplacement du plein : refusée', async () => {
    const { plein, scoutId } = await community();
    const successor = await login('ENCADREMENT');
    let pending: Promise<request.Response> | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('leadership_assignments'))`;
      pending = plein.post(`/scouts/${scoutId}/stage-overrides`, body()).then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await tx.leadershipAssignment.updateMany({
        where: { userId: plein.user.id, endedAt: null },
        data: { endedAt: new Date(), endReason: 'Remplacé (tests de concurrence)' },
      });
      await tx.leadershipAssignment.create({
        data: { userId: successor.user.id, function: 'PLEIN', reason: 'Remplacement fictif' },
      });
    });
    expect((await pending!).status).toBe(403);
    expect(await prisma.stageOverride.count()).toBe(0);
  });

  it('26, 27, 30. motif, dates, rétroactivité, sortie, étape normale, chevauchement : refus', async () => {
    const { plein, scoutId } = await community();
    const post = (b: object) => plein.post(`/scouts/${scoutId}/stage-overrides`, b);
    expect(await errorCode(post(body({ reason: '' })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ reason: 'court' })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ endsOn: undefined })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ endsOn: 'demain' })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ endsOn: inDays(-1) })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ confirm: false })), 400)).toBe('VALIDATION_ERROR');
    expect(await errorCode(post(body({ startsOn: inDays(-1) })), 422)).toBe(
      'STAGE_OVERRIDE_RETROACTIVE',
    );
    expect(await errorCode(post(body({ stageCode: 'COMPAGNONNAGE' })), 422)).toBe(
      'STAGE_OVERRIDE_SAME_AS_COMPUTED',
    );
    expect(await errorCode(post(body({ stageCode: 'INCONNUE' })), 422)).toBe('UNKNOWN_STAGE');
    // 21 ans dans (2 ans − 10 jours) : la fin ne peut dépasser la veille.
    expect(await errorCode(post(body({ endsOn: inDays(3 * 365) })), 422)).toBe(
      'STAGE_OVERRIDE_BEYOND_EXIT',
    );
    await post(body()).expect(201);
    // Exceptions contradictoires : chevauchement refusé (contrainte d'exclusion).
    expect(
      await errorCode(post(body({ stageCode: 'DEPART_ROUTIER', startsOn: inDays(10) })), 409),
    ).toBe('STAGE_OVERRIDE_CONFLICT');
    // Période disjointe : acceptée (programmée).
    const later = await json(
      post(body({ startsOn: inDays(60), endsOn: inDays(70) })),
      201,
      stageOverrideSchema,
    );
    expect(later.status).toBe('PROGRAMMEE');
    expect(await prisma.stageOverride.count()).toBe(2);
  });

  it('29, 33. levée motivée : retour immédiat à l’étape normale, historique conservé', async () => {
    const { plein, routier, scoutId } = await community();
    const created = await json(
      plein.post(`/scouts/${scoutId}/stage-overrides`, body()),
      201,
      stageOverrideSchema,
    );
    expect(
      await errorCode(plein.post(`/stage-overrides/${created.id}/lift`, { confirm: true }), 400),
    ).toBe('VALIDATION_ERROR');
    const lifted = await json(
      plein.post(`/stage-overrides/${created.id}/lift`, {
        reason: 'Situation régularisée (motif fictif).',
        confirm: true,
      }),
      201,
      stageOverrideSchema,
    );
    expect(lifted.status).toBe('LEVEE');
    expect(
      await errorCode(
        plein.post(`/stage-overrides/${created.id}/lift`, {
          reason: 'Seconde levée (motif fictif).',
          confirm: true,
        }),
        409,
      ),
    ).toBe('STAGE_OVERRIDE_ALREADY_LIFTED');
    expect((await json(routier.get('/me/pathway'), 200, scoutPathwaySchema)).stage?.code).toBe(
      'COMPAGNONNAGE',
    );
    // Une nouvelle exception sur la même période redevient possible ; l'ancienne reste.
    await plein.post(`/scouts/${scoutId}/stage-overrides`, body()).expect(201);
    const supervision = await json(
      plein.get(`/scouts/${scoutId}/stage-supervision`),
      200,
      stageSupervisionSchema,
    );
    expect(supervision.overrides.map((o) => o.status).sort()).toEqual(['ACTIVE', 'LEVEE']);
    // Base : ni suppression ni modification hors levée.
    await expect(prisma.stageOverride.delete({ where: { id: created.id } })).rejects.toThrow();
    await expect(
      prisma.stageOverride.update({ where: { id: created.id }, data: { reason: 'Réécrit…………' } }),
    ).rejects.toThrow();
    expect(
      (await prisma.auditLog.findMany({ where: { entityId: created.id } })).map((a) => a.action),
    ).toEqual(['stageOverride.created', 'stageOverride.lifted']);
  });

  it('32, 45. routier sorti (21 ans) : aucune exception, aucune nouvelle étude, rien d’effacé', async () => {
    const { plein } = await community();
    const exited = await login('ROUTIER', bornYearsAgo(21));
    const scoutId = exited.profile!.id;
    expect(await errorCode(plein.post(`/scouts/${scoutId}/stage-overrides`, body()), 422)).toBe(
      'SCOUT_EXITED',
    );
    const supervision = await json(
      plein.get(`/scouts/${scoutId}/stage-supervision`),
      200,
      stageSupervisionSchema,
    );
    expect(supervision).toMatchObject({
      canOverride: false,
      membership: 'SORTI',
      effectiveStage: null,
    });
    const pathway = await json(exited.get('/me/pathway'), 200, scoutPathwaySchema);
    expect(pathway.membership.status).toBe('SORTI');
    expect(pathway.stage).toBeNull();
    expect(
      await errorCode(exited.post('/me/module-studies', { moduleId: plein.user.id }), 422),
    ).toBe('SORTI_BRANCHE');
    // Compte conservé, connexion possible, profil intact.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: exited.user.id } })).isActive).toBe(
      true,
    );
  });

  it('34–41. DTO : aucune règle interne hors du plein', async () => {
    const { plein, adjoint, assistant, routier, scoutId } = await community();
    await plein.post(`/scouts/${scoutId}/stage-overrides`, body()).expect(201);

    const forPlein = await json(plein.get(`/scouts/${scoutId}/pathway`), 200, scoutPathwaySchema);
    expect(forPlein.age.ruleSetVersion).not.toBeNull();
    for (const client of [adjoint, assistant]) {
      const pathway = await json(client.get(`/scouts/${scoutId}/pathway`), 200, scoutPathwaySchema);
      expect(pathway.age.ruleSetVersion).toBeNull();
      const raw = JSON.stringify(pathway);
      expect(raw).not.toContain('absence');
      expect(raw).not.toContain('COMPAGNONNAGE');
      const overview = await json(client.get('/statistics/pathways'), 200, pathwayOverviewSchema);
      expect(overview.ruleSetVersion).toBeNull();
    }
    const mine = await routier.get('/me/pathway').expect(200);
    expect(JSON.stringify(mine.body)).not.toContain('absence');
    expect(scoutPathwaySchema.parse(mine.body).age.ruleSetVersion).toBeNull();
    const profile = await json(routier.get('/auth/profile'), 200, myProfileSchema);
    expect(profile.scout?.ruleSetVersion).toBeNull();
    expect(profile.scout?.stage?.code).toBe('APPRENTISSAGE');
  });
});
