import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addCalendarDays,
  addCalendarMonths,
  anniversaryOf,
  apiErrorSchema,
  catalogPageSchema,
  catchUpObligationSchema,
  civilDateAt,
  CSRF_HEADER,
  leadershipAdminSchema,
  leadershipAssignmentSchema,
  leadershipTeamSchema,
  meResponseSchema,
  scoutDetailSchema,
  scoutPathwaySchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { seedInitialAgeRuleSet } from '../prisma/seeds/age-rules.seed.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from '../prisma/seeds/route-bibliotheque.seed.js';
import { importSourceModules } from '../prisma/seeds/source-modules.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { MembershipService } from '../src/modules/progression/membership.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Refonte : fonctions d'encadrement désignées par l'administrateur (D132), permissions par fonction,
// progression par l'âge, rattrapages,
// sortie de la branche, typologie et catalogue de découverte. PostgreSQL réel, données fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const TODAY = civilDateAt(new Date());

/** Date de naissance donnant `years` ans révolus aujourd'hui, décalée de `days` jours. */
const bornYearsAgo = (years: number, days = 0) =>
  addCalendarDays(addCalendarMonths(TODAY, -12 * years), days);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Refonte parcours Route et gouvernance (intégration PostgreSQL)', () => {
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
    const rows = await prisma.progressionStage.findMany();
    stages = Object.fromEntries(rows.map((stage) => [stage.code, stage.id]));
  });

  async function login(role: 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR', legacyRole?: string) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `refonte${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        legacyRole: legacyRole ?? null,
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

  const me = async (client: Client) =>
    (await json(client.get('/auth/me'), 200, meResponseSchema)).user;

  const assign = (admin: Client, body: object) => admin.post('/leadership/assignments', body);
  const designate = async (admin: Client, userId: string, fn: string, confirm = true) =>
    json(
      assign(admin, { userId, function: fn, confirmReplacement: confirm }),
      201,
      leadershipAssignmentSchema,
    );
  const canTeam = (client: Client, status: number) =>
    client.post('/teams', { name: `Équipe ${(counter += 1)}` }).expect(status);

  describe('Gouvernance : fonctions désignées par l’administrateur (D132)', () => {
    it('sans fonction : consultation seulement ; l’administrateur n’a aucun accès pédagogique ; anciennes routes supprimées', async () => {
      const former = await login('ENCADREMENT', 'RESPONSABLE');
      const profile = await me(former);
      expect(profile.leaderFunction).toBeNull();
      expect(profile.permissions).toContain('scout.read');
      expect(profile.permissions).not.toContain('module.review');
      await former.get('/scouts').expect(200);
      expect(await errorCode(former.post('/teams', { name: 'Équipe fictive' }), 403)).toBe(
        'FORBIDDEN',
      );

      const admin = await login('ADMINISTRATEUR');
      await admin.get('/scouts').expect(403);
      await admin.get('/modules').expect(403);
      const view = await json(admin.get('/leadership/admin'), 200, leadershipAdminSchema);
      expect(view.members).toEqual([]);
      expect(view.staff).toEqual([
        expect.objectContaining({ id: former.user.id, currentFunction: null }),
      ]);
      for (const path of ['/mandates', '/delegations', '/scout-years']) {
        await admin.get(path).expect(404);
        await admin.post(path, {}).expect(404);
      }
    });

    it('désignation directe du plein : droits immédiats, journalisés ; seul l’administrateur désigne', async () => {
      const admin = await login('ADMINISTRATEUR');
      const plein = await login('ENCADREMENT');
      const routier = await login('ROUTIER');
      await canTeam(plein, 403);

      // Accès direct à l'API par des personnes non habilitées.
      for (const client of [plein, routier]) {
        await client.get('/leadership/admin').expect(403);
        await assign(client, { userId: plein.user.id, function: 'PLEIN' }).expect(403);
      }
      // Entrées invalides et personnes non éligibles.
      await assign(admin, { userId: 'pas-un-uuid', function: 'PLEIN' }).expect(400);
      await assign(admin, { userId: plein.user.id, function: 'CHEF' }).expect(400);
      for (const user of [admin.user, routier.user]) {
        expect(await errorCode(assign(admin, { userId: user.id, function: 'PLEIN' }), 400)).toBe(
          'NOT_STAFF',
        );
      }

      const created = await designate(admin, plein.user.id, 'PLEIN', false);
      expect(created).toMatchObject({ function: 'PLEIN', endedAt: null, migrated: false });
      expect((await me(plein)).leaderFunction).toBe('PLEIN');
      await canTeam(plein, 201);
      // Le plein ne gère pas l'encadrement (administrateur fonctionnel ≠ technique).
      await plein.get('/leadership/admin').expect(403);
      expect(
        await errorCode(assign(admin, { userId: plein.user.id, function: 'PLEIN' }), 409),
      ).toBe('ALREADY_IN_FUNCTION');

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'leadership.assigned', entityId: created.id },
      });
      expect(audit.actorId).toBe(admin.user.id);

      // Tout membre connecté voit la composition (noms et fonctions uniquement).
      const team = await json(routier.get('/leadership'), 200, leadershipTeamSchema);
      expect(team.members.map((m) => [m.function, m.user.id])).toEqual([['PLEIN', plein.user.id]]);
      expect(Object.keys(team.members[0]!.user).sort()).toEqual(['firstName', 'id', 'lastName']);
    });

    it('remplacement du plein : confirmé, atomique, anciens droits retirés, historiques conservés', async () => {
      const admin = await login('ADMINISTRATEUR');
      const first = await login('ENCADREMENT');
      const second = await login('ENCADREMENT');
      const initial = await designate(admin, first.user.id, 'PLEIN');
      const scout = await json(
        first.post('/scouts', { firstName: 'Fictif', lastName: 'Historique', joinedAt: TODAY }),
        201,
        scoutDetailSchema,
      );

      expect(
        await errorCode(assign(admin, { userId: second.user.id, function: 'PLEIN' }), 409),
      ).toBe('PLEIN_REPLACEMENT_UNCONFIRMED');
      expect((await me(first)).leaderFunction).toBe('PLEIN');

      const replacement = await designate(admin, second.user.id, 'PLEIN');
      // Retrait immédiat, sans nouvelle connexion ; la personne garde l'accès de l'encadrement.
      const formerProfile = await me(first);
      expect(formerProfile.leaderFunction).toBeNull();
      expect(formerProfile.permissions).not.toContain('team.manage');
      await canTeam(first, 403);
      await first.get(`/scouts/${scout.id}`).expect(200);
      await canTeam(second, 201);

      const view = await json(admin.get('/leadership/admin'), 200, leadershipAdminSchema);
      expect(view.members.map((m) => m.user.id)).toEqual([second.user.id]);
      const ended = view.history.find((row) => row.id === initial.id);
      expect(ended).toMatchObject({ endReason: 'Remplacé comme responsable plein.' });
      expect(ended?.endedAt).toBe(replacement.startedAt);
      expect(ended?.endedBy?.id).toBe(admin.user.id);
      // Les actions de l'ancien plein restent attribuées à son compte.
      const created = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: scout.id, actorId: first.user.id },
      });
      expect(created).toBeTruthy();
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'leadership.assigned', entityId: replacement.id },
      });
      expect(audit.metadata).toMatchObject({ replacedUserId: first.user.id });
    });

    it('unicité du plein : contrainte en base et remplacements concurrents', async () => {
      const admin = await login('ADMINISTRATEUR');
      const people = [
        await login('ENCADREMENT'),
        await login('ENCADREMENT'),
        await login('ENCADREMENT'),
      ];
      await designate(admin, people[0]!.user.id, 'PLEIN');
      await expect(
        prisma.leadershipAssignment.create({
          data: { userId: people[1]!.user.id, function: 'PLEIN' },
        }),
      ).rejects.toThrow();
      const results = await Promise.all(
        people
          .slice(1)
          .map((person) =>
            assign(admin, { userId: person.user.id, function: 'PLEIN', confirmReplacement: true }),
          ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 201]);
      const open = await prisma.leadershipAssignment.findMany({
        where: { function: 'PLEIN', endedAt: null },
      });
      expect(open).toHaveLength(1);
      expect(await prisma.leadershipAssignment.count({ where: { function: 'PLEIN' } })).toBe(3);
    });

    it('adjoint et assistants : accompagnement sans décision officielle, changement et fin de fonction', async () => {
      const admin = await login('ADMINISTRATEUR');
      const adjoint = await login('ENCADREMENT');
      const assistants = [await login('ENCADREMENT'), await login('ENCADREMENT')];
      await designate(admin, adjoint.user.id, 'ADJOINT');
      for (const person of assistants) await designate(admin, person.user.id, 'ASSISTANT');
      for (const person of [adjoint, ...assistants]) {
        const profile = await me(person);
        expect(profile.permissions).toContain('observation.create');
        expect(profile.permissions).toContain('module.write');
        expect(profile.permissions).not.toContain('module.review');
        await canTeam(person, 403);
      }
      let team = await json(adjoint.get('/leadership'), 200, leadershipTeamSchema);
      expect(team.members.map((m) => m.function)).toEqual(['ADJOINT', 'ASSISTANT', 'ASSISTANT']);

      // Changement de fonction : l'ancienne prend fin dans la même transaction.
      const promoted = await designate(admin, assistants[0]!.user.id, 'ADJOINT');
      expect((await me(assistants[0]!)).leaderFunction).toBe('ADJOINT');
      const ended = await json(
        admin.post(`/leadership/assignments/${promoted.id}/end`, { reason: 'Fin fictive' }),
        201,
        leadershipAssignmentSchema,
      );
      expect(ended.endedAt).not.toBeNull();
      expect((await me(assistants[0]!)).leaderFunction).toBeNull();
      expect(
        await errorCode(
          admin.post(`/leadership/assignments/${promoted.id}/end`, { reason: 'Encore' }),
          409,
        ),
      ).toBe('ASSIGNMENT_ALREADY_ENDED');
      await admin.post(`/leadership/assignments/${promoted.id}/end`, { reason: '' }).expect(400);
      team = await json(adjoint.get('/leadership'), 200, leadershipTeamSchema);
      expect(team.members.map((m) => m.function)).toEqual(['ADJOINT', 'ASSISTANT']);
      const history = (await json(admin.get('/leadership/admin'), 200, leadershipAdminSchema))
        .history;
      expect(history.filter((row) => row.user.id === assistants[0]!.user.id)).toHaveLength(2);
    });

    it('historique immuable : ni suppression ni réécriture ; anciennes tables gelées', async () => {
      const admin = await login('ADMINISTRATEUR');
      const person = await login('ENCADREMENT');
      const row = await designate(admin, person.user.id, 'ASSISTANT');
      await expect(prisma.leadershipAssignment.delete({ where: { id: row.id } })).rejects.toThrow();
      await expect(
        prisma.leadershipAssignment.update({ where: { id: row.id }, data: { function: 'PLEIN' } }),
      ).rejects.toThrow();
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO scout_years (id, label, starts_on, ends_on) VALUES (uuidv7(), '2099-2100', '2099-09-01', '2100-08-31')`,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Progression par l’âge, rattrapages et sortie de la branche', () => {
    async function staff() {
      const admin = await login('ADMINISTRATEUR');
      const plein = await login('ENCADREMENT');
      const assistant = await login('ENCADREMENT');
      await designate(admin, plein.user.id, 'PLEIN');
      return { admin, plein, assistant };
    }

    const createScout = (plein: Client, n: number, birthDate: string, stageCode = 'NOVICIAT') =>
      json(
        plein.post('/scouts', {
          firstName: 'Routier',
          lastName: `Fictif${n}`,
          birthDate,
          joinedAt: TODAY,
          currentStageId: stages[stageCode],
        }),
        201,
        scoutDetailSchema,
      );

    /** Module obligatoire publié d'une étape, avec source officielle fictive (contournement des écrans). */
    async function publishedMandatoryModule(stageCode: string) {
      const module = await prisma.pedagogicalModule.create({
        data: { slug: `obligatoire-${stageCode.toLowerCase()}` },
      });
      const version = await prisma.moduleVersion.create({
        data: {
          moduleId: module.id,
          version: 1,
          title: `Module obligatoire fictif ${stageCode}`,
          stageId: stages[stageCode],
          category: 'ETAPE',
          obligation: 'OBLIGATOIRE',
          officialSource: 'Source officielle fictive (tests)',
        },
      });
      for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
        await prisma.moduleVersion.update({ where: { id: version.id }, data: { status } });
      }
      await prisma.pedagogicalModule.update({
        where: { id: module.id },
        data: { publishedVersionId: version.id },
      });
      return module;
    }

    it('étape théorique selon l’âge, distincte de l’étape officielle ; rien d’inventé sans référentiel', async () => {
      const { plein } = await staff();
      const novice = await createScout(plein, 1, bornYearsAgo(18, -3));
      let pathway = await json(plein.get(`/scouts/${novice.id}/pathway`), 200, scoutPathwaySchema);
      expect(pathway.age.reason).toBe('AUCUN_REFERENTIEL');
      expect(pathway.theoreticalStage).toBeNull();

      await seedInitialAgeRuleSet(prisma);
      pathway = await json(plein.get(`/scouts/${novice.id}/pathway`), 200, scoutPathwaySchema);
      expect(pathway.age.age).toBe(18);
      expect(pathway.theoreticalStage?.code).toBe('NOVICIAT');
      expect(pathway.officialStage?.code).toBe('NOVICIAT');
      expect(pathway.gap).toBe('ALIGNEE');
      expect(pathway.age.period?.endsOn).toBe(
        addCalendarMonths(anniversaryOf(bornYearsAgo(18, -3), 18), 1),
      );

      // 19 ans, sans règle validée après le noviciat : non déterminée (aucune étape présumée).
      const older = await createScout(plein, 2, bornYearsAgo(19), 'APPRENTISSAGE');
      pathway = await json(plein.get(`/scouts/${older.id}/pathway`), 200, scoutPathwaySchema);
      expect(pathway.theoreticalStage).toBeNull();
      expect(pathway.age.reason).toBe('AUCUNE_REGLE');
      expect(pathway.gap).toBe('INDETERMINE');
      // Aucun statut de calcul ne change l'étape officielle.
      expect(
        (await prisma.scoutProfile.findUniqueOrThrow({ where: { id: older.id } })).currentStageId,
      ).toBe(stages.APPRENTISSAGE);

      // Référentiel figé une fois en vigueur.
      await expect(
        prisma.ageRuleSet.updateMany({ data: { branchExitAgeYears: 22 } }),
      ).rejects.toThrow();
    });

    it('inscription tardive : obligations antérieures identifiées, idempotentes, décidées par un humain', async () => {
      const { plein, assistant } = await staff();
      await seedInitialAgeRuleSet(prisma);
      const module = await publishedMandatoryModule('NOVICIAT');
      // Routier sans compte, inscrit à 19 ans directement en Apprentissage.
      const late = await createScout(plein, 3, bornYearsAgo(19), 'APPRENTISSAGE');

      const first = await json(plein.get(`/scouts/${late.id}/pathway`), 200, scoutPathwaySchema);
      expect(first.catchUps).toHaveLength(1);
      expect(first.catchUps[0]).toMatchObject({
        module: { id: module.id },
        status: 'A_FAIRE',
        dueOn: null,
        decision: null,
        stillRequired: true,
      });
      expect(first.catchUpDeadlineUndetermined).toBe(true);
      // Recalcul idempotent (lecture répétée, encadrement sans mandat).
      const again = await json(
        assistant.get(`/scouts/${late.id}/pathway`),
        200,
        scoutPathwaySchema,
      );
      expect(again.catchUps.map((c) => c.id)).toEqual(first.catchUps.map((c) => c.id));
      expect(await prisma.catchUpObligation.count()).toBe(1);

      // Un routier dans son mois de noviciat n'a pas de rattrapage : c'est son étape en cours.
      const novice = await createScout(plein, 4, bornYearsAgo(18, -1));
      const novicePathWay = await json(
        plein.get(`/scouts/${novice.id}/pathway`),
        200,
        scoutPathwaySchema,
      );
      expect(novicePathWay.catchUps).toHaveLength(0);
      expect(novicePathWay.stageModules.map((m) => m.id)).toEqual([module.id]);

      const obligationId = first.catchUps[0]!.id;
      const decision = {
        decision: 'ACQUIS',
        reason: 'Acquis constaté en entretien fictif',
        confirm: true,
      };
      await assistant.post(`/catch-ups/${obligationId}/decision`, decision).expect(403);
      const decided = await json(
        plein.post(`/catch-ups/${obligationId}/decision`, decision),
        201,
        catchUpObligationSchema,
      );
      expect(decided.status).toBe('ACQUIS');
      expect(
        await errorCode(plein.post(`/catch-ups/${obligationId}/decision`, decision), 409),
      ).toBe('CATCH_UP_ALREADY_DECIDED');
      await expect(
        prisma.catchUpObligation.update({
          where: { id: obligationId },
          data: { decision: 'NON_APPLICABLE' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.catchUpObligation.delete({ where: { id: obligationId } }),
      ).rejects.toThrow();
    });

    it('sortie à 21 ans : la veille actif, le jour même sorti ; historique conservé ; traitement idempotent', async () => {
      const { plein } = await staff();
      await seedInitialAgeRuleSet(prisma);
      const team = await plein.post('/teams', { name: 'Équipe fictive' }).expect(201);
      const eve = await createScout(plein, 5, bornYearsAgo(21, 1), 'COMPAGNONNAGE');
      const day = await createScout(plein, 6, bornYearsAgo(21), 'COMPAGNONNAGE');
      await plein
        .post(`/scouts/${day.id}/teams/assign`, { teamId: (team.body as { id: string }).id })
        .expect(201);

      const evePath = await json(plein.get(`/scouts/${eve.id}/pathway`), 200, scoutPathwaySchema);
      expect(evePath.membership.status).toBe('ACTIF');
      expect(evePath.age.daysUntilExit).toBe(1);
      // Avant tout traitement, la sortie est déjà prise en compte à la lecture.
      const dayPath = await json(plein.get(`/scouts/${day.id}/pathway`), 200, scoutPathwaySchema);
      expect(dayPath.membership).toEqual({ status: 'SORTI', exitedOn: null });

      const membership = app.get(MembershipService);
      const report = await membership.applyExits(TODAY);
      expect(report.exited).toBe(1);
      expect((await membership.applyExits(TODAY)).exited).toBe(0);
      const profile = await prisma.scoutProfile.findUniqueOrThrow({
        where: { id: day.id },
        include: { teamAssignments: true, stageChanges: true, membershipEvents: true },
      });
      expect(profile.membershipStatus).toBe('SORTI');
      expect(profile.isActive).toBe(true);
      expect(profile.currentStageId).toBe(stages.COMPAGNONNAGE);
      expect(profile.membershipEvents).toHaveLength(1);
      expect(profile.teamAssignments).toHaveLength(1);
      expect(profile.teamAssignments[0]!.endedAt).not.toBeNull();
      expect(profile.stageChanges.length).toBeGreaterThan(0);
      expect(
        (await prisma.scoutProfile.findUniqueOrThrow({ where: { id: eve.id } })).membershipStatus,
      ).toBe('ACTIF');
      await plein.post('/membership/apply-exits').expect(201);
    });
  });

  describe('Typologie et catalogue de découverte', () => {
    it('obligatoire exige étape et source ; catalogue importé en brouillon, sans doublon, invisible des routiers', async () => {
      const encadrant = await login('ENCADREMENT');
      expect(
        await errorCode(
          encadrant.post('/editor/modules', {
            title: 'Module obligatoire sans source',
            obligation: 'OBLIGATOIRE',
          }),
          400,
        ),
      ).toBe('MODULE_TYPOLOGY_INVALID');
      await encadrant
        .post('/editor/modules', { title: 'Module transversal fictif', category: 'TRANSVERSAL' })
        .expect(201);

      const sources = [...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES];
      const first = await importSourceModules(prisma, sources);
      expect(first.filter((r) => r.outcome === 'CREE')).toHaveLength(11);
      const second = await importSourceModules(prisma, sources);
      expect(second.every((r) => r.outcome === 'DEJA_IMPORTE')).toBe(true);
      expect(
        await prisma.moduleVersion.count({
          where: { category: 'TRANSVERSAL', status: 'BROUILLON' },
        }),
      ).toBe(1);
      expect(await prisma.moduleVersion.count({ where: { status: 'BROUILLON' } })).toBe(12);
      expect(await prisma.moduleVersion.count({ where: { status: { not: 'BROUILLON' } } })).toBe(0);

      const routier = await login('ROUTIER');
      const catalog = await json(
        routier.get('/modules?category=TRANSVERSAL'),
        200,
        catalogPageSchema,
      );
      expect(catalog.total).toBe(0);
    });
  });
});
