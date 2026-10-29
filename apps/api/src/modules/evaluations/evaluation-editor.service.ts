import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  type CreateEvaluationInput,
  createEvaluationInputSchema,
  type CreateQuestionInput,
  createQuestionInputSchema,
  type EditorEvaluationDetail,
  type EditorEvaluationListItem,
  type EditorEvaluationListQuery,
  editorEvaluationListQuerySchema,
  type EvaluationModuleRef,
  type EvaluationVersionDetail,
  MAX_QUESTIONS_PER_VERSION,
  type Paginated,
  type ReorderQuestionsInput,
  reorderQuestionsInputSchema,
  type SubmitEvaluationInput,
  submitEvaluationInputSchema,
  type UpdateEvaluationInput,
  updateEvaluationInputSchema,
  type UpdateQuestionInput,
  updateQuestionInputSchema,
  type VersionActionInput,
  versionActionInputSchema,
  WORKING_MODULE_STATUSES,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  editableEvaluationsWhere,
  editConflict,
  type EvaluationAccess,
  evaluationEventInclude,
  evaluationNotEditable,
  evaluationNotFound,
  evaluationVersionNotFound,
  formatEvaluationCode,
  invalidEvaluationTransition,
  lockEvaluationVersion,
  moduleRefInclude,
  questionNotFound,
  recordEvaluationEvent,
  resolveEvaluationAccess,
  toEvaluationEvent,
  toEvaluationVersionDetail,
  toEvaluationVersionSummary,
  toModuleRef,
  versionDetailInclude,
  versionSummaryInclude,
} from './evaluation-common.js';

const listInclude = {
  stage: true,
  module: { include: moduleRefInclude },
  createdBy: userSummarySelect,
  versions: { orderBy: { version: 'desc' }, include: versionSummaryInclude },
  _count: { select: { attempts: true } },
} as const satisfies Prisma.EvaluationInclude;

type ListRow = Prisma.EvaluationGetPayload<{ include: typeof listInclude }>;

const WORKING = WORKING_MODULE_STATUSES as readonly string[];

/**
 * Rédaction des questionnaires (chefs, responsable) : création, informations, questions, barèmes,
 * soumission, reprise et nouvelle version. Aucune méthode ne publie : publication réservée au
 * responsable (EvaluationReviewService). Toute écriture vérifie l'état BROUILLON (le trigger SQL aussi).
 */
