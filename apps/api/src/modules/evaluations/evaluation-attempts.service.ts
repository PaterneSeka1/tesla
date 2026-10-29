import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AcceptReviewInput,
  acceptReviewInputSchema,
  type AttemptReasonInput,
  attemptCodeSchema,
  attemptReasonInputSchema,
  type AttemptStatus,
  type CorrectionDetail,
  type CorrectionListItem,
  type CorrectionListQuery,
  correctionListQuerySchema,
  type CorrectionRevisionInput,
  correctionRevisionInputSchema,
  ELIGIBILITY_LABELS,
  isObjectiveQuestion,
  OPEN_ATTEMPT_STATUSES,
  type Paginated,
  type PreparePaperAttemptInput,
  preparePaperAttemptInputSchema,
  roundPoints,
  type SaveCorrectionInput,
  saveCorrectionInputSchema,
  totalScore,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isRecordNotFound, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type EvaluationAttempt, type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';
import { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';
import { TeamsService } from '../scouts/teams.service.js';
import {
  gradeObjectiveQuestions,
  loadEligibility,
  loadVersionQuestions,
  normalizeAnswers,
  upsertAnswers,
  type VersionQuestion,
} from './attempt-answers.js';
import { issueAttemptCode } from './attempt-code.js';
import { assertTransition } from './attempt-workflow.js';
import {
  evaluationNotFound,
  formatEvaluationCode,
  moduleRefInclude,
  toEditorQuestion,
  toModuleRef,
  toNumber,
} from './evaluation-common.js';

const listInclude = {
  scoutProfile: {
    include: {
      currentStage: true,
      teamAssignments: { where: { endedAt: null }, include: { team: true }, take: 1 },
    },
  },
  evaluation: { select: { id: true, number: true } },
  version: { select: { version: true, title: true } },
  recordedBy: userSummarySelect,
} as const satisfies Prisma.EvaluationAttemptInclude;

type ListRow = Prisma.EvaluationAttemptGetPayload<{ include: typeof listInclude }>;

const detailInclude = {
  ...listInclude,
  evaluation: {
    select: {
      id: true,
      number: true,
      publishedVersionId: true,
      stage: true,
      module: { include: moduleRefInclude },
    },
  },
  version: { select: { id: true, version: true, title: true, instructions: true } },
  createdBy: userSummarySelect,
  decidedBy: userSummarySelect,
  waiver: { select: { id: true, reason: true } },
  attemptAnswers: { include: { gradedBy: userSummarySelect } },
  events: { orderBy: { createdAt: 'asc' }, include: { actor: userSummarySelect } },
} as const satisfies Prisma.EvaluationAttemptInclude;

type DetailRow = Prisma.EvaluationAttemptGetPayload<{ include: typeof detailInclude }>;

/** Données d'une feuille papier ou d'un document de correction (jamais le corrigé pour le routier). */
export interface PaperDocumentData {
  code: string;
  evaluationCode: string;
  evaluationTitle: string;
  moduleTitle: string | null;
  version: number;
  instructions: string;
  scout: { firstName: string; lastName: string; matricule: string | null };
  /** Équipe à la date de préparation (historique des affectations). */
  teamName: string | null;
  plannedFor: Date | null;
  preparedAt: Date;
  questions: PaperQuestion[];
}

/**
 * Question d'un document papier. Pour le questionnaire du routier, le corrigé est retiré avant le
 * rendu (barème, bonnes réponses, critères et réponse attendue à null) : il ne peut pas fuiter.
 */
export interface PaperQuestion {
  position: number;
  type: VersionQuestion['type'];
  prompt: string;
  points: number | null;
  scoringPolicy: VersionQuestion['scoringPolicy'];
  guidance: string | null;
  expectedAnswer: string | null;
  options: { label: string; isCorrect: boolean | null }[];
}

/**
 * Tentatives : préparation papier (RM-006 à RM-012), correction par les chefs, examen par le
 * responsable. Trois niveaux distincts : correction → examen du résultat → validation officielle
 * (phase 4, jamais automatique). Aucune méthode ne modifie l'étape du routier.
 */
@Injectable()
export class EvaluationAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  /**
   * Prépare une tentative papier : éligibilité (même règle qu'en ligne), version publiée courante,
   * code attribué par le backend, statut PREPAREE. Refusée si une tentative est déjà ouverte.
   */
  async preparePaper(actor: Actor, input: PreparePaperAttemptInput): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.preparePaper');
    const data = parseInput(preparePaperAttemptInputSchema, input);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.scoutProfile.findUnique({ where: { id: data.scoutProfileId } });
        if (!profile) throw scoutProfileNotFound();

        const evaluation = await tx.evaluation.findUnique({
          where: { id: data.evaluationId },
          include: { publishedVersion: true },
        });
        if (!evaluation) throw evaluationNotFound();
        const version = evaluation.publishedVersion;
        if (!version || (data.evaluationVersionId && data.evaluationVersionId !== version.id)) {
          throw new UnprocessableEntityException({
            code: 'EVALUATION_VERSION_NOT_PUBLISHED',
            message: 'Seule la version publiée du questionnaire peut être préparée.',
          });
        }

        const eligibility = await loadEligibility(tx, {
          profile,
          evaluation,
          maxAttempts: version.maxAttempts,
          now,
        });
        if (eligibility.openAttempt) throw attemptAlreadyOpen();
        if (!eligibility.allowed) {
          throw new ForbiddenException({
            code: 'EVALUATION_NOT_ELIGIBLE',
            message: `Préparation impossible : ${ELIGIBILITY_LABELS[eligibility.status].toLowerCase()}.`,
          });
        }

        const attempt = await tx.evaluationAttempt.create({
          data: {
            code: await issueAttemptCode(tx, now),
            scoutProfileId: profile.id,
            evaluationId: evaluation.id,
            evaluationVersionId: version.id,
            mode: 'PAPIER',
            status: 'PREPAREE',
            plannedFor: data.plannedFor ? new Date(data.plannedFor) : null,
            waiverId: eligibility.waiver?.id ?? null,
            createdById: actor.userId,
          },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: attempt.id,
            actorId: actor.userId,
            fromStatus: null,
            toStatus: 'PREPAREE',
          },
        });
        return attempt;
      });
    } catch (error) {
      // Filet de sécurité concurrentiel : index unique partiel « une tentative ouverte ».
      if (isUniqueViolation(error)) throw attemptAlreadyOpen();
      throw error;
    }
  }

  /** File de correction et historique des copies (chefs) ; file d'examen (responsable, `SOUMISE`). */
  async list(actor: Actor, query: CorrectionListQuery): Promise<Paginated<CorrectionListItem>> {
    assertCan(actor, 'attempt.readAny');
    const { page, pageSize, search, status, mode, evaluationId, scoutProfileId } = parseInput(
      correctionListQuerySchema,
      query,
    );
    const filters: Prisma.EvaluationAttemptWhereInput[] = [];
    if (status === 'open') filters.push({ status: { in: [...OPEN_ATTEMPT_STATUSES] } });
    else if (status !== 'all') filters.push({ status });
    if (mode) filters.push({ mode });
    if (evaluationId) filters.push({ evaluationId });
    if (scoutProfileId) filters.push({ scoutProfileId });
    if (search) {
      filters.push({
        OR: [
          { code: { contains: search.replace(/\s+/g, '').toUpperCase() } },
          { scoutProfile: { lastName: { contains: search, mode: 'insensitive' } } },
          { scoutProfile: { firstName: { contains: search, mode: 'insensitive' } } },
          { scoutProfile: { matricule: { contains: search.toUpperCase() } } },
          { version: { title: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.EvaluationAttemptWhereInput = { AND: filters };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluationAttempt.count({ where }),
      this.prisma.evaluationAttempt.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: status === 'SOUMISE' || status === 'A_CORRIGER' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(toListItem), page, pageSize, total };
  }

  /** File d'examen du responsable : résultats corrigés soumis, les plus anciens d'abord. */
  async pendingReview(
    actor: Actor,
    query: CorrectionListQuery,
  ): Promise<Paginated<CorrectionListItem>> {
    assertCan(actor, 'attempt.decide');
    return this.list(actor, { ...query, status: 'SOUMISE' });
  }

  /**
   * Copie complète (corrigé compris) recherchée par code ou par identifiant. Le code n'est pas un
   * secret : la permission est vérifiée (chefs et responsable) ; un routier reçoit 403.
   */
  async detail(actor: Actor, ref: { code: string } | { id: string }): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.readAny');
    const where = 'code' in ref ? { code: parseInput(attemptCodeSchema, ref.code) } : ref;
    const attempt = await this.prisma.evaluationAttempt.findUnique({
      where,
      include: detailInclude,
    });
    if (!attempt) throw attemptNotFound();
    const questions = await loadVersionQuestions(this.prisma, attempt.evaluationVersionId);
    const teamAtPreparation = await this.teams.teamAt(attempt.scoutProfileId, attempt.createdAt);
    return toDetail(attempt, questions, teamAtPreparation);
  }

  /**
   * Enregistre la correction (brouillon) : transcription des réponses papier, notes des questions
   * ouvertes, observations. Les questions objectives sont recalculées par le moteur déterministe.
   * Révision optimiste (`correctionRevision`) contre les corrections concurrentes ; chaque
   * enregistrement est historisé avec un instantané. Reprendre une copie soumise exige un motif.
   */
  async saveCorrection(
    actor: Actor,
    code: string,
    input: SaveCorrectionInput,
  ): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.record');
    const parsedCode = parseInput(attemptCodeSchema, code);
    const data = parseInput(saveCorrectionInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const attempt = await lockAttempt(tx, { code: parsedCode });
        if (attempt.correctionRevision !== data.correctionRevision) throw correctionConflict();
        if (!['PREPAREE', 'A_CORRIGER', 'SOUMISE'].includes(attempt.status)) {
          throw new ConflictException({
            code: 'ATTEMPT_NOT_CORRECTABLE',
            message:
              attempt.status === 'EN_COURS'
                ? 'Le routier n’a pas encore remis ses réponses.'
                : 'Ce résultat a déjà été examiné par le responsable : une réouverture est nécessaire.',
          });
        }
        if (attempt.status === 'SOUMISE' && !data.reason) {
          throw new UnprocessableEntityException({
            code: 'REASON_REQUIRED',
            message: 'Un motif est obligatoire pour corriger un résultat déjà soumis.',
          });
        }
        if (attempt.mode !== 'PAPIER' && data.answers?.length) {
          throw new UnprocessableEntityException({
            code: 'ANSWERS_NOT_EDITABLE',
            message:
              'Les réponses d’une tentative en ligne ne peuvent pas être modifiées par un correcteur.',
          });
        }
        const completedAt = data.completedAt ? new Date(data.completedAt) : attempt.completedAt;
        if (attempt.mode === 'PAPIER' && !completedAt) {
          throw new UnprocessableEntityException({
            code: 'COMPLETED_AT_REQUIRED',
            message: 'Indiquez la date à laquelle le routier a répondu sur papier.',
          });
        }

        // Le statut passe à A_CORRIGER avant toute écriture de réponse (trigger attempt_answers_guard).
        assertTransition(attempt.status, 'A_CORRIGER');
        if (attempt.status !== 'A_CORRIGER') {
          await tx.evaluationAttempt.update({
            where: { id: attempt.id },
            data: { status: 'A_CORRIGER' },
          });
        }

        const questions = await loadVersionQuestions(tx, attempt.evaluationVersionId);
        if (data.answers?.length) {
          await upsertAnswers(tx, attempt.id, normalizeAnswers(questions, data.answers));
        }
        await gradeObjectiveQuestions(tx, attempt.id, questions);
        const now = new Date();
        const byId = new Map(questions.map((question) => [question.id, question]));
        for (const grade of data.grades) {
          const question = byId.get(grade.questionId);
          if (!question) {
            throw new UnprocessableEntityException({
              code: 'INVALID_ANSWER',
              message: 'Une note ne correspond à aucune question de cette version.',
            });
          }
          const manual = !isObjectiveQuestion(question.type);
          if (
            manual &&
            grade.awardedPoints !== null &&
            grade.awardedPoints > Number(question.points)
          ) {
            throw new UnprocessableEntityException({
              code: 'POINTS_EXCEED_SCALE',
              message: `La note de la question ${question.position + 1} dépasse son barème.`,
            });
          }
          await tx.attemptAnswer.update({
            where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
            data: {
              ...(manual && { awardedPoints: grade.awardedPoints, autoScored: false }),
              appreciation: grade.appreciation,
              graderComment: grade.comment,
              gradedById: actor.userId,
              gradedAt: now,
            },
          });
        }
        const total = await this.total(tx, attempt.id, questions);
        await tx.evaluationAttempt.update({
          where: { id: attempt.id, correctionRevision: attempt.correctionRevision },
          data: {
            completedAt,
            score: total.score,
            maxScore: total.maxScore > 0 ? total.maxScore : null,
            ...(data.observations !== undefined && { observations: data.observations }),
            recordedAt: now,
            recordedById: actor.userId,
            correctionRevision: { increment: 1 },
          },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: attempt.id,
            actorId: actor.userId,
            fromStatus: attempt.status,
            toStatus: 'A_CORRIGER',
            reason: data.reason ?? null,
            snapshot: {
              answers: data.answers ?? [],
              grades: data.grades,
              observations: data.observations ?? null,
              completedAt: completedAt?.toISOString() ?? null,
              score: total.score,
              maxScore: total.maxScore,
            },
          },
        });
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw correctionConflict();
      throw error;
    }
    return this.detail(actor, { code: parsedCode });
  }

  /** Soumission du résultat corrigé au responsable : toutes les questions doivent être notées. */
  async submitReview(
    actor: Actor,
    code: string,
    input: CorrectionRevisionInput,
  ): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.submit');
    const parsedCode = parseInput(attemptCodeSchema, code);
    const { correctionRevision } = parseInput(correctionRevisionInputSchema, input);
    await this.transition(actor, { code: parsedCode }, 'SOUMISE', async (tx, attempt) => {
      if (attempt.correctionRevision !== correctionRevision) throw correctionConflict();
      const questions = await loadVersionQuestions(tx, attempt.evaluationVersionId);
      const total = await this.total(tx, attempt.id, questions);
      if (attempt.recordedAt === null && attempt.mode === 'PAPIER') {
        throw new UnprocessableEntityException({
          code: 'ATTEMPT_RESULT_MISSING',
          message: 'Le résultat doit être saisi avant la soumission.',
        });
      }
      if (!total.complete) {
        throw new UnprocessableEntityException({
          code: 'CORRECTION_INCOMPLETE',
          message: 'Toutes les réponses libres doivent être notées avant la soumission.',
        });
      }
      return {
        data: {
          score: total.score,
          maxScore: total.maxScore > 0 ? total.maxScore : null,
          correctionRevision: { increment: 1 },
        },
      };
    });
    return this.detail(actor, { code: parsedCode });
  }

  /**
   * Le responsable accepte le résultat corrigé (statut VALIDEE, « résultat accepté »).
   * Ce n'est ni la validation officielle d'un acquis ni un changement d'étape (RM-EVAL-004).
   */
  async acceptReview(
    actor: Actor,
    attemptId: string,
    input: AcceptReviewInput,
  ): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.decide');
    const { comment } = parseInput(acceptReviewInputSchema, input);
    await this.transition(
      actor,
      { id: attemptId },
      'VALIDEE',
      () => ({
        data: {
          decidedById: actor.userId,
          decidedAt: new Date(),
          decisionComment: comment ?? null,
        },
        reason: comment ?? undefined,
      }),
      'evaluation_attempt.review_accepted',
    );
    return this.detail(actor, { id: attemptId });
  }

  /** Le responsable renvoie la copie en correction (motif obligatoire, historisé). */
  async requestCorrection(
    actor: Actor,
    attemptId: string,
    input: AttemptReasonInput,
  ): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.decide');
    const { reason } = parseInput(attemptReasonInputSchema, input);
    await this.transition(
      actor,
      { id: attemptId },
      'A_CORRIGER',
      (_tx, attempt) => {
        if (attempt.status !== 'SOUMISE') throw invalidAttemptTransition();
        return { data: { correctionRevision: { increment: 1 } }, reason };
      },
      'evaluation_attempt.correction_requested',
    );
    return this.detail(actor, { id: attemptId });
  }

  /** Annulation : la tentative et son code restent dans l'historique (jamais réutilisé). */
  async cancel(actor: Actor, code: string, input: AttemptReasonInput): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.cancel');
    const parsedCode = parseInput(attemptCodeSchema, code);
    const { reason } = parseInput(attemptReasonInputSchema, input);
    await this.transition(
      actor,
      { code: parsedCode },
      'ANNULEE',
      () => ({ data: { cancelledAt: new Date(), cancelReason: reason }, reason }),
      'evaluation_attempt.cancelled',
    );
    return this.detail(actor, { code: parsedCode });
  }

  /** Réouverture administrative d'un résultat déjà examiné (responsable, motif obligatoire). */
  async reopen(
    actor: Actor,
    attemptId: string,
    input: AttemptReasonInput,
  ): Promise<CorrectionDetail> {
    assertCan(actor, 'attempt.reopen');
    const { reason } = parseInput(attemptReasonInputSchema, input);
    await this.transition(
      actor,
      { id: attemptId },
      'A_CORRIGER',
      (_tx, attempt) => {
        if (attempt.status !== 'VALIDEE' && attempt.status !== 'REFUSEE') {
          throw invalidAttemptTransition('Seule une tentative déjà examinée peut être rouverte.');
        }
        return {
          data: {
            decidedById: null,
            decidedAt: null,
            decisionComment: null,
            correctionRevision: { increment: 1 },
          },
          reason,
          snapshot: {
            previousDecision: attempt.status,
            previousDecidedById: attempt.decidedById,
            previousDecidedAt: attempt.decidedAt?.toISOString() ?? null,
            previousComment: attempt.decisionComment,
          },
        };
      },
      'evaluation_attempt.reopened',
    );
    return this.detail(actor, { id: attemptId });
  }

  /**
   * Données d'un document papier. Lecture seule : réimprimer ne crée jamais de tentative.
   * Questionnaire : tentative papier préparée uniquement. Corrigé et grille : chefs et responsable.
   */
  async paperDocumentData(
    actor: Actor,
    rawCode: string,
    document: 'questionnaire' | 'corrige' | 'grille',
  ): Promise<PaperDocumentData> {
    assertCan(actor, document === 'questionnaire' ? 'attempt.preparePaper' : 'attempt.readAny');
    const code = parseInput(attemptCodeSchema, rawCode);
    const attempt = await this.prisma.evaluationAttempt.findUnique({
      where: { code },
      include: {
        scoutProfile: true,
        evaluation: { select: { number: true, module: { include: moduleRefInclude } } },
        version: { select: { version: true, title: true, instructions: true } },
      },
    });
    if (!attempt) throw attemptNotFound();
    if (
      document === 'questionnaire' &&
      (attempt.mode !== 'PAPIER' || attempt.status !== 'PREPAREE')
    ) {
      throw new ConflictException({
        code: 'ATTEMPT_NOT_PRINTABLE',
        message: 'Seule une tentative papier en statut « Préparée » peut être imprimée.',
      });
    }
    const team = await this.teams.teamAt(attempt.scoutProfileId, attempt.createdAt);
    return {
      code: attempt.code,
      evaluationCode: formatEvaluationCode(attempt.evaluation.number),
      evaluationTitle: attempt.version.title,
      moduleTitle: toModuleRef(attempt.evaluation.module)?.title ?? null,
      version: attempt.version.version,
      instructions: attempt.version.instructions,
      scout: {
        firstName: attempt.scoutProfile.firstName,
        lastName: attempt.scoutProfile.lastName,
        matricule: attempt.scoutProfile.matricule,
      },
      teamName: team?.name ?? null,
      plannedFor: attempt.plannedFor,
      preparedAt: attempt.createdAt,
      questions: (await loadVersionQuestions(this.prisma, attempt.evaluationVersionId)).map(
        (question) =>
          document === 'questionnaire'
            ? {
                position: question.position,
                type: question.type,
                prompt: question.prompt,
                points: null,
                scoringPolicy: question.scoringPolicy,
                guidance: null,
                expectedAnswer: null,
                options: question.options.map((option) => ({
                  label: option.label,
                  isCorrect: null,
                })),
              }
            : {
                position: question.position,
                type: question.type,
                prompt: question.prompt,
                points: Number(question.points),
                scoringPolicy: question.scoringPolicy,
                guidance: question.guidance,
                expectedAnswer: question.expectedAnswer,
                options: question.options.map((option) => ({
                  label: option.label,
                  isCorrect: option.isCorrect,
                })),
              },
      ),
    };
  }

  // ─── Internes ────────────────────────────────────────────────────────────

  private async total(
    tx: Prisma.TransactionClient,
    attemptId: string,
    questions: readonly VersionQuestion[],
  ) {
    const answers = await tx.attemptAnswer.findMany({ where: { attemptId } });
    const awarded = new Map(answers.map((answer) => [answer.questionId, answer.awardedPoints]));
    return totalScore(
      questions.map((question) => ({
        points: Number(question.points),
        awardedPoints: toNumber(awarded.get(question.id) ?? null),
      })),
    );
  }

  /**
   * Changement d'état transactionnel : verrou de la ligne, contrôle de la transition, mise à jour
   * conditionnée au statut lu, événement d'historique et, si demandé, AuditLog.
   */
  private async transition(
    actor: Actor,
    ref: { code: string } | { id: string },
    to: AttemptStatus,
    prepare: (
      tx: Prisma.TransactionClient,
      attempt: EvaluationAttempt,
    ) => Promise<AttemptUpdate> | AttemptUpdate,
    auditAction?: string,
  ): Promise<EvaluationAttempt> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const attempt = await lockAttempt(tx, ref);
        assertTransition(attempt.status, to);
        const { data, reason, snapshot } = await prepare(tx, attempt);
        const updated = await tx.evaluationAttempt.update({
          where: { id: attempt.id, status: attempt.status },
          data: { ...data, status: to },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: attempt.id,
            actorId: actor.userId,
            fromStatus: attempt.status,
            toStatus: to,
            reason: reason ?? null,
            ...(snapshot === undefined ? {} : { snapshot }),
          },
        });
        if (auditAction) {
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: auditAction,
              entityType: 'EvaluationAttempt',
              entityId: attempt.id,
              metadata: { code: attempt.code, from: attempt.status, to },
            },
          });
        }
        return updated;
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw correctionConflict();
      // Réouverture alors qu'une nouvelle tentative est déjà ouverte pour cette évaluation.
      if (isUniqueViolation(error)) throw attemptAlreadyOpen();
      throw error;
    }
  }
}

