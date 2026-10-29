import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AttemptSession,
  type AvailableEvaluation,
  type AvailableEvaluationQuery,
  availableEvaluationQuerySchema,
  ELIGIBILITY_LABELS,
  type MyAttempt,
  type MyAttemptQuery,
  myAttemptQuerySchema,
  type Paginated,
  type SaveAnswersInput,
  saveAnswersInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary } from '../scouts/presenters.js';
import { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';
import { issueAttemptCode } from './attempt-code.js';
import {
  gradeObjectiveQuestions,
  loadEligibility,
  loadVersionQuestions,
  normalizeAnswers,
  upsertAnswers,
} from './attempt-answers.js';
import { computeEligibility } from './eligibility.js';
import {
  evaluationNotFound,
  formatEvaluationCode,
  moduleRefInclude,
  toModuleRef,
} from './evaluation-common.js';

const availableInclude = {
  stage: true,
  module: { include: moduleRefInclude },
  publishedVersion: { include: { _count: { select: { questionItems: true } } } },
} as const satisfies Prisma.EvaluationInclude;

type AvailableRow = Prisma.EvaluationGetPayload<{ include: typeof availableInclude }>;

const sessionInclude = {
  evaluation: { select: { id: true } },
  version: { select: { version: true, title: true, instructions: true, durationMinutes: true } },
  attemptAnswers: true,
} as const satisfies Prisma.EvaluationAttemptInclude;

function attemptNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'Tentative introuvable.' });
}

/**
 * Évaluations publiées et passation en ligne par le routier (RM-EVAL-001, 002, 005).
 * Le routier ne reçoit jamais le corrigé ni les barèmes avant l'examen de son résultat.
 * Aucune méthode ne modifie l'étape de progression.
 */