@Injectable()
export class EvaluationEditorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: Actor,
    query: EditorEvaluationListQuery,
  ): Promise<Paginated<EditorEvaluationListItem>> {
    assertCan(actor, 'evaluation.write');
    const { page, pageSize, search, status } = parseInput(editorEvaluationListQuerySchema, query);
    const filters: Prisma.EvaluationWhereInput[] = [editableEvaluationsWhere(actor)];
    if (search) {
      filters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { versions: { some: { title: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }
    if (status === 'published') filters.push({ publishedVersionId: { not: null } });
    else if (status === 'working') {
      filters.push({ versions: { some: { status: { in: [...WORKING_MODULE_STATUSES] } } } });
    } else if (status !== 'all') filters.push({ versions: { some: { status } } });
    const where: Prisma.EvaluationWhereInput = { AND: filters };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluation.count({ where }),
      this.prisma.evaluation.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => this.toListItem(actor, row)),
      page,
      pageSize,
      total,
    };
  }

  /** Modules proposés au rattachement (titre de la version publiée ou de la plus récente). */
  async moduleOptions(actor: Actor): Promise<EvaluationModuleRef[]> {
    assertCan(actor, 'evaluation.write');
    const modules = await this.prisma.pedagogicalModule.findMany({
      include: moduleRefInclude,
      orderBy: { number: 'asc' },
    });
    return modules.map((module) => toModuleRef(module)!);
  }

  async create(actor: Actor, input: CreateEvaluationInput): Promise<EditorEvaluationDetail> {
    assertCan(actor, 'evaluation.write');
    const data = parseInput(createEvaluationInputSchema, input);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const evaluation = await tx.evaluation.create({
          data: {
            title: data.title,
            stageId: data.stageId,
            moduleId: data.moduleId ?? null,
            createdById: actor.userId,
          },
        });
        const version = await tx.evaluationVersion.create({
          data: {
            evaluationId: evaluation.id,
            version: 1,
            title: data.title,
            instructions: data.instructions,
            durationMinutes: data.durationMinutes ?? null,
            maxAttempts: data.maxAttempts ?? null,
            createdById: actor.userId,
          },
        });
        await recordEvaluationEvent(tx, actor, {
          evaluationId: evaluation.id,
          versionId: version.id,
          action: 'CREEE',
          fromStatus: null,
          toStatus: 'BROUILLON',
        });
        return evaluation.id;
      });
      return this.detail(actor, id);
    } catch (error) {
      if (isForeignKeyViolation(error)) throw unknownReference();
      throw error;
    }
  }

  async detail(
    actor: Actor,
    evaluationId: string,
    knownAccess?: EvaluationAccess,
  ): Promise<EditorEvaluationDetail> {
    const access = knownAccess ?? (await this.assertAccess(actor, evaluationId));
    const row = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        ...listInclude,
        events: { orderBy: { createdAt: 'desc' }, take: 50, include: evaluationEventInclude },
      },
    });
    if (!row) throw evaluationNotFound();
    const current =
      row.versions.find((version) => WORKING.includes(version.status)) ?? row.versions[0]!;
    const item = this.toListItem(actor, row, access);
    return {
      id: item.id,
      code: item.code,
      stage: item.stage,
      module: item.module,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      access: item.access,
      published: item.published,
      attemptCount: item.attemptCount,
      settingsEditable: row.versions.every((version) => version.publishedAt === null),
      current: await this.versionDetail(current.id),
      versions: row.versions.map(toEvaluationVersionSummary),
      events: row.events.map(toEvaluationEvent),
    };
  }

  async versionDetail(versionId: string): Promise<EvaluationVersionDetail> {
    const version = await this.prisma.evaluationVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: versionDetailInclude,
    });
    return toEvaluationVersionDetail(version);
  }

  async update(
    actor: Actor,
    evaluationId: string,
    input: UpdateEvaluationInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { versionId, revision, stageId, moduleId, ...fields } = parseInput(
      updateEvaluationInputSchema,
      input,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await this.lockDraft(tx, evaluationId, versionId);
        if (locked.revision !== revision) throw editConflict();
        if (stageId !== undefined || moduleId !== undefined) {
          const published = await tx.evaluationVersion.count({
            where: { evaluationId, publishedAt: { not: null } },
          });
          if (published > 0) {
            throw new ConflictException({
              code: 'EVALUATION_SETTINGS_LOCKED',
              message:
                'L’étape et le module ne sont plus modifiables après une première publication : créez une nouvelle évaluation.',
            });
          }
        }
        await tx.evaluationVersion.update({
          where: { id: versionId },
          data: {
            ...fields,
            revision: { increment: 1 },
            updatedById: actor.userId,
          },
        });
        // Libellé de référence suivi tant que l'évaluation n'a jamais été publiée.
        const neverPublished =
          (await tx.evaluationVersion.count({
            where: { evaluationId, publishedAt: { not: null } },
          })) === 0;
        await tx.evaluation.update({
          where: { id: evaluationId },
          data: {
            ...(stageId !== undefined && { stageId }),
            ...(moduleId !== undefined && { moduleId }),
            ...(neverPublished && fields.title !== undefined && { title: fields.title }),
          },
        });
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw unknownReference();
      throw error;
    }
    return this.detail(actor, evaluationId, access);
  }

  async addQuestion(
    actor: Actor,
    evaluationId: string,
    input: CreateQuestionInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { versionId, options, ...data } = parseInput(createQuestionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, evaluationId, versionId);
      const count = await tx.evaluationQuestion.count({ where: { versionId } });
      if (count >= MAX_QUESTIONS_PER_VERSION) {
        throw new UnprocessableEntityException({
          code: 'TOO_MANY_QUESTIONS',
          message: `${MAX_QUESTIONS_PER_VERSION} questions au maximum par questionnaire.`,
        });
      }
      await tx.evaluationQuestion.create({
        data: {
          ...data,
          ...normalizeQuestion(data.type, data.scoringPolicy),
          versionId,
          position: count,
          createdById: actor.userId,
          options: {
            create: options.map((option, position) => ({ ...option, position })),
          },
        },
      });
    });
    return this.detail(actor, evaluationId, access);
  }

  /** Remplacement complet d'une question et de ses propositions (contrôle de révision). */
  async updateQuestion(
    actor: Actor,
    evaluationId: string,
    questionId: string,
    input: UpdateQuestionInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { revision, options, ...data } = parseInput(updateQuestionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const question = await this.findQuestion(tx, evaluationId, questionId);
      await this.lockDraft(tx, evaluationId, question.versionId);
      if (question.revision !== revision) throw editConflict();
      await tx.evaluationAnswerOption.deleteMany({ where: { questionId } });
      await tx.evaluationQuestion.update({
        where: { id: questionId },
        data: {
          ...data,
          ...normalizeQuestion(data.type, data.scoringPolicy),
          revision: { increment: 1 },
          updatedById: actor.userId,
          options: { create: options.map((option, position) => ({ ...option, position })) },
        },
      });
    });
    return this.detail(actor, evaluationId, access);
  }

  async deleteQuestion(
    actor: Actor,
    evaluationId: string,
    questionId: string,
    revision: number,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    await this.prisma.$transaction(async (tx) => {
      const question = await this.findQuestion(tx, evaluationId, questionId);
      await this.lockDraft(tx, evaluationId, question.versionId);
      if (question.revision !== revision) throw editConflict();
      await tx.evaluationAnswerOption.deleteMany({ where: { questionId } });
      await tx.evaluationQuestion.delete({ where: { id: questionId } });
      await tx.evaluationQuestion.updateMany({
        where: { versionId: question.versionId, position: { gt: question.position } },
        data: { position: { decrement: 1 } },
      });
    });
    return this.detail(actor, evaluationId, access);
  }

  async reorderQuestions(
    actor: Actor,
    evaluationId: string,
    input: ReorderQuestionsInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { versionId, questionIds } = parseInput(reorderQuestionsInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, evaluationId, versionId);
      const existing = await tx.evaluationQuestion.findMany({
        where: { versionId },
        select: { id: true },
      });
      const expected = new Set(existing.map((question) => question.id));
      if (
        questionIds.length !== expected.size ||
        new Set(questionIds).size !== questionIds.length ||
        !questionIds.every((id) => expected.has(id))
      ) {
        throw editConflict();
      }
      for (const [position, id] of questionIds.entries()) {
        await tx.evaluationQuestion.update({ where: { id }, data: { position } });
      }
    });
    return this.detail(actor, evaluationId, access);
  }

  /** Soumission au responsable : au moins une question, informations à jour (révision). */
  async submit(
    actor: Actor,
    evaluationId: string,
    input: SubmitEvaluationInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { versionId, revision, note } = parseInput(submitEvaluationInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockDraft(tx, evaluationId, versionId);
      if (locked.revision !== revision) throw editConflict();
      if ((await tx.evaluationQuestion.count({ where: { versionId } })) === 0) {
        throw new UnprocessableEntityException({
          code: 'EVALUATION_EMPTY',
          message: 'Ajoutez au moins une question avant de soumettre le questionnaire.',
        });
      }
      await tx.evaluationVersion.update({
        where: { id: versionId },
        data: {
          status: 'SOUMIS',
          submittedAt: new Date(),
          submittedById: actor.userId,
          submissionNote: note ?? null,
        },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'SOUMISE',
        fromStatus: 'BROUILLON',
        toStatus: 'SOUMIS',
        comment: note ?? null,
      });
    });
    return this.detail(actor, evaluationId, access);
  }

  /** Reprise de la rédaction après une demande de corrections (A_CORRIGER → BROUILLON). */
  async resume(
    actor: Actor,
    evaluationId: string,
    input: VersionActionInput,
  ): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    const { versionId } = parseInput(versionActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'A_CORRIGER') throw invalidEvaluationTransition(locked.status);
      await tx.evaluationVersion.update({
        where: { id: versionId },
        data: { status: 'BROUILLON', updatedById: actor.userId },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'REPRISE',
        fromStatus: 'A_CORRIGER',
        toStatus: 'BROUILLON',
      });
    });
    return this.detail(actor, evaluationId, access);
  }

  /**
   * Nouvelle version de travail, copie de la version publiée (ou de la plus récente si aucune) :
   * la version publiée reste en ligne et inchangée jusqu'à la publication de la nouvelle.
   */
  async newVersion(actor: Actor, evaluationId: string): Promise<EditorEvaluationDetail> {
    const access = await this.assertAccess(actor, evaluationId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM evaluations WHERE id = ${evaluationId}::uuid FOR UPDATE`;
        const versions = await tx.evaluationVersion.findMany({
          where: { evaluationId },
          orderBy: { version: 'desc' },
          include: { questionItems: { orderBy: { position: 'asc' }, include: { options: true } } },
        });
        if (versions.some((version) => WORKING.includes(version.status))) {
          throw new ConflictException({
            code: 'WORKING_VERSION_EXISTS',
            message: 'Une version de travail existe déjà pour cette évaluation.',
          });
        }
        const base = versions.find((version) => version.status === 'PUBLIE') ?? versions[0]!;
        const created = await tx.evaluationVersion.create({
          data: {
            evaluationId,
            version: versions[0]!.version + 1,
            title: base.title,
            instructions: base.instructions,
            durationMinutes: base.durationMinutes,
            maxAttempts: base.maxAttempts,
            basedOnVersionId: base.id,
            createdById: actor.userId,
          },
        });
        for (const question of base.questionItems) {
          await tx.evaluationQuestion.create({
            data: {
              versionId: created.id,
              position: question.position,
              type: question.type,
              prompt: question.prompt,
              points: question.points,
              scoringPolicy: question.scoringPolicy,
              guidance: question.guidance,
              expectedAnswer: question.expectedAnswer,
              createdById: actor.userId,
              options: {
                create: question.options
                  .sort((a, b) => a.position - b.position)
                  .map(({ position, label, isCorrect }) => ({ position, label, isCorrect })),
              },
            },
          });
        }
        await recordEvaluationEvent(tx, actor, {
          evaluationId,
          versionId: created.id,
          action: 'CREEE',
          fromStatus: null,
          toStatus: 'BROUILLON',
          comment: `Reprise de la version ${base.version}`,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'WORKING_VERSION_EXISTS',
          message: 'Une version de travail existe déjà pour cette évaluation.',
        });
      }
      throw error;
    }
    return this.detail(actor, evaluationId, access);
  }

  // ─── Internes ────────────────────────────────────────────────────────────

  private async assertAccess(actor: Actor, evaluationId: string): Promise<EvaluationAccess> {
    assertCan(actor, 'evaluation.write');
    return resolveEvaluationAccess(this.prisma, actor, evaluationId);
  }

  private async lockDraft(tx: Prisma.TransactionClient, evaluationId: string, versionId: string) {
    const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
    if (locked.status !== 'BROUILLON') throw evaluationNotEditable(locked.status);
    return locked;
  }

  private async findQuestion(
    tx: Prisma.TransactionClient,
    evaluationId: string,
    questionId: string,
  ) {
    const question = await tx.evaluationQuestion.findUnique({
      where: { id: questionId },
      select: {
        versionId: true,
        position: true,
        revision: true,
        version: { select: { evaluationId: true } },
      },
    });
    if (!question || question.version.evaluationId !== evaluationId) throw questionNotFound();
    return question;
  }

  private toListItem(
    actor: Actor,
    row: ListRow,
    knownAccess?: EvaluationAccess,
  ): EditorEvaluationListItem {
    const latest = row.versions[0];
    if (!latest) throw evaluationVersionNotFound();
    const working = row.versions.find((version) => WORKING.includes(version.status));
    const published = row.versions.find((version) => version.id === row.publishedVersionId);
    const access: EvaluationAccess =
      knownAccess ??
      (actor.role === 'RESPONSABLE'
        ? 'RESPONSABLE'
        : row.createdById === actor.userId
          ? 'AUTEUR'
          : 'REDACTEUR_DU_MODULE');
    return {
      id: row.id,
      code: formatEvaluationCode(row.number),
      stage: toStageSummary(row.stage)!,
      module: toModuleRef(row.module),
      createdBy: toUserSummary(row.createdBy),
      createdAt: row.createdAt.toISOString(),
      access,
      working: working ? toEvaluationVersionSummary(working) : null,
      published: published ? toEvaluationVersionSummary(published) : null,
      latest: toEvaluationVersionSummary(latest),
      attemptCount: row._count.attempts,
    };
  }
}

/** La politique de notation ne s'applique qu'aux choix multiples. */
function normalizeQuestion(
  type: CreateQuestionInput['type'],
  scoringPolicy: 'TOUT_OU_RIEN' | 'CREDIT_PARTIEL',
) {
  return { scoringPolicy: type === 'CHOIX_MULTIPLE' ? scoringPolicy : ('TOUT_OU_RIEN' as const) };
}

function unknownReference(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'UNKNOWN_REFERENCE',
    message: 'Étape ou module introuvable.',
  });
}