interface AttemptUpdate {
  data: Prisma.EvaluationAttemptUncheckedUpdateInput;
  reason?: string | undefined;
  snapshot?: Prisma.InputJsonValue;
}

/** Verrouille la tentative (sérialise corrections, soumissions et décisions concurrentes). */
async function lockAttempt(
  tx: Prisma.TransactionClient,
  ref: { code: string } | { id: string },
): Promise<EvaluationAttempt> {
  const rows =
    'code' in ref
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM evaluation_attempts WHERE code = ${ref.code} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM evaluation_attempts WHERE id = ${ref.id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw attemptNotFound();
  return tx.evaluationAttempt.findUniqueOrThrow({ where: { id: rows[0]!.id } });
}

function scoutRef(profile: ListRow['scoutProfile']) {
  const team = profile.teamAssignments[0]?.team ?? null;
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    matricule: profile.matricule,
    hasAccount: profile.userId !== null,
    stage: toStageSummary(profile.currentStage),
    team: team && { id: team.id, name: team.name },
  };
}

function toListItem(row: ListRow): CorrectionListItem {
  return {
    id: row.id,
    code: row.code,
    mode: row.mode,
    status: row.status,
    scout: scoutRef(row.scoutProfile),
    evaluation: {
      id: row.evaluation.id,
      code: formatEvaluationCode(row.evaluation.number),
      title: row.version.title,
    },
    version: row.version.version,
    score: toNumber(row.score),
    maxScore: toNumber(row.maxScore),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    recordedBy: toUserSummary(row.recordedBy),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(
  row: DetailRow,
  questions: VersionQuestion[],
  teamAtPreparation: { id: string; name: string } | null,
): CorrectionDetail {
  const answers = new Map(row.attemptAnswers.map((answer) => [answer.questionId, answer]));
  const totalPoints = roundPoints(questions.reduce((sum, q) => sum + Number(q.points), 0));
  return {
    id: row.id,
    code: row.code,
    mode: row.mode,
    status: row.status,
    correctionRevision: row.correctionRevision,
    scout: {
      ...scoutRef(row.scoutProfile),
      isActive: row.scoutProfile.isActive,
      teamAtPreparation: teamAtPreparation && {
        id: teamAtPreparation.id,
        name: teamAtPreparation.name,
      },
    },
    evaluation: {
      id: row.evaluation.id,
      code: formatEvaluationCode(row.evaluation.number),
      title: row.version.title,
      stage: toStageSummary(row.evaluation.stage)!,
      module: toModuleRef(row.evaluation.module),
    },
    version: {
      id: row.version.id,
      version: row.version.version,
      title: row.version.title,
      instructions: row.version.instructions,
      totalPoints,
      isCurrent: row.evaluation.publishedVersionId === row.version.id,
    },
    plannedFor: row.plannedFor ? toIsoDate(row.plannedFor) : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: toUserSummary(row.createdBy)!,
    startedAt: row.startedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    recordedAt: row.recordedAt?.toISOString() ?? null,
    recordedBy: toUserSummary(row.recordedBy),
    observations: row.observations,
    score: toNumber(row.score),
    maxScore: toNumber(row.maxScore),
    waiver: row.waiver,
    decision: row.decidedAt
      ? {
          decidedAt: row.decidedAt.toISOString(),
          decidedBy: toUserSummary(row.decidedBy),
          comment: row.decisionComment,
        }
      : null,
    questions: questions.map((question) => {
      const answer = answers.get(question.id);
      return {
        ...toEditorQuestion(question),
        answer: answer
          ? {
              optionIds: answer.selectedOptionIds,
              text: answer.textAnswer,
              awardedPoints: toNumber(answer.awardedPoints),
              autoScored: answer.autoScored,
              appreciation: answer.appreciation,
              comment: answer.graderComment,
              gradedBy: toUserSummary(answer.gradedBy),
              gradedAt: answer.gradedAt?.toISOString() ?? null,
            }
          : null,
      };
    }),
    events: row.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actor: toUserSummary(event.actor)!,
      reason: event.reason,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function attemptNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'Tentative introuvable.' });
}

function attemptAlreadyOpen(): ConflictException {
  return new ConflictException({
    code: 'ATTEMPT_ALREADY_OPEN',
    message: 'Une tentative non clôturée existe déjà pour ce routier et cette évaluation.',
  });
}

function correctionConflict(): ConflictException {
  return new ConflictException({
    code: 'ATTEMPT_STATE_CHANGED',
    message:
      'La copie a été modifiée entre-temps par une autre personne. Rechargez-la puis recommencez.',
  });
}

function invalidAttemptTransition(
  message = 'Cette action n’est pas possible dans l’état actuel de la tentative.',
): ConflictException {
  return new ConflictException({ code: 'INVALID_ATTEMPT_TRANSITION', message });
}