@Injectable()
export class EvaluationSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Évaluations publiées. Pour un routier : son éligibilité ; pour un chef ou le responsable :
   * l'éligibilité du routier désigné par `scoutProfileId` (préparation papier), sinon aucune.
   */
  async list(
    actor: Actor,
    query: AvailableEvaluationQuery,
  ): Promise<Paginated<AvailableEvaluation>> {
    assertCan(actor, 'evaluation.read');
    const { page, pageSize, search, stageId, scoutProfileId } = parseInput(
      availableEvaluationQuerySchema,
      query,
    );
    const where: Prisma.EvaluationWhereInput = {
      publishedVersionId: { not: null },
      ...(stageId && { stageId }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluation.count({ where }),
      this.prisma.evaluation.findMany({
        where,
        include: availableInclude,
        orderBy: [{ stage: { position: 'asc' } }, { number: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const subject = await this.subject(actor, scoutProfileId);
    const ids = rows.map((row) => row.id);
    const [attempts, waivers] = subject?.profile
      ? await this.prisma.$transaction([
          this.prisma.evaluationAttempt.findMany({
            where: { scoutProfileId: subject.profile.id, evaluationId: { in: ids } },
            select: { id: true, code: true, mode: true, status: true, evaluationId: true },
          }),
          this.prisma.evaluationWaiver.findMany({
            where: { scoutProfileId: subject.profile.id, evaluationId: { in: ids } },
          }),
        ])
      : [[], []];
    const now = new Date();
    return {
      items: rows.map((row) =>
        toAvailable(
          row,
          subject &&
            computeEligibility({
              profile: subject.profile,
              evaluationStageId: row.stageId,
              maxAttempts: row.publishedVersion!.maxAttempts,
              attempts: attempts.filter((attempt) => attempt.evaluationId === row.id),
              waivers: waivers.filter((waiver) => waiver.evaluationId === row.id),
              now,
            }),
        ),
      ),
      page,
      pageSize,
      total,
    };
  }

  async detail(actor: Actor, evaluationId: string): Promise<AvailableEvaluation> {
    assertCan(actor, 'evaluation.read');
    const row = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: availableInclude,
    });
    if (!row?.publishedVersion) throw evaluationNotFound();
    const subject = await this.subject(actor);
    const eligibility =
      subject &&
      (await loadEligibility(this.prisma, {
        profile: subject.profile,
        evaluation: row,
        maxAttempts: row.publishedVersion.maxAttempts,
        now: new Date(),
      }));
    return toAvailable(row, eligibility);
  }

  /**
   * Démarre (ou reprend) une tentative en ligne. Contrôles serveur dans la transaction : profil,
   * étape ou dérogation active, version publiée, limite de tentatives. Idempotent : un double clic
   * renvoie la tentative déjà ouverte au lieu d'en créer une seconde.
   */
  async start(actor: Actor, evaluationId: string): Promise<AttemptSession> {
    assertCan(actor, 'evaluation.take');
    let attemptId: string;
    try {
      attemptId = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const profile = await tx.scoutProfile.findUnique({ where: { userId: actor.userId } });
        const evaluation = await tx.evaluation.findUnique({
          where: { id: evaluationId },
          include: { publishedVersion: true },
        });
        if (!evaluation?.publishedVersion) throw evaluationNotFound();
        const eligibility = await loadEligibility(tx, {
          profile,
          evaluation,
          maxAttempts: evaluation.publishedVersion.maxAttempts,
          now,
        });
        const open = eligibility.openAttempt;
        if (open) {
          if (open.mode === 'EN_LIGNE' && open.status === 'EN_COURS') return open.id;
          throw new ConflictException({
            code: 'ATTEMPT_ALREADY_OPEN',
            message:
              'Une tentative est déjà en cours pour cette évaluation (sur papier ou en correction).',
          });
        }
        if (!eligibility.allowed || !profile) {
          throw new ForbiddenException({
            code: 'EVALUATION_NOT_ELIGIBLE',
            message: `Évaluation non accessible : ${ELIGIBILITY_LABELS[eligibility.status].toLowerCase()}.`,
          });
        }
        const attempt = await tx.evaluationAttempt.create({
          data: {
            code: await issueAttemptCode(tx, now),
            scoutProfileId: profile.id,
            evaluationId,
            evaluationVersionId: evaluation.publishedVersion.id,
            mode: 'EN_LIGNE',
            status: 'EN_COURS',
            startedAt: now,
            waiverId: eligibility.waiver?.id ?? null,
            createdById: actor.userId,
          },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: attempt.id,
            actorId: actor.userId,
            fromStatus: null,
            toStatus: 'EN_COURS',
          },
        });
        return attempt.id;
      });
    } catch (error) {
      // Démarrage concurrent : l'index « une tentative ouverte » a refusé le doublon ; on reprend l'existante.
      if (!isUniqueViolation(error)) throw error;
      const open = await this.prisma.evaluationAttempt.findFirst({
        where: {
          evaluationId,
          status: 'EN_COURS',
          mode: 'EN_LIGNE',
          scoutProfile: { userId: actor.userId },
        },
        select: { id: true },
      });
      if (!open) throw error;
      attemptId = open.id;
    }
    return this.session(actor, attemptId);
  }

  /** Questionnaire d'une tentative en ligne du routier connecté (sans corrigé ni barème). */
  async session(actor: Actor, attemptId: string): Promise<AttemptSession> {
    assertCan(actor, 'evaluation.take');
    const attempt = await this.prisma.evaluationAttempt.findUnique({
      where: { id: attemptId },
      include: { ...sessionInclude, scoutProfile: { select: { userId: true } } },
    });
    if (
      !attempt ||
      !['EN_LIGNE', 'HORS_LIGNE'].includes(attempt.mode) ||
      attempt.scoutProfile.userId !== actor.userId
    ) {
      throw attemptNotFound();
    }
    const questions = await loadVersionQuestions(this.prisma, attempt.evaluationVersionId);
    return {
      id: attempt.id,
      code: attempt.code,
      mode: attempt.mode,
      status: attempt.status,
      evaluation: {
        id: attempt.evaluation.id,
        title: attempt.version.title,
        instructions: attempt.version.instructions,
        durationMinutes: attempt.version.durationMinutes,
      },
      version: attempt.version.version,
      startedAt: attempt.startedAt?.toISOString() ?? null,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      questions: questions.map((question) => ({
        id: question.id,
        position: question.position,
        type: question.type,
        prompt: question.prompt,
        options: question.options.map((option) => ({ id: option.id, label: option.label })),
      })),
      answers: attempt.attemptAnswers.map((answer) => ({
        questionId: answer.questionId,
        optionIds: answer.selectedOptionIds,
        text: answer.textAnswer,
      })),
    };
  }

  /** Sauvegarde des réponses en cours (tentative EN_COURS du routier uniquement). */
  async saveAnswers(
    actor: Actor,
    attemptId: string,
    input: SaveAnswersInput,
  ): Promise<AttemptSession> {
    assertCan(actor, 'evaluation.take');
    const { answers } = parseInput(saveAnswersInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const attempt = await this.lockOwnAttempt(tx, actor, attemptId);
      const questions = await loadVersionQuestions(tx, attempt.evaluation_version_id);
      await upsertAnswers(tx, attemptId, normalizeAnswers(questions, answers));
    });
    return this.session(actor, attemptId);
  }

  /**
   * Remise définitive : correction automatique des questions objectives, puis statut A_CORRIGER
   * (les réponses libres attendent un correcteur). Une seconde remise est refusée (409) : la ligne
   * de la tentative est verrouillée et son statut contrôlé dans la même transaction.
   */
  async submit(actor: Actor, attemptId: string, input?: SaveAnswersInput): Promise<AttemptSession> {
    assertCan(actor, 'evaluation.take');
    const finalAnswers = input?.answers?.length
      ? parseInput(saveAnswersInputSchema, input).answers
      : [];
    await this.prisma.$transaction(async (tx) => {
      const attempt = await this.lockOwnAttempt(tx, actor, attemptId);
      const questions = await loadVersionQuestions(tx, attempt.evaluation_version_id);
      await upsertAnswers(tx, attemptId, normalizeAnswers(questions, finalAnswers));
      const total = await gradeObjectiveQuestions(tx, attemptId, questions);
      const now = new Date();
      await tx.evaluationAttempt.update({
        where: { id: attemptId, status: 'EN_COURS' },
        data: {
          status: 'A_CORRIGER',
          submittedAt: now,
          completedAt: now,
          score: total.score,
          maxScore: total.maxScore > 0 ? total.maxScore : null,
        },
      });
      await tx.evaluationAttemptEvent.create({
        data: {
          attemptId,
          actorId: actor.userId,
          fromStatus: 'EN_COURS',
          toStatus: 'A_CORRIGER',
          snapshot: { autoScore: total.score, maxScore: total.maxScore, complete: total.complete },
        },
      });
    });
    return this.session(actor, attemptId);
  }

  /**
   * Historique du routier connecté (en ligne et papier). Le détail du résultat n'est transmis
   * qu'une fois le résultat accepté par le responsable, sans les bonnes réponses (D61).
   */
  async myAttempts(actor: Actor, query: MyAttemptQuery): Promise<Paginated<MyAttempt>> {
    assertCan(actor, 'evaluation.take');
    const { page, pageSize, evaluationId } = parseInput(myAttemptQuerySchema, query);
    const where: Prisma.EvaluationAttemptWhereInput = {
      scoutProfile: { userId: actor.userId },
      ...(evaluationId && { evaluationId }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluationAttempt.count({ where }),
      this.prisma.evaluationAttempt.findMany({
        where,
        include: {
          version: { select: { version: true, title: true } },
          attemptAnswers: {
            include: {
              question: { select: { position: true, type: true, prompt: true, points: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        mode: row.mode,
        status: row.status,
        evaluation: { id: row.evaluationId, title: row.version.title },
        version: row.version.version,
        createdAt: row.createdAt.toISOString(),
        startedAt: row.startedAt?.toISOString() ?? null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        result:
          row.status === 'VALIDEE' && row.score !== null && row.maxScore !== null
            ? {
                score: Number(row.score),
                maxScore: Number(row.maxScore),
                reviewedAt: row.decidedAt?.toISOString() ?? null,
                comment: row.decisionComment,
                questions: row.attemptAnswers
                  .sort((a, b) => a.question.position - b.question.position)
                  .map((answer) => ({
                    id: answer.questionId,
                    position: answer.question.position,
                    type: answer.question.type,
                    prompt: answer.question.prompt,
                    points: Number(answer.question.points),
                    awardedPoints:
                      answer.awardedPoints === null ? null : Number(answer.awardedPoints),
                    appreciation: answer.appreciation,
                    comment: answer.graderComment,
                  })),
              }
            : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  // ─── Internes ────────────────────────────────────────────────────────────

  /** Routier dont on calcule l'éligibilité : soi-même (routier) ou le routier désigné (chefs). */
  private async subject(
    actor: Actor,
    scoutProfileId?: string,
  ): Promise<{
    profile: { id: string; isActive: boolean; currentStageId: string | null } | null;
  } | null> {
    if (actor.role === 'ROUTIER') {
      return {
        profile: await this.prisma.scoutProfile.findUnique({ where: { userId: actor.userId } }),
      };
    }
    if (!scoutProfileId || !can(actor, 'attempt.preparePaper')) return null;
    const profile = await this.prisma.scoutProfile.findUnique({ where: { id: scoutProfileId } });
    if (!profile) throw scoutProfileNotFound();
    return { profile };
  }

  /** Verrou de la tentative du routier connecté, en cours et en ligne ; sinon 404 ou 409. */
  private async lockOwnAttempt(tx: Prisma.TransactionClient, actor: Actor, attemptId: string) {
    const rows = await tx.$queryRaw<
      { status: string; mode: string; evaluation_version_id: string; user_id: string | null }[]
    >`SELECT a.status, a.mode, a.evaluation_version_id, p.user_id
      FROM evaluation_attempts a JOIN scout_profiles p ON p.id = a.scout_profile_id
      WHERE a.id = ${attemptId}::uuid FOR UPDATE OF a`;
    const attempt = rows[0];
    if (!attempt || attempt.mode !== 'EN_LIGNE' || attempt.user_id !== actor.userId) {
      throw attemptNotFound();
    }
    if (attempt.status !== 'EN_COURS') {
      throw new ConflictException({
        code: 'ATTEMPT_ALREADY_SUBMITTED',
        message: 'Vos réponses ont déjà été remises : elles ne sont plus modifiables.',
      });
    }
    return attempt;
  }
}

function toAvailable(
  row: AvailableRow,
  eligibility: AvailableEvaluation['eligibility'],
): AvailableEvaluation {
  const version = row.publishedVersion!;
  return {
    id: row.id,
    code: formatEvaluationCode(row.number),
    title: version.title,
    instructions: version.instructions,
    stage: toStageSummary(row.stage)!,
    module: toModuleRef(row.module),
    versionId: version.id,
    version: version.version,
    questionCount: version._count.questionItems,
    durationMinutes: version.durationMinutes,
    maxAttempts: version.maxAttempts,
    publishedAt: version.publishedAt!.toISOString(),
    eligibility,
  };
}
