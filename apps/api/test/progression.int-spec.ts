import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  activityDetailSchema,
  activitySummarySchema,
  apiErrorSchema,
  attendanceSheetSchema,
  chefDashboardSchema,
  competencySchema,
  competencyValidationSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
  moduleStudySchema,
  myActivitiesSchema,
  myDashboardSchema,
  myProgressionSchema,
  paginatedSchema,
  programmeCategoryListSchema,
  programmeImportReportSchema,
  programmeListSchema,
  proposalSchema,
  responsableDashboardSchema,
  scoutDetailSchema,
  scoutProgressionSchema,
  scoutTimelineSchema,
  stageChangeSchema,
  statisticsSchema,
  teamDetailSchema,
  observationSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { type Role } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Phase 4 de bout en bout : progression, compétences, études, programme, activités, présences,
// tableaux de bord. PostgreSQL réel, routes HTTP authentifiées, données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const TODAY = new Date().toISOString().slice(0, 10);
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const proposalPage = paginatedSchema(proposalSchema);
const activityPage = paginatedSchema(activitySummarySchema);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Progression, compétences, programme et présences (intégration PostgreSQL)', () => {
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

  async function createUser(role: Role) {
    counter += 1;
    return prisma.user.create({
      data: {
        email: `progression${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        passwordHash,
      },
    });
  }

  async function login(user: { id: string; email: string }) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const write = (method: 'post' | 'patch' | 'put', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
      put: (path: string, body: object) => write('put', path, body),
    };
  }

  const loginAs = async (role: Role) => login(await createUser(role));
  type Client = Awaited<ReturnType<typeof loginAs>>;

  const createScout = (responsable: Client, n: number, extra: object = {}) =>
    json(
      responsable.post('/scouts', {
        firstName: 'Routier',
        lastName: `Fictif${n}`,
        joinedAt: '2026-10-01',
        currentStageId: stages.NOVICIAT,
        ...extra,
      }),
      201,
      scoutDetailSchema,
    );

  const progressionOf = (client: Client, scoutId: string) =>
    json(client.get(`/scouts/${scoutId}/progression`), 200, scoutProgressionSchema);

  const createCompetency = (responsable: Client, code: string, extra: object = {}) =>
    json(
      responsable.post('/competencies', {
        code,
        name: `Compétence fictive ${code}`,
        stageId: stages.NOVICIAT,
        observableCriteria: ['Critère observable fictif'],
        ...extra,
      }),
      201,
      competencySchema,
    );

  const observe = (chef: Client, scoutId: string, text = 'Observation fictive de service.') =>
    json(
      chef.post(`/scouts/${scoutId}/observations`, { observedOn: '2026-10-20', content: text }),
      201,
      observationSchema,
    );

  async function publishedModule(chef: Client, responsable: Client, title = 'Module fictif') {
    let module = await json(
      chef.post('/editor/modules', { title, summary: 'Résumé fictif.', stageId: stages.NOVICIAT }),
      201,
      editorModuleDetailSchema,
    );
    module = await json(
      chef.post(`/editor/modules/${module.id}/lessons`, {
        versionId: module.current.id,
        title: 'Leçon 1',
        content: paragraph('Contenu fictif'),
      }),
      201,
      editorModuleDetailSchema,
    );
    module = await json(
      chef.post(`/editor/modules/${module.id}/submit`, {
        versionId: module.current.id,
        revision: module.current.revision,
      }),
      201,
      editorModuleDetailSchema,
    );
    const versionId = module.current.id;
    await responsable.post(`/admin/modules/${module.id}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${module.id}/publish`, { versionId }).expect(204);
    return module;
  }

  /** Tentative d'évaluation acceptée, insérée directement (le moteur de quiz est testé en phase 3). */
  async function acceptedAttempt(scoutProfileId: string, createdById: string) {
    const evaluation = await prisma.evaluation.create({
      data: { title: 'Quiz fictif', stageId: stages.NOVICIAT!, createdById },
    });
    const version = await prisma.evaluationVersion.create({
      data: { evaluationId: evaluation.id, version: 1, title: 'Quiz fictif', createdById },
    });
    return prisma.evaluationAttempt.create({
      data: {
        code: `NT-2026-${String(++counter).padStart(6, '0')}`,
        scoutProfileId,
        evaluationId: evaluation.id,
        evaluationVersionId: version.id,
        mode: 'PAPIER',
        status: 'VALIDEE',
        score: 10,
        maxScore: 10,
        createdById,
        decidedById: createdById,
        decidedAt: new Date(),
      },
    });
  }

  const realisedActivity = async (chef: Client, title = 'Activité fictive', extra: object = {}) => {
    const created = await json(
      chef.post('/activities', { title, plannedOn: daysFromToday(-3), ...extra }),
      201,
      activityDetailSchema,
    );
    return json(
      chef.post(`/activities/${created.id}/status`, {
        status: 'REALISEE',
        revision: created.revision,
        heldOn: daysFromToday(-3),
      }),
      201,
      activityDetailSchema,
    );
  };

  // ─── 1, 2, 7, 8 : progression et historique des étapes ─────────────────────

  describe('Progression et changements d’étape', () => {
    it('suit un routier sans compte : historique, décision transactionnelle, correction tracée', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      expect(scout.hasAccount).toBe(false);

      let progression = await progressionOf(chef, scout.id);
      expect(progression.scout).toMatchObject({ hasAccount: false, stageSince: '2026-10-01' });
      expect(progression.stageChanges).toHaveLength(1);
      expect(progression.stageChanges[0]).toMatchObject({
        kind: 'INSCRIPTION',
        to: { code: 'NOVICIAT' },
      });

      const decision = {
        expectedCurrentStageId: stages.NOVICIAT,
        toStageId: stages.APPRENTISSAGE,
        effectiveOn: '2026-10-25',
        reason: 'Décision fictive après examen des acquis.',
        ceremonyReference: 'Cérémonie fictive du 25 octobre',
        confirm: true,
      };
      // Chef : refusé ; sans confirmation : refusé ; étape lue périmée : refusé.
      expect(await errorCode(chef.post(`/scouts/${scout.id}/stage-changes`, decision), 403)).toBe(
        'FORBIDDEN',
      );
      await responsable
        .post(`/scouts/${scout.id}/stage-changes`, { ...decision, confirm: false })
        .expect(400);
      expect(
        await errorCode(
          responsable.post(`/scouts/${scout.id}/stage-changes`, {
            ...decision,
            expectedCurrentStageId: stages.COMPAGNONNAGE,
          }),
          409,
        ),
      ).toBe('STAGE_CHANGED_MEANWHILE');
      expect(
        await errorCode(
          responsable.post(`/scouts/${scout.id}/stage-changes`, {
            ...decision,
            effectiveOn: daysFromToday(5),
          }),
          422,
        ),
      ).toBe('EFFECTIVE_DATE_IN_FUTURE');
      // L'ancienne voie (modification de fiche) ne change plus l'étape.
      expect(
        await errorCode(
          responsable.patch(`/scouts/${scout.id}`, { currentStageId: stages.APPRENTISSAGE }),
          422,
        ),
      ).toBe('STAGE_CHANGE_REQUIRES_DECISION');
      expect((await progressionOf(chef, scout.id)).stageChanges).toHaveLength(1);

      const change = await json(
        responsable.post(`/scouts/${scout.id}/stage-changes`, decision),
        201,
        stageChangeSchema,
      );
      expect(change).toMatchObject({
        kind: 'DECISION',
        from: { code: 'NOVICIAT' },
        to: { code: 'APPRENTISSAGE' },
        effectiveOn: '2026-10-25',
        decidedBy: { id: responsable.user.id },
        ceremonyReference: 'Cérémonie fictive du 25 octobre',
      });
      progression = await progressionOf(chef, scout.id);
      expect(progression.scout).toMatchObject({
        stage: { code: 'APPRENTISSAGE' },
        stageSince: '2026-10-25',
      });
      expect(
        await prisma.auditLog.count({
          where: { action: 'scout_profile.stage_changed', entityId: scout.id },
        }),
      ).toBe(1);

      // Correction exceptionnelle de la dernière décision : nouvelle entrée, l'ancienne reste visible.
      const correction = await json(
        responsable.post(`/scouts/${scout.id}/stage-changes`, {
          ...decision,
          expectedCurrentStageId: stages.APPRENTISSAGE,
          toStageId: stages.NOVICIAT,
          reason: 'Correction fictive : décision saisie par erreur.',
          correctsChangeId: change.id,
        }),
        201,
        stageChangeSchema,
      );
      expect(correction).toMatchObject({ kind: 'CORRECTION', correctsChangeId: change.id });
      progression = await progressionOf(chef, scout.id);
      expect(progression.stageChanges.map((row) => row.kind)).toEqual([
        'CORRECTION',
        'DECISION',
        'INSCRIPTION',
      ]);
      expect(progression.stageChanges[1]?.correctedByChangeId).toBe(correction.id);
      expect(
        await errorCode(
          responsable.post(`/scouts/${scout.id}/stage-changes`, {
            ...decision,
            expectedCurrentStageId: stages.NOVICIAT,
            correctsChangeId: change.id,
          }),
          409,
        ),
      ).toBe('CORRECTION_NOT_LATEST');

      // Historique immuable en base (aucune suppression silencieuse).
      await expect(
        prisma.scoutStageChange.deleteMany({ where: { scoutProfileId: scout.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.scoutStageChange.update({ where: { id: change.id }, data: { reason: 'Réécrit' } }),
      ).rejects.toThrow();
    });

    it('sérialise deux décisions concurrentes : une seule est enregistrée', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const scout = await createScout(responsable, 2);
      const body = {
        expectedCurrentStageId: stages.NOVICIAT,
        effectiveOn: TODAY,
        reason: 'Décision fictive concurrente.',
        confirm: true,
      };
      const results = await Promise.all([
        responsable.post(`/scouts/${scout.id}/stage-changes`, {
          ...body,
          toStageId: stages.APPRENTISSAGE,
        }),
        responsable.post(`/scouts/${scout.id}/stage-changes`, {
          ...body,
          toStageId: stages.COMPAGNONNAGE,
        }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      const profile = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
      const changes = await prisma.scoutStageChange.findMany({
        where: { scoutProfileId: scout.id },
      });
      expect(changes).toHaveLength(2); // inscription + une seule décision
      expect(
        changes.some((row) => row.toStageId === profile.currentStageId && row.kind === 'DECISION'),
      ).toBe(true);
    });

    it('conserve l’historique après un changement d’équipe et le rattachement d’un compte', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const scout = await createScout(responsable, 3);
      const teamA = await json(
        responsable.post('/teams', { name: 'Équipe fictive A' }),
        201,
        teamDetailSchema,
      );
      const teamB = await json(
        responsable.post('/teams', { name: 'Équipe fictive B' }),
        201,
        teamDetailSchema,
      );
      await responsable.post(`/scouts/${scout.id}/teams/assign`, { teamId: teamA.id }).expect(201);
      await responsable
        .post(`/scouts/${scout.id}/stage-changes`, {
          expectedCurrentStageId: stages.NOVICIAT,
          toStageId: stages.APPRENTISSAGE,
          effectiveOn: TODAY,
          reason: 'Décision fictive.',
          confirm: true,
        })
        .expect(201);
      await responsable
        .post(`/scouts/${scout.id}/teams/assign`, {
          teamId: teamB.id,
          startedAt: new Date(Date.now() + 1000).toISOString(),
        })
        .expect(201);

      const account = await createUser('ROUTIER');
      await responsable
        .post(`/scouts/${scout.id}/link-account`, { email: account.email })
        .expect(201);
      const timeline = await json(
        responsable.get(`/scouts/${scout.id}/timeline`),
        200,
        scoutTimelineSchema,
      );
      const kinds = timeline.items.map((item) => item.kind);
      expect(kinds.filter((kind) => kind === 'EQUIPE').length).toBeGreaterThanOrEqual(3);
      expect(kinds.filter((kind) => kind === 'ETAPE')).toHaveLength(2);
      expect(kinds).toContain('COMPTE');

      // Le routier retrouve le même historique via son compte (aucun second profil).
      const routier = await login(account);
      const mine = await json(routier.get('/me/progression'), 200, myProgressionSchema);
      expect(mine.scout).toMatchObject({
        stage: { code: 'APPRENTISSAGE' },
        team: { id: teamB.id },
      });
      expect(mine.stageChanges).toHaveLength(2);
      expect(await prisma.scoutProfile.count()).toBe(1);
    });
  });

  // ─── 3, 4, 5, 6 : compétences ─────────────────────────────────────────────

  describe('Compétences et validation officielle', () => {
    it('un chef propose ; seul le responsable valide, après complément ; décision révocable', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const otherChef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const other = await createScout(responsable, 2);

      await chef.post('/competencies', { code: 'X-1', name: 'Interdit' }).expect(403);
      const competency = await createCompetency(responsable, 'serv-01', { minEvidenceCount: 2 });
      expect(competency.code).toBe('SERV-01');

      const observation = await observe(chef, scout.id);
      const foreign = await observe(chef, other.id);
      const base = {
        scoutProfileId: scout.id,
        competencyId: competency.id,
        justification: 'Proposition fictive appuyée sur des faits observés.',
      };
      expect(
        await errorCode(
          chef.post('/competency-proposals', {
            ...base,
            evidences: [{ kind: 'OBSERVATION', observationId: observation.id }],
          }),
          422,
        ),
      ).toBe('NOT_ENOUGH_EVIDENCE');
      expect(
        await errorCode(
          chef.post('/competency-proposals', {
            ...base,
            evidences: [
              { kind: 'OBSERVATION', observationId: foreign.id },
              { kind: 'AUTRE', description: 'Service fictif rendu.' },
            ],
          }),
          422,
        ),
      ).toBe('INVALID_EVIDENCE');
      expect(await prisma.competencyProposal.count()).toBe(0); // transaction annulée

      let proposal = await json(
        chef.post('/competency-proposals', {
          ...base,
          evidences: [
            { kind: 'OBSERVATION', observationId: observation.id },
            { kind: 'AUTRE', description: 'Service fictif rendu à la paroisse.' },
          ],
        }),
        201,
        proposalSchema,
      );
      expect(proposal).toMatchObject({ status: 'EN_ATTENTE', canEdit: true, canDecide: false });
      expect(proposal.evidences).toHaveLength(2);
      expect(
        await errorCode(
          chef.post('/competency-proposals', {
            ...base,
            evidences: [
              { kind: 'AUTRE', description: 'Bis' },
              { kind: 'AUTRE', description: 'Ter' },
            ],
          }),
          409,
        ),
      ).toBe('PROPOSAL_ALREADY_OPEN');
      expect((await progressionOf(chef, scout.id)).competencies[0]?.status).toBe('PROPOSE');

      // Validation réservée au responsable (refus pour un chef, aucune écriture).
      const decision = { revision: proposal.revision, comment: 'Justification fictive.' };
      expect(
        await errorCode(chef.post(`/competency-proposals/${proposal.id}/approve`, decision), 403),
      ).toBe('FORBIDDEN');
      await chef.post(`/competency-proposals/${proposal.id}/reject`, decision).expect(403);
      expect(await prisma.competencyValidation.count()).toBe(0);

      // Complément demandé → ajout d'une preuve par l'auteur (pas par un autre chef) → resoumission.
      proposal = await json(
        responsable.post(`/competency-proposals/${proposal.id}/request-complement`, decision),
        201,
        proposalSchema,
      );
      expect(proposal.status).toBe('COMPLEMENT_DEMANDE');
      await otherChef
        .post(`/competency-proposals/${proposal.id}/evidences`, {
          revision: proposal.revision,
          evidences: [{ kind: 'AUTRE', description: 'Intrusion' }],
        })
        .expect(403);
      proposal = await json(
        chef.post(`/competency-proposals/${proposal.id}/evidences`, {
          revision: proposal.revision,
          evidences: [{ kind: 'AUTRE', description: 'Nouvelle observation fictive en camp.' }],
        }),
        201,
        proposalSchema,
      );
      proposal = await json(
        chef.post(`/competency-proposals/${proposal.id}/resubmit`, { revision: proposal.revision }),
        201,
        proposalSchema,
      );
      expect(proposal.status).toBe('EN_ATTENTE');
      expect(
        await errorCode(
          responsable.post(`/competency-proposals/${proposal.id}/approve`, decision),
          409,
        ),
      ).toBe('EDIT_CONFLICT'); // révision périmée

      proposal = await json(
        responsable.post(`/competency-proposals/${proposal.id}/approve`, {
          revision: proposal.revision,
          comment: 'Acquis constaté sur trois éléments fictifs.',
        }),
        201,
        proposalSchema,
      );
      expect(proposal).toMatchObject({ status: 'APPROUVEE', validation: { decision: 'ACQUIS' } });
      expect(proposal.events.map((event) => event.action)).toEqual([
        'SOUMISE',
        'COMPLEMENT_DEMANDE',
        'PREUVE_AJOUTEE',
        'RESOUMISE',
        'APPROUVEE',
      ]);
      const validation = await prisma.competencyValidation.findFirstOrThrow();
      expect(validation).toMatchObject({
        decidedById: responsable.user.id,
        justification: 'Acquis constaté sur trois éléments fictifs.',
      });
      expect(validation.examinedEvidence).toHaveLength(3);
      expect(await prisma.auditLog.count({ where: { action: 'competency.validated' } })).toBe(1);
      expect((await progressionOf(chef, scout.id)).competencies[0]).toMatchObject({
        status: 'ACQUIS',
      });
      expect(
        await errorCode(
          chef.post('/competency-proposals', {
            ...base,
            evidences: [
              { kind: 'AUTRE', description: 'Bis' },
              { kind: 'AUTRE', description: 'Ter' },
            ],
          }),
          409,
        ),
      ).toBe('COMPETENCY_ALREADY_ACQUIRED');

      // Décision officielle jamais supprimée ni réécrite ; révocation motivée et unique.
      await expect(
        prisma.competencyValidation.delete({ where: { id: validation.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.competencyValidation.update({
          where: { id: validation.id },
          data: { justification: 'x' },
        }),
      ).rejects.toThrow();
      await chef
        .post(`/competency-validations/${validation.id}/revoke`, { reason: 'Essai' })
        .expect(403);
      const revoked = await json(
        responsable.post(`/competency-validations/${validation.id}/revoke`, {
          reason: 'Erreur fictive de saisie.',
        }),
        201,
        competencyValidationSchema,
      );
      expect(revoked.revokedBy?.id).toBe(responsable.user.id);
      expect(
        await errorCode(
          responsable.post(`/competency-validations/${validation.id}/revoke`, { reason: 'Encore' }),
          409,
        ),
      ).toBe('VALIDATION_ALREADY_REVOKED');
      const after = await progressionOf(chef, scout.id);
      expect(after.competencies[0]?.status).not.toBe('ACQUIS');
      expect(after.validations[0]?.revokedAt).not.toBeNull();
    });

    it('un refus motivé rend la compétence « à retravailler » et le signale à l’encadrement', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const competency = await createCompetency(responsable, 'VIE-01');
      const proposal = await json(
        chef.post('/competency-proposals', {
          scoutProfileId: scout.id,
          competencyId: competency.id,
          justification: 'Proposition fictive.',
          evidences: [{ kind: 'AUTRE', description: 'Élément fictif.' }],
        }),
        201,
        proposalSchema,
      );
      const rejected = await json(
        responsable.post(`/competency-proposals/${proposal.id}/reject`, {
          revision: proposal.revision,
          comment: 'Éléments insuffisants (fictif).',
        }),
        201,
        proposalSchema,
      );
      expect(rejected).toMatchObject({
        status: 'REFUSEE',
        validation: { decision: 'A_RETRAVAILLER' },
      });
      expect((await progressionOf(chef, scout.id)).competencies[0]?.status).toBe('A_RETRAVAILLER');
      const mine = await json(
        chef.get('/competency-proposals?mine=true&status=closed'),
        200,
        proposalPage,
      );
      expect(mine.items[0]?.decisionComment).toBe('Éléments insuffisants (fictif).');
      const dashboard = await json(
        responsable.get('/dashboard/responsable'),
        200,
        responsableDashboardSchema,
      );
      expect(dashboard.followUp.find((item) => item.scout.id === scout.id)?.reasons).toContain(
        'COMPETENCE_A_RETRAVAILLER',
      );
      const retry = await json(
        chef.post('/competency-proposals', {
          scoutProfileId: scout.id,
          competencyId: competency.id,
          justification: 'Nouveaux éléments fictifs.',
          evidences: [{ kind: 'AUTRE', description: 'Nouvelle observation fictive.' }],
        }),
        201,
        proposalSchema,
      );
      await responsable
        .post(`/competency-proposals/${retry.id}/approve`, {
          revision: retry.revision,
          comment: 'Acquis après accompagnement fictif.',
        })
        .expect(201);
      const updatedStats = await json(responsable.get('/statistics'), 200, statisticsSchema);
      expect(updatedStats.competencies).toMatchObject({ acquired: 1, toRework: 0 });
    });

    it('un quiz réussi ne valide jamais une compétence ni une étape (preuve seulement)', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const competency = await createCompetency(responsable, 'TECH-01');
      const attempt = await acceptedAttempt(scout.id, chef.user.id);

      const progression = await progressionOf(chef, scout.id);
      expect(progression.attempts[0]).toMatchObject({
        code: attempt.code,
        status: 'VALIDEE',
        score: 10,
      });
      expect(progression.competencies[0]?.status).toBe('NON_EVALUE');
      expect(progression.scout.stage?.code).toBe('NOVICIAT');
      expect(await prisma.competencyValidation.count()).toBe(0);
      expect(await prisma.competencyProposal.count()).toBe(0);

      // Le résultat sert d'élément justificatif d'une proposition humaine.
      const proposal = await json(
        chef.post('/competency-proposals', {
          scoutProfileId: scout.id,
          competencyId: competency.id,
          justification: 'Résultat accepté et pratique observée (fictif).',
          evidences: [{ kind: 'EVALUATION', attemptId: attempt.id }],
        }),
        201,
        proposalSchema,
      );
      expect(proposal.evidences[0]?.label).toContain(attempt.code);
      expect((await progressionOf(chef, scout.id)).competencies[0]?.status).toBe('PROPOSE');
    });
  });

  // ─── 9 : études de modules ─────────────────────────────────────────────────

  describe('Modules étudiés', () => {
    it('enregistre un cours papier pour un routier sans compte, sans valider la compétence liée', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const otherChef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const module = await publishedModule(chef, responsable);
      const competency = await createCompetency(responsable, 'SPI-01', { moduleIds: [module.id] });
      const path = `/scouts/${scout.id}/module-studies`;
      const body = {
        moduleId: module.id,
        mode: 'COURS_PAPIER',
        studiedOn: TODAY,
        observation: 'Séance fictive.',
      };

      const study = await json(chef.post(path, body), 201, moduleStudySchema);
      expect(study).toMatchObject({
        mode: 'COURS_PAPIER',
        moduleVersion: 1,
        selfDeclared: false,
        recordedBy: { id: chef.user.id },
      });
      expect(await errorCode(chef.post(path, body), 409)).toBe('STUDY_ALREADY_RECORDED');
      expect(await errorCode(chef.post(path, { ...body, studiedOn: daysFromToday(3) }), 422)).toBe(
        'STUDY_DATE_IN_FUTURE',
      );
      const draft = await json(
        chef.post('/editor/modules', { title: 'Brouillon fictif' }),
        201,
        editorModuleDetailSchema,
      );
      expect(await errorCode(chef.post(path, { ...body, moduleId: draft.id }), 422)).toBe(
        'MODULE_NOT_PUBLISHED',
      );

      const progression = await progressionOf(chef, scout.id);
      expect(progression.moduleStudies).toHaveLength(1);
      expect(
        progression.competencies.find((item) => item.competency.id === competency.id)?.status,
      ).toBe('EN_COURS');

      await otherChef.post(`/module-studies/${study.id}/cancel`, { reason: 'Essai' }).expect(403);
      const cancelled = await json(
        chef.post(`/module-studies/${study.id}/cancel`, { reason: 'Saisie en double (fictif).' }),
        201,
        moduleStudySchema,
      );
      expect(cancelled.cancelledAt).not.toBeNull();
      await expect(prisma.moduleStudy.delete({ where: { id: study.id } })).rejects.toThrow();
    });

    it('un routier déclare sa lecture numérique ; il ne saisit rien pour un autre', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const account = await createUser('ROUTIER');
      const scout = await createScout(responsable, 1);
      await responsable
        .post(`/scouts/${scout.id}/link-account`, { email: account.email })
        .expect(201);
      const routier = await login(account);
      const module = await publishedModule(chef, responsable);

      const publishedOptions = await routier.get('/progression/published-modules').expect(200);
      expect(publishedOptions.body).toMatchObject({ items: [{ id: module.id }] });
      const study = await json(
        routier.post('/me/module-studies', { moduleId: module.id }),
        201,
        moduleStudySchema,
      );
      expect(study).toMatchObject({ mode: 'LECTURE_NUMERIQUE', selfDeclared: true });
      await routier
        .post(`/scouts/${scout.id}/module-studies`, {
          moduleId: module.id,
          mode: 'COURS_PAPIER',
          studiedOn: TODAY,
        })
        .expect(403);
      const mine = await json(routier.get('/me/progression'), 200, myProgressionSchema);
      expect(mine.moduleStudies).toHaveLength(1);
      expect(mine.moduleStudies[0]).not.toHaveProperty('recordedBy');
    });
  });

  // ─── 10 : programme annuel ─────────────────────────────────────────────────

  describe('Programme annuel', () => {
    const table = (theme = 'Thème fictif') =>
      [
        '| Date | Catégories | Thème | Activité | Objectifs |',
        '| --- | --- | --- | --- | --- |',
        `| ${daysFromToday(10)} | Novices Routiers | ${theme} | Séance fictive A | Objectif fictif |`,
        `| ${daysFromToday(17)} | Aspirants Routiers, Compagnons Routiers | | Séance fictive B | |`,
      ].join('\n');

    it('prévisualise sans écrire, importe sans doublon et conserve les séances modifiées', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const programme = (await json(responsable.get('/programmes'), 200, programmeListSchema))
        .items[0]!;
      const path = `/programmes/${programme.id}/import`;

      await chef.post(`${path}/preview`, { content: table() }).expect(403);
      await chef.post(path, { content: table() }).expect(403);

      // Erreur (catégorie inconnue) : signalée, et l'import est refusé tant qu'elle subsiste.
      const invalid = `${table()}\n| ${daysFromToday(24)} | Catégorie inventée | | Séance fictive C | |`;
      const invalidPreview = await json(
        responsable.post(`${path}/preview`, { content: invalid }),
        201,
        programmeImportReportSchema,
      );
      expect(invalidPreview.counts).toMatchObject({ CREER: 2, ERREUR: 1 });
      expect(await errorCode(responsable.post(path, { content: invalid }), 422)).toBe(
        'IMPORT_HAS_ERRORS',
      );
      expect(await prisma.activity.count()).toBe(0);

      const preview = await json(
        responsable.post(`${path}/preview`, { content: table() }),
        201,
        programmeImportReportSchema,
      );
      expect(preview).toMatchObject({ applied: false, counts: { CREER: 2 } });
      expect(await prisma.activity.count()).toBe(0);

      const first = await json(
        responsable.post(path, { content: table() }),
        201,
        programmeImportReportSchema,
      );
      expect(first).toMatchObject({ applied: true, counts: { CREER: 2 } });
      const second = await json(
        responsable.post(path, { content: table() }),
        201,
        programmeImportReportSchema,
      );
      expect(second.counts).toMatchObject({ CREER: 0, INCHANGEE: 2 });
      expect(await prisma.activity.count()).toBe(2);

      const updated = await json(
        responsable.post(path, { content: table('Thème révisé') }),
        201,
        programmeImportReportSchema,
      );
      expect(updated.counts).toMatchObject({ METTRE_A_JOUR: 1, INCHANGEE: 1 });

      // Une séance modifiée à la main n'est plus remplacée.
      const list = await json(
        chef.get(`/activities?programmeId=${programme.id}`),
        200,
        activityPage,
      );
      const sessionA = await json(
        chef.get(`/activities/${list.items[0]!.id}`),
        200,
        activityDetailSchema,
      );
      expect(sessionA).toMatchObject({
        origin: 'PROGRAMME',
        imported: true,
        theme: 'Thème révisé',
      });
      await chef
        .patch(`/activities/${sessionA.id}`, {
          revision: sessionA.revision,
          theme: 'Thème ajusté par le chef',
        })
        .expect(200);
      const third = await json(
        responsable.post(path, { content: table('Autre thème') }),
        201,
        programmeImportReportSchema,
      );
      expect(third.counts).toMatchObject({ CONSERVEE_MANUELLE: 1 });
      expect((await prisma.activity.findUniqueOrThrow({ where: { id: sessionA.id } })).theme).toBe(
        'Thème ajusté par le chef',
      );
      expect(await prisma.activity.count()).toBe(2);
      const another = await prisma.programme.create({
        data: { code: 'autre-test', title: 'Autre programme fictif' },
      });
      const crossProgramme = await json(
        responsable.post(`/programmes/${another.id}/import/preview`, { content: table() }),
        201,
        programmeImportReportSchema,
      );
      expect(crossProgramme.counts.ERREUR).toBe(2);
      await responsable.post(`/programmes/${another.id}/import`, { content: table() }).expect(422);
    });

    it('la correspondance catégories ↔ étapes reste à confirmer par le responsable', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const categories = await json(
        chef.get('/programmes/categories'),
        200,
        programmeCategoryListSchema,
      );
      expect(categories.items).toHaveLength(4);
      expect(categories.items.every((item) => !item.correspondenceValidated)).toBe(true);
      const novices = categories.items[0]!;
      await chef
        .patch(`/programmes/categories/${novices.id}`, { correspondenceValidated: true })
        .expect(403);
      const after = await json(
        responsable.patch(`/programmes/categories/${novices.id}`, {
          correspondenceValidated: true,
        }),
        200,
        programmeCategoryListSchema,
      );
      expect(after.items[0]).toMatchObject({
        correspondenceValidated: true,
        stage: { code: 'NOVICIAT' },
      });
      // Changer l'étape remet la correspondance « à confirmer ».
      const changed = await json(
        responsable.patch(`/programmes/categories/${novices.id}`, {
          stageId: stages.APPRENTISSAGE,
        }),
        200,
        programmeCategoryListSchema,
      );
      expect(changed.items[0]).toMatchObject({
        correspondenceValidated: false,
        stage: { code: 'APPRENTISSAGE' },
      });
    });
  });

  // ─── 11 : activités ────────────────────────────────────────────────────────

  describe('Activités', () => {
    it('met à jour le statut et le compte rendu, avec historique et contrôle de révision', async () => {
      const chef = await loginAs('CHEF');
      const routier = await loginAs('ROUTIER');
      await routier.post('/activities', { title: 'Interdit', plannedOn: TODAY }).expect(403);
      const created = await json(
        chef.post('/activities', {
          title: 'Service fictif',
          plannedOn: daysFromToday(7),
          objectives: ['Servir'],
        }),
        201,
        activityDetailSchema,
      );
      expect(created).toMatchObject({ origin: 'SUPPLEMENTAIRE', status: 'PLANIFIEE' });

      const postponed = await json(
        chef.post(`/activities/${created.id}/status`, {
          status: 'REPORTEE',
          revision: created.revision,
          postponedTo: daysFromToday(14),
          reason: 'Pluie (fictif).',
        }),
        201,
        activityDetailSchema,
      );
      expect(postponed).toMatchObject({
        status: 'REPORTEE',
        plannedOn: daysFromToday(14),
        statusReason: 'Pluie (fictif).',
      });
      expect(
        await errorCode(
          chef.post(`/activities/${created.id}/status`, {
            status: 'ANNULEE',
            revision: created.revision,
            reason: 'Périmé',
          }),
          409,
        ),
      ).toBe('EDIT_CONFLICT');
      expect(
        await errorCode(
          chef.post(`/activities/${created.id}/status`, {
            status: 'REALISEE',
            revision: postponed.revision,
            heldOn: daysFromToday(2),
          }),
          422,
        ),
      ).toBe('HELD_DATE_IN_FUTURE');
      const realised = await json(
        chef.post(`/activities/${created.id}/status`, {
          status: 'REALISEE',
          revision: postponed.revision,
          heldOn: TODAY,
          location: 'Paroisse fictive',
        }),
        201,
        activityDetailSchema,
      );
      expect(realised).toMatchObject({
        status: 'REALISEE',
        heldOn: TODAY,
        location: 'Paroisse fictive',
      });
      expect(
        await errorCode(
          chef.post(`/activities/${created.id}/status`, {
            status: 'ANNULEE',
            revision: realised.revision,
            reason: 'Trop tard',
          }),
          409,
        ),
      ).toBe('INVALID_ACTIVITY_TRANSITION');

      const reported = await json(
        chef.patch(`/activities/${created.id}`, {
          revision: realised.revision,
          plannedOn: realised.plannedOn,
          contentDone: 'Contenu réalisé fictif.',
          difficulties: 'Aucune.',
          report: 'Compte rendu fictif.',
        }),
        200,
        activityDetailSchema,
      );
      expect(reported).toMatchObject({
        report: 'Compte rendu fictif.',
        imported: false,
        manuallyEditedAt: null,
      });
      expect(reported.events.map((event) => event.action)).toEqual([
        'MODIFIEE',
        'STATUT_MODIFIE',
        'STATUT_MODIFIE',
        'CREEE',
      ]);
      expect(reported.events[0]?.fields).toEqual(expect.arrayContaining(['contentDone', 'report']));
      expect(
        await errorCode(
          chef.patch(`/activities/${created.id}`, {
            revision: reported.revision,
            plannedOn: daysFromToday(20),
          }),
          409,
        ),
      ).toBe('ACTIVITY_ALREADY_HELD');
      await expect(prisma.activity.delete({ where: { id: created.id } })).rejects.toThrow();
      await expect(
        prisma.activityEvent.deleteMany({ where: { activityId: created.id } }),
      ).rejects.toThrow();
    });
  });

  // ─── 12, 13, 14 : présences ────────────────────────────────────────────────

  describe('Présences', () => {
    it('saisie groupée, sans doublon, en distinguant absence et non-renseignement', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const routier = await loginAs('ROUTIER');
      const [a, b, c] = [
        await createScout(responsable, 1),
        await createScout(responsable, 2),
        await createScout(responsable, 3),
      ];

      const future = await json(
        chef.post('/activities', { title: 'Future', plannedOn: daysFromToday(5) }),
        201,
        activityDetailSchema,
      );
      expect(
        await errorCode(
          chef.put(`/activities/${future.id}/attendance`, {
            entries: [{ scoutProfileId: a.id, status: 'PRESENT' }],
          }),
          409,
        ),
      ).toBe('ATTENDANCE_NOT_EDITABLE');

      const activity = await realisedActivity(chef);
      const path = `/activities/${activity.id}/attendance`;
      let sheet = await json(chef.get(path), 200, attendanceSheetSchema);
      expect(sheet.editable).toBe(true);
      expect(sheet.entries.map((entry) => entry.status)).toEqual([
        'NON_RENSEIGNE',
        'NON_RENSEIGNE',
        'NON_RENSEIGNE',
      ]);

      await chef
        .put(path, {
          entries: [
            { scoutProfileId: a.id, status: 'PRESENT' },
            { scoutProfileId: a.id, status: 'ABSENT' },
          ],
        })
        .expect(400);
      await routier
        .put(path, { entries: [{ scoutProfileId: a.id, status: 'PRESENT' }] })
        .expect(403);
      await routier.get(path).expect(403);

      sheet = await json(
        chef.put(path, {
          entries: [
            { scoutProfileId: a.id, status: 'PRESENT' },
            { scoutProfileId: b.id, status: 'ABSENT', note: 'Sans nouvelles' },
          ],
        }),
        200,
        attendanceSheetSchema,
      );
      const statusOf = (id: string) => sheet.entries.find((entry) => entry.scout.id === id)?.status;
      expect([statusOf(a.id), statusOf(b.id), statusOf(c.id)]).toEqual([
        'PRESENT',
        'ABSENT',
        'NON_RENSEIGNE',
      ]);
      expect(sheet.activity.attendance).toEqual({ present: 1, absent: 1, excused: 0 });

      // Correction : mise à jour de la ligne existante, jamais une seconde ligne.
      sheet = await json(
        chef.put(path, { entries: [{ scoutProfileId: b.id, status: 'EXCUSE' }] }),
        200,
        attendanceSheetSchema,
      );
      expect(statusOf(b.id)).toBe('EXCUSE');
      expect(await prisma.activityAttendance.count({ where: { activityId: activity.id } })).toBe(2);
      await expect(
        prisma.activityAttendance.create({
          data: {
            activityId: activity.id,
            scoutProfileId: a.id,
            status: 'ABSENT',
            recordedById: chef.user.id,
          },
        }),
      ).rejects.toThrow();
      const detail = await json(chef.get(`/activities/${activity.id}`), 200, activityDetailSchema);
      expect(
        detail.events.filter((event) => event.action === 'PRESENCES_ENREGISTREES'),
      ).toHaveLength(2);

      // La présence sert de preuve uniquement si le routier était présent.
      const competency = await createCompetency(responsable, 'EQ-01');
      expect(
        await errorCode(
          chef.post('/competency-proposals', {
            scoutProfileId: c.id,
            competencyId: competency.id,
            justification: 'Fictif.',
            evidences: [{ kind: 'ACTIVITE', activityId: activity.id }],
          }),
          422,
        ),
      ).toBe('INVALID_EVIDENCE');
      await chef
        .post('/competency-proposals', {
          scoutProfileId: a.id,
          competencyId: competency.id,
          justification: 'Fictif.',
          evidences: [{ kind: 'ACTIVITE', activityId: activity.id }],
        })
        .expect(201);
    });
  });

  // ─── 15 à 18 : permissions, statistiques, filtres, tableaux de bord ────────

  describe('Tableaux de bord, statistiques et permissions', () => {
    it('calcule des indicateurs exacts par équipe et par étape, avec filtres', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const teamA = await json(
        responsable.post('/teams', { name: 'Équipe fictive A' }),
        201,
        teamDetailSchema,
      );
      const teamB = await json(
        responsable.post('/teams', { name: 'Équipe fictive B' }),
        201,
        teamDetailSchema,
      );
      const s1 = await createScout(responsable, 1, { teamId: teamA.id });
      const s2 = await createScout(responsable, 2, {
        teamId: teamA.id,
        currentStageId: stages.APPRENTISSAGE,
      });
      const s3 = await createScout(responsable, 3, { teamId: teamB.id });
      await createScout(responsable, 4); // sans équipe
      const inactive = await createScout(responsable, 5, { teamId: teamB.id });
      await responsable.post(`/scouts/${inactive.id}/deactivate`).expect(201);
      const account = await createUser('ROUTIER');
      await responsable.post(`/scouts/${s1.id}/link-account`, { email: account.email }).expect(201);

      const competency = await createCompetency(responsable, 'SERV-01');
      const proposal = await json(
        chef.post('/competency-proposals', {
          scoutProfileId: s1.id,
          competencyId: competency.id,
          justification: 'Fictif.',
          evidences: [{ kind: 'AUTRE', description: 'Élément fictif.' }],
        }),
        201,
        proposalSchema,
      );
      await responsable
        .post(`/competency-proposals/${proposal.id}/approve`, {
          revision: proposal.revision,
          comment: 'Validé (fictif).',
        })
        .expect(201);
      await chef
        .post('/competency-proposals', {
          scoutProfileId: s3.id,
          competencyId: competency.id,
          justification: 'Fictif.',
          evidences: [{ kind: 'AUTRE', description: 'Élément fictif.' }],
        })
        .expect(201);

      const activity = await realisedActivity(chef, 'Séance fictive');
      await chef
        .put(`/activities/${activity.id}/attendance`, {
          entries: [
            { scoutProfileId: s1.id, status: 'PRESENT' },
            { scoutProfileId: s2.id, status: 'PRESENT' },
            { scoutProfileId: s3.id, status: 'ABSENT' },
          ],
        })
        .expect(200);
      await chef
        .post('/activities', { title: 'Sans présences', plannedOn: daysFromToday(-1) })
        .expect(201);
      await chef.post('/activities', { title: 'À venir', plannedOn: daysFromToday(4) }).expect(201);

      const stats = await json(chef.get('/statistics'), 200, statisticsSchema);
      expect(stats.scouts).toEqual({
        total: 5,
        active: 4,
        withAccount: 1,
        withoutAccount: 3,
        withoutTeam: 1,
        withoutStage: 0,
      });
      const teamStats = Object.fromEntries(
        stats.byTeam.map((row) => [row.team?.name ?? 'aucune', row]),
      );
      expect(teamStats['Équipe fictive A']).toMatchObject({
        active: 2,
        acquiredCompetencies: 1,
        attendance: { present: 2, absent: 0 },
      });
      expect(teamStats['Équipe fictive B']).toMatchObject({
        active: 1,
        attendance: { present: 0, absent: 1 },
      });
      const stagesFromStats = (code: string) =>
        stats.byStage.find((row) => row.stage?.code === code)?.stage;
      expect(teamStats['Équipe fictive A']?.byStage).toEqual([
        { stage: stagesFromStats('NOVICIAT'), count: 1 },
        { stage: stagesFromStats('APPRENTISSAGE'), count: 1 },
      ]);
      expect(teamStats.aucune?.active).toBe(1);
      expect(stats.byStage.find((row) => row.stage?.code === 'NOVICIAT')).toMatchObject({
        active: 3,
        acquiredCompetencies: 1,
      });
      expect(stats.competencies).toMatchObject({
        activeInReferential: 1,
        acquired: 1,
        pendingProposals: 1,
      });
      expect(stats.activities).toMatchObject({
        realised: 1,
        planned: 2,
        supplementary: 3,
        attendanceMissing: 1,
      });
      expect(stats.attendance).toEqual({ present: 2, absent: 1, excused: 0, rate: 2 / 3 });

      // La borne de fin inclut toute la journée de décision, pas seulement minuit.
      const todayStats = await json(
        chef.get(`/statistics?from=${TODAY}&to=${TODAY}`),
        200,
        statisticsSchema,
      );
      expect(todayStats.competencies.acquired).toBe(1);
      // Filtres : équipe, étape, période.
      const filtered = await json(
        chef.get(`/statistics?teamId=${teamA.id}`),
        200,
        statisticsSchema,
      );
      expect(filtered.scouts.active).toBe(2);
      expect(filtered.attendance).toMatchObject({ present: 2, absent: 0 });
      const byStage = await json(
        chef.get(`/statistics?stageId=${stages.APPRENTISSAGE}`),
        200,
        statisticsSchema,
      );
      expect(byStage.scouts.active).toBe(1);
      const past = await json(
        chef.get('/statistics?from=2020-01-01&to=2020-12-31'),
        200,
        statisticsSchema,
      );
      expect(past.attendance.rate).toBeNull();
      expect(past.competencies.acquired).toBe(0);
      await chef.get('/statistics?from=2026-12-01&to=2026-01-01').expect(400);

      // Filtres de la liste des activités.
      const missing = await json(chef.get('/activities?attendanceMissing=true'), 200, activityPage);
      expect(missing.items.map((item) => item.title)).toEqual(['Sans présences']);
      const realised = await json(chef.get('/activities?status=REALISEE'), 200, activityPage);
      expect(realised.items[0]?.attendance).toEqual({ present: 2, absent: 1, excused: 0 });
      const upcoming = await json(chef.get(`/activities?from=${TODAY}`), 200, activityPage);
      expect(upcoming.items.map((item) => item.title)).toEqual(['À venir']);

      // Tableaux de bord par rôle.
      const resp = await json(
        responsable.get('/dashboard/responsable'),
        200,
        responsableDashboardSchema,
      );
      expect(resp.pedagogyQueue).toMatchObject({ proposalsPending: 1, resultsToReview: 0 });
      expect(resp.contentQueue).toEqual({ modulesToApprove: 0, evaluationsToApprove: 0 });
      const chefDashboard = await json(chef.get('/dashboard/chef'), 200, chefDashboardSchema);
      expect(chefDashboard.myProposals.pending).toBe(1);
      expect(chefDashboard.myProposals.recentlyDecided[0]).toMatchObject({ status: 'APPROUVEE' });
      expect(chefDashboard.attendanceToRecord.map((item) => item.title)).toEqual([
        'Sans présences',
      ]);
      expect(chefDashboard.upcomingActivities.map((item) => item.title)).toEqual(['À venir']);

      const routier = await login(account);
      const me = await json(routier.get('/me/dashboard'), 200, myDashboardSchema);
      expect(me).toMatchObject({
        linked: true,
        stage: { code: 'NOVICIAT' },
        team: { id: teamA.id },
      });
      expect(me.acquiredCompetencies.map((item) => item.code)).toEqual(['SERV-01']);
      const myActivities = await json(routier.get('/me/activities'), 200, myActivitiesSchema);
      expect(myActivities.attended).toEqual([expect.objectContaining({ status: 'PRESENT' })]);
      expect(myActivities.upcoming.map((item) => item.title)).toEqual(['À venir']);
    });

    it('protège fiches, décisions et opérations administratives', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const routier = await loginAs('ROUTIER');
      const scout = await createScout(responsable, 1);

      for (const path of [
        `/scouts/${scout.id}/progression`,
        `/scouts/${scout.id}/timeline`,
        '/competencies',
        '/competency-proposals',
        '/activities',
        '/statistics',
        '/dashboard/chef',
        '/dashboard/responsable',
      ]) {
        await routier.get(path).expect(403);
      }
      await chef.get('/dashboard/responsable').expect(403);
      await chef.get(`/scouts/${scout.id}/progression`).expect(200);
      // Routier sans profil rattaché : tableau de bord vide, progression introuvable.
      expect((await json(routier.get('/me/dashboard'), 200, myDashboardSchema)).linked).toBe(false);
      expect(await errorCode(routier.get('/me/progression'), 404)).toBe('SCOUT_PROFILE_NOT_LINKED');
      // Sans session ou sans en-tête anti-CSRF.
      await request(app.getHttpServer()).get(`/api/v1/scouts/${scout.id}/progression`).expect(401);
      await chef.get('/me/dashboard').expect(403);
      const unprotected = await request(app.getHttpServer())
        .post(`/api/v1/scouts/${scout.id}/stage-changes`)
        .send({});
      expect([401, 403]).toContain(unprotected.status);
      await responsable.get('/scouts/pas-un-uuid/progression').expect(400);
    });
  });
});
