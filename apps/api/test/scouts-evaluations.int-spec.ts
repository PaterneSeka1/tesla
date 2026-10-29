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
import { createTestPrisma, grantPersona, resetDatabase } from './int-database.js';

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
  let questionV1: string;

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
    const user = (n: number) =>
      prisma.user.create({
        data: {
          email: `fictif${n}@example.test`,
          firstName: 'Fictif',
          lastName: `N${n}`,
          role: 'ENCADREMENT',
        },
      });
    const [chefUser, respUser] = await Promise.all([user(1), user(2)]);
    await grantPersona(prisma, respUser.id, 'RESPONSABLE');
    // Acteurs construits comme par la garde de session (habilitations effectives).
    chef = { userId: chefUser.id, role: 'ENCADREMENT', leaderFunction: null, delegated: [] };
    responsable = {
      userId: respUser.id,
      role: 'ENCADREMENT',
      leaderFunction: 'PLEIN',
      delegated: [],
    };

    const stages = await prisma.progressionStage.findMany();
    stageIds = Object.fromEntries(stages.map((s) => [s.code, s.id]));

    const evaluation = await prisma.evaluation.create({
      data: { title: 'Quiz fictif du Noviciat', stageId: stageIds.NOVICIAT! },
    });
    evaluationId = evaluation.id;
    // Version 1 rédigée puis publiée en suivant les transitions autorisées par le trigger.
    const v1 = await prisma.evaluationVersion.create({
      data: { evaluationId, version: 1, title: 'Quiz fictif du Noviciat' },
    });
    versionV1 = v1.id;
    questionV1 = (
      await prisma.evaluationQuestion.create({
        data: {
          versionId: v1.id,
          position: 0,
          type: 'REPONSE_COURTE',
          prompt: 'Question fictive ?',
          points: 2,
          expectedAnswer: 'Réponse attendue fictive',
          createdById: chefUser.id,
        },
      })
    ).id;
    for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
      await prisma.evaluationVersion.update({
        where: { id: v1.id },
        data: {
          status,
          ...(status === 'PUBLIE' && { publishedAt: new Date(), publishedById: respUser.id }),
        },
      });
    }
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { publishedVersionId: v1.id },
    });
    versionDraft = (
      await prisma.evaluationVersion.create({
        data: { evaluationId, version: 2, title: 'Brouillon fictif' },
      })
    ).id;
  });

  const newScout = (n: number, extra: { matricule?: string; stage?: string } = {}) =>
    profiles.create(responsable, {
      firstName: 'Routier',
      lastName: `Fictif${n}`,
      joinedAt: '2026-10-01',
      currentStageId: stageIds[extra.stage ?? 'NOVICIAT'],
      ...(extra.matricule === undefined ? {} : { matricule: extra.matricule }),
    });

  const prepare = (scoutProfileId: string, actor: Actor = chef) =>
    attempts.preparePaper(actor, { scoutProfileId, evaluationId, evaluationVersionId: versionV1 });

  /** Saisie d'une copie papier (révision lue en base, comme le ferait l'écran de correction). */
  const record = async (code: string, text = 'Réponse manuscrite', extra: object = {}) => {
    const { correctionRevision } = await prisma.evaluationAttempt.findUniqueOrThrow({
      where: { code },
    });
    return attempts.saveCorrection(chef, code, {
      correctionRevision,
      completedAt: '2027-01-09T10:00:00.000Z',
      answers: [{ questionId: questionV1, text }],
      grades: [{ questionId: questionV1, awardedPoints: 1.5 }],
      ...extra,
    });
  };
  const revisionOf = async (code: string) =>
    (await prisma.evaluationAttempt.findUniqueOrThrow({ where: { code } })).correctionRevision;

  it('1. crée un routier sans compte', async () => {
    const scout = await newScout(1);
    expect(scout.userId).toBeNull();
    expect(scout.matricule).toBeNull();
  });

  it('2. rattache un compte plus tard sans perte de données ni second profil', async () => {
    const scout = await newScout(1);
    const team = await teams.create(responsable, { name: 'Équipe fictive A' });
    await teams.assign(responsable, { scoutProfileId: scout.id, teamId: team.id });
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
    await teams.assign(responsable, { scoutProfileId: scout.id, teamId: a.id });
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
    await teams.assign(responsable, {
      scoutProfileId: scout.id,
      teamId: a.id,
      startedAt: '2026-10-01T00:00:00.000Z',
    });
    await teams.assign(responsable, {
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
      teams.assign(responsable, {
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
    await teams.assign(responsable, {
      scoutProfileId: scout.id,
      teamId: team.id,
      startedAt: '2026-10-01T00:00:00.000Z',
    });
    const attempt = await prepare(scout.id);

    const first = await attempts.paperDocumentData(chef, attempt.code, 'questionnaire');
    const second = await attempts.paperDocumentData(
      chef,
      attempt.code.toLowerCase(),
      'questionnaire',
    );
    expect(second).toEqual(first);
    expect(first).toMatchObject({ code: attempt.code, teamName: 'Équipe fictive A', version: 1 });
    expect(first.scout.matricule).toBe('0000123A');
    expect(JSON.stringify(first)).not.toContain('Réponse attendue fictive');
    expect(first.questions[0]).toMatchObject({ points: null, expectedAnswer: null });
    // Le corrigé, lui, contient la réponse attendue (chefs uniquement).
    const key = await attempts.paperDocumentData(chef, attempt.code, 'corrige');
    expect(JSON.stringify(key)).toContain('Réponse attendue fictive');
    expect(await prisma.evaluationAttempt.count()).toBe(1);

    // Doublon : une seconde préparation explicite est refusée tant que la première est ouverte (RM-012).
    await expect(prepare(scout.id)).rejects.toThrow(ConflictException);
  });

  it('11–12. recherche par code protégée par les permissions', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
    const found = await attempts.detail(chef, { code: ` ${attempt.code.toLowerCase()} ` });
    expect(found.id).toBe(attempt.id);

    const stranger = await prisma.user.create({
      data: {
        email: 'autre@example.test',
        firstName: 'Autre',
        lastName: 'Fictif',
        role: 'ROUTIER',
      },
    });
    const routier = {
      userId: stranger.id,
      role: 'ROUTIER',
      leaderFunction: null,
      delegated: [],
    } as const;
    await expect(attempts.detail(routier, { code: attempt.code })).rejects.toThrow(
      ForbiddenException,
    );
    for (const document of ['questionnaire', 'corrige', 'grille'] as const) {
      await expect(attempts.paperDocumentData(routier, attempt.code, document)).rejects.toThrow(
        ForbiddenException,
      );
    }
    await expect(attempts.detail(chef, { code: 'NT-12' })).rejects.toThrow(BadRequestException);
    await expect(attempts.detail(chef, { code: 'NT-2000-999999' })).rejects.toThrow(
      NotFoundException,
    );

    const owner = await prisma.user.create({
      data: {
        email: 'titulaire@example.test',
        firstName: 'Routier',
        lastName: 'Fictif1',
        role: 'ROUTIER',
      },
    });
    // Même titulaire, un routier n'accède jamais à la copie corrigée (corrigé compris) : il consulte
    // son historique via /me/attempts.
    await profiles.linkAccount(responsable, scout.id, owner.id);
    await expect(
      attempts.detail(
        { userId: owner.id, role: 'ROUTIER', leaderFunction: null, delegated: [] },
        { code: attempt.code },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('13. conserve la version exacte du questionnaire et refuse une version non publiée', async () => {
    const scout = await newScout(1);
    const attempt = await prepare(scout.id);
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
    await expect(
      attempts.submitReview(chef, attempt.code, { correctionRevision: 1 }),
    ).rejects.toThrow(ConflictException);
    const recorded = await record(attempt.code);
    expect(recorded).toMatchObject({ status: 'A_CORRIGER', score: 1.5, maxScore: 2 });
    await attempts.submitReview(chef, attempt.code, {
      correctionRevision: recorded.correctionRevision,
    });

    await expect(attempts.acceptReview(chef, attempt.id, {})).rejects.toThrow(ForbiddenException);
    const decided = await attempts.acceptReview(responsable, attempt.id, {});
    expect(decided.status).toBe('VALIDEE');

    const after = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
    expect(after.currentStageId).toBe(stageIds.NOVICIAT);
    expect(
      await prisma.auditLog.count({ where: { action: 'evaluation_attempt.review_accepted' } }),
    ).toBe(1);

    // Aucune modification silencieuse après décision : réouverture tracée par le responsable uniquement.
    await expect(record(attempt.code, 'Autre', { reason: 'Contournement' })).rejects.toThrow(
      ConflictException,
    );
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
    await record(attempt.code);
    await attempts.submitReview(chef, attempt.code, {
      correctionRevision: await revisionOf(attempt.code),
    });
    await expect(record(attempt.code, 'Corrigée')).rejects.toThrow(UnprocessableEntityException);
    await record(attempt.code, 'Corrigée', { reason: 'Transcription erronée' });

    const snapshots = await prisma.evaluationAttemptEvent.findMany({
      where: { attemptId: attempt.id, snapshot: { not: undefined } },
      orderBy: { createdAt: 'asc' },
    });
    const answers = snapshots
      .map((e) => (e.snapshot as { answers?: { text: string }[] } | null)?.answers?.[0]?.text)
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

    await attempts.cancel(chef, attempt.code, { reason: 'Annulation fictive' });
    await waivers.revoke(responsable, waiver.id, { reason: 'Révocation fictive' });
    await expect(prepare(scout.id)).rejects.toThrow(ForbiddenException);
    expect(await prisma.auditLog.count({ where: { entityType: 'EvaluationWaiver' } })).toBe(2);
  });

  it('17. conservation : tentatives et historique non supprimables, code immuable et jamais réutilisé', async () => {
    const scout = await newScout(1);
    const first = await prepare(scout.id);
    await attempts.cancel(chef, first.code, { reason: 'Feuille perdue' });
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
