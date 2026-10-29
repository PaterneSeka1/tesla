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
  delegationSchema,
  leadershipOverviewSchema,
  mandateHistorySchema,
  mandateSchema,
  meResponseSchema,
  reconductionDraftSchema,
  scoutDetailSchema,
  scoutPathwaySchema,
  scoutYearSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { seedInitialAgeRuleSet } from '../prisma/seeds/age-rules.seed.js';
import { DISCOVERY_MODULES } from '../prisma/seeds/decouverte.seed.js';
import { importSourceModules } from '../prisma/seeds/source-modules.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { MembershipService } from '../src/modules/progression/membership.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Refonte : mandats et délégations, permissions par fonction, progression par l'âge, rattrapages,
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

describe('Refonte parcours Route et mandats (intégration PostgreSQL)', () => {
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

  /** Années scoutes consécutives fictives (1er septembre → 31 août), la première couvrant aujourd'hui. */
  async function createYears(admin: Client, count: number) {
    const first = Number(TODAY.slice(0, 4)) - (TODAY.slice(5) < '09-01' ? 1 : 0);
    const years = [];
    for (let index = 0; index < count; index += 1) {
      const year = first + index;
      years.push(
        await json(
          admin.post('/scout-years', {
            label: `${year}-${year + 1}`,
            startsOn: `${year}-09-01`,
            endsOn: `${year + 1}-08-31`,
          }),
          201,
          scoutYearSchema,
        ),
      );
    }
    return years;
  }

  const appoint = (admin: Client, body: object) =>
    admin.post('/mandates', { appointingAuthority: 'Commissaire fictif', confirm: true, ...body });

  describe('Mandats, fonctions et permissions', () => {
    it('reprise : un ancien responsable sans mandat n’a aucun droit officiel mais garde la consultation', async () => {
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
      const overview = await json(admin.get('/leadership'), 200, leadershipOverviewSchema);
      expect(overview.vacancies.plein).toBe(true);
      expect(overview.withoutMandate).toEqual([
        expect.objectContaining({ id: former.user.id, legacyRole: 'RESPONSABLE' }),
      ]);
      // L'administration technique n'a aucun accès pédagogique.
      await admin.get('/scouts').expect(403);
    });

    it('un seul plein à une date donnée ; le plein ne consigne pas sa propre nomination', async () => {
      const admin = await login('ADMINISTRATEUR');
      const [a, b] = [await login('ENCADREMENT'), await login('ENCADREMENT')];
      const [year] = await createYears(admin, 1);
      expect(
        await errorCode(
          admin.post('/scout-years', {
            label: 'XXXX',
            startsOn: '2030-01-01',
            endsOn: '2030-12-31',
          }),
          400,
        ),
      ).toBe('VALIDATION_ERROR');
      await errorCode(
        admin.post('/scout-years', {
          label: `${year!.label.slice(0, 4)}-${Number(year!.label.slice(0, 4)) + 1}`,
          startsOn: year!.startsOn,
          endsOn: year!.endsOn,
        }),
        409,
      );

      await json(
        appoint(admin, {
          userId: a.user.id,
          function: 'PLEIN',
          scoutYearId: year!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      expect(
        await errorCode(
          appoint(admin, {
            userId: b.user.id,
            function: 'PLEIN',
            scoutYearId: year!.id,
            kind: 'NOMINATION',
          }),
          409,
        ),
      ).toBe('PLEIN_OVERLAP');
      // Le plein en exercice ne consigne pas de mandat de plein (ni le sien ni un autre).
      await appoint(a, {
        userId: b.user.id,
        function: 'PLEIN',
        scoutYearId: year!.id,
        kind: 'NOMINATION',
      }).expect(403);
      // Sans confirmation explicite : refus.
      await admin
        .post('/mandates', {
          userId: b.user.id,
          function: 'ADJOINT',
          scoutYearId: year!.id,
          kind: 'NOMINATION',
          appointingAuthority: 'X fictif',
        })
        .expect(400);

      expect((await me(a)).leaderFunction).toBe('PLEIN');
      await a.post('/teams', { name: 'Équipe du plein' }).expect(201);
      // Le plein nomme un adjoint ; l'adjoint n'a pas les droits officiels par défaut.
      await json(
        appoint(a, {
          userId: b.user.id,
          function: 'ADJOINT',
          scoutYearId: year!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      expect((await me(b)).permissions).not.toContain('team.manage');
      await b.post('/teams', { name: 'Équipe de l’adjoint' }).expect(403);

      // Contrainte en base, indépendamment du service.
      await expect(
        prisma.leadershipMandate.create({
          data: {
            userId: b.user.id,
            function: 'PLEIN',
            scoutYearId: year!.id,
            startsOn: new Date(`${year!.startsOn}T00:00:00Z`),
            endsOn: new Date(`${year!.endsOn}T00:00:00Z`),
            kind: 'NOMINATION',
            appointingAuthority: 'Contournement',
          },
        }),
      ).rejects.toThrow();
    });

    it('reconduction illimitée (dix reconductions), retour d’un ancien plein, historique immuable', async () => {
      const admin = await login('ADMINISTRATEUR');
      const [a, b] = [await login('ENCADREMENT'), await login('ENCADREMENT')];
      const years = await createYears(admin, 13);
      let previous = await json(
        appoint(admin, {
          userId: a.user.id,
          function: 'PLEIN',
          scoutYearId: years[0]!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      for (let index = 1; index <= 10; index += 1) {
        const draft = await json(
          admin.get(`/mandates/${previous.id}/reconduction`),
          200,
          reconductionDraftSchema,
        );
        expect(draft.nextScoutYear?.id).toBe(years[index]!.id);
        expect(draft.consecutiveCount).toBe(index);
        // Le préremplissage n'enregistre rien.
        expect(
          (await json(admin.get('/mandates'), 200, mandateHistorySchema)).mandates,
        ).toHaveLength(index);
        previous = await json(
          appoint(admin, { ...draft.draft, startsOn: undefined, endsOn: undefined }),
          201,
          mandateSchema,
        );
        expect(previous.kind).toBe('RECONDUCTION');
      }
      // Reconduction incohérente (autre personne) refusée.
      await appoint(admin, {
        userId: b.user.id,
        function: 'PLEIN',
        scoutYearId: years[11]!.id,
        kind: 'RECONDUCTION',
        previousMandateId: previous.id,
      }).expect(400);
      // Un autre plein, puis le retour du premier.
      await json(
        appoint(admin, {
          userId: b.user.id,
          function: 'PLEIN',
          scoutYearId: years[11]!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      await json(
        appoint(admin, {
          userId: a.user.id,
          function: 'PLEIN',
          scoutYearId: years[12]!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      const history = await json(
        admin.get(`/mandates?userId=${a.user.id}`),
        200,
        mandateHistorySchema,
      );
      expect(history.mandates).toHaveLength(12);

      await expect(
        prisma.leadershipMandate.update({
          where: { id: previous.id },
          data: { function: 'ADJOINT' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.leadershipMandate.delete({ where: { id: previous.id } }),
      ).rejects.toThrow();
    });

    it('fin anticipée, changement de fonction, délégation nominative et révocable', async () => {
      const admin = await login('ADMINISTRATEUR');
      const [plein, member] = [await login('ENCADREMENT'), await login('ENCADREMENT')];
      const [year] = await createYears(admin, 1);
      await appoint(admin, {
        userId: plein.user.id,
        function: 'PLEIN',
        scoutYearId: year!.id,
        kind: 'NOMINATION',
      }).expect(201);
      const adjoint = await json(
        appoint(plein, {
          userId: member.user.id,
          function: 'ADJOINT',
          scoutYearId: year!.id,
          kind: 'NOMINATION',
        }),
        201,
        mandateSchema,
      );
      // Chevauchement pour une même personne : il faut d'abord terminer le mandat.
      expect(
        await errorCode(
          appoint(plein, {
            userId: member.user.id,
            function: 'ASSISTANT',
            scoutYearId: year!.id,
            kind: 'CHANGEMENT_FONCTION',
            previousMandateId: adjoint.id,
          }),
          400,
        ),
      ).toBe('PREVIOUS_MANDATE_MISMATCH');
      const yesterday = addCalendarDays(TODAY, -1);
      const canEndYesterday = yesterday >= year!.startsOn;
      const endOn = canEndYesterday ? yesterday : TODAY;
      await json(
        plein.post(`/mandates/${adjoint.id}/end`, {
          endedEarlyOn: endOn,
          reason: 'Changement de fonction fictif',
          confirm: true,
        }),
        201,
        mandateSchema,
      );
      await plein
        .post(`/mandates/${adjoint.id}/end`, {
          endedEarlyOn: endOn,
          reason: 'Deuxième fois',
          confirm: true,
        })
        .expect(409);
      if (canEndYesterday) {
        await json(
          appoint(plein, {
            userId: member.user.id,
            function: 'ASSISTANT',
            scoutYearId: year!.id,
            startsOn: TODAY,
            kind: 'CHANGEMENT_FONCTION',
            previousMandateId: adjoint.id,
          }),
          201,
          mandateSchema,
        );
        expect((await me(member)).leaderFunction).toBe('ASSISTANT');

        // Délégation limitée à une permission.
        const delegation = await json(
          plein.post('/delegations', {
            delegateId: member.user.id,
            permissions: ['team.manage'],
            startsOn: TODAY,
            endsOn: TODAY,
            reason: 'Absence fictive du plein',
            confirm: true,
          }),
          201,
          delegationSchema,
        );
        expect(delegation.active).toBe(true);
        await member.post('/teams', { name: 'Équipe déléguée' }).expect(201);
        await member
          .post('/competencies', {
            code: 'X-01',
            name: 'Compétence fictive',
            description: '',
            domain: null,
            stageId: null,
            observableCriteria: [],
            minEvidenceCount: 1,
          })
          .expect(403);
        // Seul le plein délègue ; une permission non délégable est refusée.
        await member
          .post('/delegations', {
            delegateId: plein.user.id,
            permissions: ['team.manage'],
            startsOn: TODAY,
            endsOn: TODAY,
            reason: 'Refus attendu',
            confirm: true,
          })
          .expect(403);
        await plein
          .post('/delegations', {
            delegateId: member.user.id,
            permissions: ['delegation.manage'],
            startsOn: TODAY,
            endsOn: TODAY,
            reason: 'Refus attendu',
            confirm: true,
          })
          .expect(400);

        await json(
          plein.post(`/delegations/${delegation.id}/revoke`, { reason: 'Retour du plein' }),
          201,
          delegationSchema,
        );
        await member.post('/teams', { name: 'Équipe après révocation' }).expect(403);
      }

      // Fin du mandat du plein : ses droits officiels cessent immédiatement (calcul à la lecture).
      const pleinMandate = (
        await json(admin.get('/leadership'), 200, leadershipOverviewSchema)
      ).current.find((mandate) => mandate.function === 'PLEIN')!;
      await json(
        admin.post(`/mandates/${pleinMandate.id}/end`, {
          endedEarlyOn: canEndYesterday ? yesterday : TODAY,
          reason: 'Fin fictive',
          confirm: true,
        }),
        201,
        mandateSchema,
      );
      if (canEndYesterday) {
        expect((await me(plein)).leaderFunction).toBeNull();
        await plein.post('/teams', { name: 'Équipe refusée' }).expect(403);
      }
      const audit = await prisma.auditLog.findMany({
        where: { entityType: { in: ['LeadershipMandate', 'Delegation'] } },
      });
      expect(audit.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Progression par l’âge, rattrapages et sortie de la branche', () => {
    async function staff() {
      const admin = await login('ADMINISTRATEUR');
      const plein = await login('ENCADREMENT');
      const assistant = await login('ENCADREMENT');
      const [year] = await createYears(admin, 1);
      await appoint(admin, {
        userId: plein.user.id,
        function: 'PLEIN',
        scoutYearId: year!.id,
        kind: 'NOMINATION',
      }).expect(201);
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

      const first = await importSourceModules(prisma, DISCOVERY_MODULES);
      expect(first.filter((r) => r.outcome === 'CREE')).toHaveLength(21);
      const second = await importSourceModules(
        prisma,
        DISCOVERY_MODULES,
      );
      expect(second.every((r) => r.outcome === 'DEJA_IMPORTE')).toBe(true);
      expect(
        await prisma.moduleVersion.count({
          where: { category: 'TRANSVERSAL', status: 'BROUILLON' },
        }),
      ).toBe(22);
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
