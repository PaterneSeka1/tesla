import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ATTEMPT_CODE_PATTERN } from '@tesla/shared';
import { type Actor } from '../src/common/actor.js';
import { EvaluationAttemptsService } from '../src/modules/evaluations/evaluation-attempts.service.js';
import { EvaluationWaiversService } from '../src/modules/evaluations/evaluation-waivers.service.js';
import { ScoutProfilesService } from '../src/modules/scouts/scout-profiles.service.js';
import { TeamsService } from '../src/modules/scouts/teams.service.js';
import { type PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase } from './int-database.js';

// Données exclusivement fictives.
describe('Routiers, équipes et tentatives papier (intégration PostgreSQL)', () => {
  let prisma: PrismaService;
  let profiles: ScoutProfilesService;
  let teams: TeamsService;
  let attempts: EvaluationAttemptsService;
  let waivers: EvaluationWaiversService;

  let chef: Actor;
  let responsable: Actor;
  let stageIds: Record<string, string>;
  let evaluationId: string;
  let versionV1: string;
  let versionDraft: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    profiles = new ScoutProfilesService(prisma);
    teams = new TeamsService(prisma);
    attempts = new EvaluationAttemptsService(prisma, teams);
    waivers = new EvaluationWaiversService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = (role: 'CHEF' | 'RESPONSABLE' | 'ROUTIER', n: number) =>
      prisma.user.create({
        data: { email: `fictif${n}@example.test`, firstName: 'Fictif', lastName: `N${n}`, role },
      });
    const [chefUser, respUser] = await Promise.all([user('CHEF', 1), user('RESPONSABLE', 2)]);
    chef = { userId: chefUser.id, role: 'CHEF' };
    responsable = { userId: respUser.id, role: 'RESPONSABLE' };

    const stages = await prisma.progressionStage.findMany();
    stageIds = Object.fromEntries(stages.map((s) => [s.code, s.id]));

    const evaluation = await prisma.evaluation.create({
      data: { title: 'Quiz fictif du Noviciat', stageId: stageIds.NOVICIAT! },
    });
    evaluationId = evaluation.id;
    versionV1 = (
      await prisma.evaluationVersion.create({
        data: {
          evaluationId,
          version: 1,
          questions: [{ id: 'q1', text: 'Question fictive ?' }],
          answerKey: { q1: 'Réponse attendue fictive' },
          publishedAt: new Date(),
          publishedById: respUser.id,
        },
      })
    ).id;
    versionDraft = (
      await prisma.evaluationVersion.create({
        data: { evaluationId, version: 2, questions: [{ id: 'q1', text: 'Brouillon ?' }] },
      })
    ).id;
  });

  const newScout = (n: number, extra: { matricule?: string; stage?: string } = {}) =>
    profiles.create(chef, {
      firstName: 'Routier',
      lastName: `Fictif${n}`,
      joinedAt: '2026-10-01',
      currentStageId: stageIds[extra.stage ?? 'NOVICIAT'],
      ...(extra.matricule === undefined ? {} : { matricule: extra.matricule }),
    });

  const prepare = (scoutProfileId: string, actor: Actor = chef) =>
    attempts.preparePaper(actor, { scoutProfileId, evaluationId, evaluationVersionId: versionV1 });

  const result = { completedAt: '2027-01-09T10:00:00.000Z', answers: { q1: 'Réponse manuscrite' } };

  it('1. crée un routier sans compte', async () => {
    const scout = await newScout(1);
    expect(scout.userId).toBeNull();
    expect(scout.matricule).toBeNull();
  });

  it('2. rattache un compte plus tard sans perte de données ni second profil', async () => {
    const scout = await newScout(1);
    const team = await teams.create(responsable, { name: 'Équipe fictive A' });
    await teams.assign(chef, { scoutProfileId: scout.id, teamId: team.id });
    const attempt = await prepare(scout.id);

    const account = await prisma.user.create({
      data: {
        email: 'routier@example.test',
        firstName: 'Routier',
        lastName: 'Fictif1',
        role: 'ROUTIER',
      },
    });
    await expect(profiles.linkAccount(chef, scout.id, account.id)).rejects.toThrow(
      ForbiddenException,
    );
    const linked = await profiles.linkAccount(responsable, scout.id, account.id);

    expect(linked.id).toBe(scout.id);
    expect(await prisma.scoutProfile.count()).toBe(1);
    expect(await prisma.teamAssignment.count({ where: { scoutProfileId: scout.id } })).toBe(1);
    expect(
      (await prisma.evaluationAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
        .scoutProfileId,
    ).toBe(scout.id);

    const other = await newScout(2);
    await expect(profiles.linkAccount(responsable, other.id, account.id)).rejects.toThrow(
      ConflictException,
    );
    await expect(profiles.linkAccount(responsable, scout.id, account.id)).rejects.toThrow(
      ConflictException,
    );
  });

  it('3. impose l’unicité des matricules renseignés, indépendamment de la casse et des espaces', async () => {
    await newScout(1, { matricule: '0000012a' });
    await expect(newScout(2, { matricule: ' 000 0012A ' })).rejects.toThrow(ConflictException);
    const found = await profiles.findByMatricule(chef, '0000012a');
    expect(found?.lastName).toBe('Fictif1');
    // La base refuse aussi un matricule non normalisé inséré hors service.
    await expect(
      prisma.scoutProfile.create({
        data: { firstName: 'X', lastName: 'Y', joinedAt: new Date(), matricule: '0000012a' },
      }),
    ).rejects.toThrow();
  });

  it('4. le matricule est facultatif (plusieurs routiers sans matricule)', async () => {
    await newScout(1);
    await newScout(2, { matricule: '' });
    expect(await prisma.scoutProfile.count({ where: { matricule: null } })).toBe(2);
  });

  it('5. une seule affectation active par routier, garantie en base', async () => {
    const scout = await newScout(1);
    const [a, b] = await Promise.all([
      teams.create(responsable, { name: 'Équipe fictive A' }),
      teams.create(responsable, { name: 'Équipe fictive B' }),
    ]);
    await teams.assign(chef, { scoutProfileId: scout.id, teamId: a.id });
    await expect(
      prisma.teamAssignment.create({
        data: { scoutProfileId: scout.id, teamId: b.id, startedAt: new Date(Date.now() + 60_000) },
      }),
    ).rejects.toThrow();
    expect(await prisma.teamAssignment.count({ where: { endedAt: null } })).toBe(1);
  });

  it('6. historise un changement d’équipe et retrouve l’équipe à une date passée', async () => {
    const scout = await newScout(1);
    const [a, b] = await Promise.all([
      teams.create(responsable, { name: 'Équipe fictive A' }),
      teams.create(responsable, { name: 'Équipe fictive B' }),
    ]);
    await teams.assign(chef, {
      scoutProfileId: scout.id,
      teamId: a.id,
      startedAt: '2026-10-01T00:00:00.000Z',
    });
    await teams.assign(chef, {
      scoutProfileId: scout.id,
      teamId: b.id,
      startedAt: '2026-12-01T00:00:00.000Z',
    });

    const history = await prisma.teamAssignment.findMany({
      where: { scoutProfileId: scout.id },
      orderBy: { startedAt: 'asc' },
    });
    expect(history.map((h) => [h.teamId, h.endedAt?.toISOString() ?? null])).toEqual([
      [a.id, '2026-12-01T00:00:00.000Z'],
      [b.id, null],
    ]);
    expect((await teams.teamAt(scout.id, new Date('2026-11-15')))?.id).toBe(a.id);
    expect((await teams.teamAt(scout.id, new Date('2027-01-15')))?.id).toBe(b.id);
    await expect(
      teams.assign(chef, {
        scoutProfileId: scout.id,
        teamId: a.id,
        startedAt: '2026-11-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('7–8. prépare une tentative papier sans compte, avec un code émis par le backend', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    expect(attempt).toMatchObject({ mode: 'PAPIER', status: 'PREPAREE', scoutProfileId: scout.id });
    expect(attempt.code).toMatch(ATTEMPT_CODE_PATTERN);
    expect(attempt.code).toBe(`NT-${new Date().getUTCFullYear()}-000001`);
  });

  it('9. codes uniques sous créations concurrentes', async () => {
    const scouts = await Promise.all(Array.from({ length: 15 }, (_, i) => newScout(i)));
    const created = await Promise.all(scouts.map((s) => prepare(s.id)));
    const codes = created.map((a) => a.code);
    expect(new Set(codes).size).toBe(15);
    const sequences = codes.map((c) => Number(c.slice(-6))).sort((x, y) => x - y);
    expect(sequences).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('10. réimprimer ne crée pas de nouvelle tentative et la feuille ne contient jamais le corrigé', async () => {
    const team = await teams.create(responsable, { name: 'Équipe fictive A' });
    const scout = await newScout(1, { matricule: '0000123A' });
    await teams.assign(chef, {
      scoutProfileId: scout.id,
      teamId: team.id,
      startedAt: '2026-10-01T00:00:00.000Z',
    });
    const attempt = await prepare(scout.id);

    const first = await attempts.getPaperSheet(chef, attempt.code);
    const second = await attempts.getPaperSheet(chef, attempt.code.toLowerCase());
    expect(second).toEqual(first);
    expect(first).toMatchObject({ code: attempt.code, teamName: 'Équipe fictive A', version: 1 });
    expect(first.scout.matricule).toBe('0000123A');
    expect(JSON.stringify(first)).not.toContain('Réponse attendue fictive');
    expect(await prisma.evaluationAttempt.count()).toBe(1);

    // Doublon : une seconde préparation explicite est refusée tant que la première est ouverte (RM-012).
    await expect(prepare(scout.id)).rejects.toThrow(ConflictException);
  });

  it('11–12. recherche par code protégée par les permissions', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    const found = await attempts.findByCode(chef, ` ${attempt.code.toLowerCase()} `);
    expect(found.id).toBe(attempt.id);

    const stranger = await prisma.user.create({
      data: {
        email: 'autre@example.test',
        firstName: 'Autre',
        lastName: 'Fictif',
        role: 'ROUTIER',
      },
    });
    await expect(
      attempts.findByCode({ userId: stranger.id, role: 'ROUTIER' }, attempt.code),
    ).rejects.toThrow(NotFoundException);
    await expect(
      attempts.getPaperSheet({ userId: stranger.id, role: 'ROUTIER' }, attempt.code),
    ).rejects.toThrow(ForbiddenException);
    await expect(attempts.findByCode(chef, 'NT-12')).rejects.toThrow(BadRequestException);

    const owner = await prisma.user.create({
      data: {
        email: 'titulaire@example.test',
        firstName: 'Routier',
        lastName: 'Fictif1',
        role: 'ROUTIER',
      },
    });
    await profiles.linkAccount(responsable, scout.id, owner.id);
    expect(
      (await attempts.findByCode({ userId: owner.id, role: 'ROUTIER' }, attempt.code)).id,
    ).toBe(attempt.id);
  });

  it('13. conserve la version exacte du questionnaire et refuse une version non publiée', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    await prisma.evaluationVersion.update({
      where: { id: versionDraft },
      data: { publishedAt: new Date() },
    });
    expect(
      (await prisma.evaluationAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
        .evaluationVersionId,
    ).toBe(versionV1);
    await expect(
      prisma.evaluationAttempt.update({
        where: { id: attempt.id },
        data: { evaluationVersionId: versionDraft },
      }),
    ).rejects.toThrow();

    await prisma.evaluationVersion.update({
      where: { id: versionDraft },
      data: { publishedAt: null },
    });
    const other = await newScout(2);
    await expect(
      attempts.preparePaper(chef, {
        scoutProfileId: other.id,
        evaluationId,
        evaluationVersionId: versionDraft,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('14–15. circuit complet : seul le responsable décide, sans changement d’étape automatique', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    await expect(attempts.submit(chef, attempt.id)).rejects.toThrow(ConflictException);
    await attempts.recordPaperResult(chef, attempt.id, { ...result, score: 14, maxScore: 20 });
    await attempts.submit(chef, attempt.id);

    await expect(attempts.decide(chef, attempt.id, { decision: 'VALIDEE' })).rejects.toThrow(
      ForbiddenException,
    );
    const decided = await attempts.decide(responsable, attempt.id, { decision: 'VALIDEE' });
    expect(decided.status).toBe('VALIDEE');

    const after = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
    expect(after.currentStageId).toBe(stageIds.NOVICIAT);
    expect(await prisma.auditLog.count({ where: { action: 'evaluation_attempt.decided' } })).toBe(
      1,
    );

    // Aucune modification silencieuse après décision : réouverture tracée par le responsable uniquement.
    await expect(
      attempts.recordPaperResult(chef, attempt.id, { ...result, reason: 'Contournement' }),
    ).rejects.toThrow(ConflictException);
    await expect(attempts.reopen(chef, attempt.id, { reason: 'Erreur de saisie' })).rejects.toThrow(
      ForbiddenException,
    );
    await attempts.reopen(responsable, attempt.id, { reason: 'Erreur de saisie' });
    const statuses = await prisma.evaluationAttemptEvent.findMany({
      where: { attemptId: attempt.id },
      orderBy: { createdAt: 'asc' },
      select: { toStatus: true },
    });
    expect(statuses.map((e) => e.toStatus)).toEqual([
      'PREPAREE',
      'A_CORRIGER',
      'SOUMISE',
      'VALIDEE',
      'A_CORRIGER',
    ]);
  });

  it('correction après soumission : motif obligatoire et réponses originales conservées', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    await attempts.recordPaperResult(chef, attempt.id, result);
    await attempts.submit(chef, attempt.id);
    await expect(
      attempts.recordPaperResult(chef, attempt.id, { ...result, answers: { q1: 'Corrigée' } }),
    ).rejects.toThrow(UnprocessableEntityException);
    await attempts.recordPaperResult(chef, attempt.id, {
      ...result,
      answers: { q1: 'Corrigée' },
      reason: 'Transcription erronée',
    });

    const snapshots = await prisma.evaluationAttemptEvent.findMany({
      where: { attemptId: attempt.id, snapshot: { not: undefined } },
      orderBy: { createdAt: 'asc' },
    });
    const answers = snapshots
      .map((e) => (e.snapshot as { answers?: Record<string, string> } | null)?.answers?.q1)
      .filter(Boolean);
    expect(answers).toEqual(['Réponse manuscrite', 'Corrigée']);
  });

  it('16. refuse une préparation hors progression sans dérogation active', async () => {
    const scout = await newScout(1, { stage: 'APPRENTISSAGE' });
    await expect(prepare(scout.id)).rejects.toThrow(ForbiddenException);

    await expect(
      waivers.grant(chef, { scoutProfileId: scout.id, evaluationId, reason: 'Motif fictif' }),
    ).rejects.toThrow(ForbiddenException);
    const waiver = await waivers.grant(responsable, {
      scoutProfileId: scout.id,
      evaluationId,
      reason: 'Motif fictif',
    });
    const attempt = await prepare(scout.id);
    expect(attempt.waiverId).toBe(waiver.id);

    await attempts.cancel(chef, attempt.id, { reason: 'Annulation fictive' });
    await waivers.revoke(responsable, waiver.id, { reason: 'Révocation fictive' });
    await expect(prepare(scout.id)).rejects.toThrow(ForbiddenException);
    expect(await prisma.auditLog.count({ where: { entityType: 'EvaluationWaiver' } })).toBe(2);
  });

  it('17. conservation : tentatives et historique non supprimables, code immuable et jamais réutilisé', async () => {
    const scout = await newScout(1);
    const first = await prepare(scout.id);
    await attempts.cancel(chef, first.id, { reason: 'Feuille perdue' });
    const second = await prepare(scout.id);

    expect(second.code).not.toBe(first.code);
    expect(
      (await prisma.evaluationAttempt.findUniqueOrThrow({ where: { id: first.id } })).status,
    ).toBe('ANNULEE');
    await expect(prisma.evaluationAttempt.delete({ where: { id: first.id } })).rejects.toThrow();
    await expect(
      prisma.evaluationAttempt.update({
        where: { id: second.id },
        data: { code: 'NT-2000-000001' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.evaluationAttemptEvent.deleteMany({ where: { attemptId: first.id } }),
    ).rejects.toThrow();
    expect(await prisma.evaluationAttempt.count()).toBe(2);
  });
});
