import { ConflictException, Injectable } from '@nestjs/common';
import {
  type ApproveModuleInput,
  approveModuleInputSchema,
  type EvaluationReview,
  type EvaluationSubmissionItem,
  type EvaluationSubmissionQuery,
  evaluationSubmissionQuerySchema,
  type MotivatedDecisionInput,
  motivatedDecisionInputSchema,
  type VersionActionInput,
  versionActionInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  evaluationNotFound,
  formatEvaluationCode,
  invalidEvaluationTransition,
  lockEvaluationVersion,
  moduleRefInclude,
  recordEvaluationEvent,
  toEvaluationVersionSummary,
  toModuleRef,
  versionSummaryInclude,
} from './evaluation-common.js';
import { EvaluationEditorService } from './evaluation-editor.service.js';

/**
 * Décisions sur les questionnaires, exclusivement réservées au responsable pédagogique :
 * approbation, demande de corrections, refus, publication (atomique) et archivage.
 * Chaque décision est historisée et journalisée dans la même transaction. Mêmes entrées que
 * les décisions sur les modules (`approveModuleInputSchema`, `motivatedDecisionInputSchema`).
 */
@Injectable()
export class EvaluationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editor: EvaluationEditorService,
  ) {}

  /** File des questionnaires soumis (distincte des modules et des résultats à examiner). */
  async submissions(
    actor: Actor,
    query: EvaluationSubmissionQuery,
  ): Promise<EvaluationSubmissionItem[]> {
    assertCan(actor, 'evaluation.review');
    const { status } = parseInput(evaluationSubmissionQuerySchema, query);
    const versions = await this.prisma.evaluationVersion.findMany({
      where: { status },
      include: {
        ...versionSummaryInclude,
        submittedBy: userSummarySelect,
        evaluation: {
          include: {
            stage: true,
            module: { include: moduleRefInclude },
            createdBy: userSummarySelect,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return versions.map((version) => ({
      evaluationId: version.evaluationId,
      code: formatEvaluationCode(version.evaluation.number),
      stage: toStageSummary(version.evaluation.stage)!,
      module: toModuleRef(version.evaluation.module),
      createdBy: toUserSummary(version.evaluation.createdBy),
      version: toEvaluationVersionSummary(version),
      submittedBy: toUserSummary(version.submittedBy),
      submissionNote: version.submissionNote,
      replacesPublished: version.evaluation.publishedVersionId !== null,
    }));
  }

  /** Contenu exact soumis (corrigé compris), historique et version publiée actuelle. */
  async review(actor: Actor, evaluationId: string): Promise<EvaluationReview> {
    assertCan(actor, 'evaluation.review');
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      select: { publishedVersionId: true },
    });
    if (!evaluation) throw evaluationNotFound();
    const detail = await this.editor.detail(actor, evaluationId, 'RESPONSABLE');
    const published =
      evaluation.publishedVersionId && evaluation.publishedVersionId !== detail.current.id
        ? await this.editor.versionDetail(evaluation.publishedVersionId)
        : null;
    return { evaluation: detail, published };
  }

  async approve(actor: Actor, evaluationId: string, input: ApproveModuleInput): Promise<void> {
    assertCan(actor, 'evaluation.review');
    const { versionId, comment } = parseInput(approveModuleInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'SOUMIS') throw invalidEvaluationTransition(locked.status);
      await tx.evaluationVersion.update({
        where: { id: versionId },
        data: { status: 'APPROUVE', approvedAt: new Date(), approvedById: actor.userId },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'APPROUVEE',
        fromStatus: 'SOUMIS',
        toStatus: 'APPROUVE',
        comment: comment ?? null,
        audit: 'evaluation.approved',
      });
    });
  }

  async requestChanges(
    actor: Actor,
    evaluationId: string,
    input: MotivatedDecisionInput,
  ): Promise<void> {
    assertCan(actor, 'evaluation.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'SOUMIS' && locked.status !== 'APPROUVE') {
        throw invalidEvaluationTransition(locked.status);
      }
      await tx.evaluationVersion.update({
        where: { id: versionId },
        data: { status: 'A_CORRIGER', approvedAt: null, approvedById: null },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'CORRECTIONS_DEMANDEES',
        fromStatus: locked.status,
        toStatus: 'A_CORRIGER',
        comment,
        audit: 'evaluation.changes_requested',
      });
    });
  }

  async reject(actor: Actor, evaluationId: string, input: MotivatedDecisionInput): Promise<void> {
    assertCan(actor, 'evaluation.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'SOUMIS') throw invalidEvaluationTransition(locked.status);
      await tx.evaluationVersion.update({ where: { id: versionId }, data: { status: 'REFUSE' } });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'REFUSEE',
        fromStatus: 'SOUMIS',
        toStatus: 'REFUSE',
        comment,
        audit: 'evaluation.rejected',
      });
    });
  }

  /**
   * Publication atomique d'une version approuvée. Cohérence avec le module évalué : celui-ci doit
   * être publié, et sa version en vigueur est enregistrée sur la version du questionnaire.
   * Les tentatives existantes restent liées à leur version (jamais modifiée).
   */
  async publish(actor: Actor, evaluationId: string, input: VersionActionInput): Promise<void> {
    assertCan(actor, 'evaluation.review');
    const { versionId } = parseInput(versionActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { published_version_id: string | null; module_id: string | null }[]
      >`SELECT published_version_id, module_id FROM evaluations WHERE id = ${evaluationId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw evaluationNotFound();
      const { published_version_id: previousId, module_id: moduleId } = rows[0]!;
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'APPROUVE') {
        throw new ConflictException({
          code: 'VERSION_NOT_APPROVED',
          message: 'Seule une version approuvée peut être publiée.',
        });
      }
      let moduleVersionId: string | null = null;
      if (moduleId) {
        const module = await tx.pedagogicalModule.findUniqueOrThrow({
          where: { id: moduleId },
          select: { publishedVersionId: true },
        });
        if (!module.publishedVersionId) {
          throw new ConflictException({
            code: 'MODULE_NOT_PUBLISHED',
            message: 'Le module évalué doit être publié avant son évaluation.',
          });
        }
        moduleVersionId = module.publishedVersionId;
      }
      const now = new Date();
      if (previousId) {
        await tx.evaluation.update({
          where: { id: evaluationId },
          data: { publishedVersionId: null },
        });
        await tx.evaluationVersion.update({
          where: { id: previousId },
          data: { status: 'ARCHIVE', archivedAt: now },
        });
        await recordEvaluationEvent(tx, actor, {
          evaluationId,
          versionId: previousId,
          action: 'REMPLACEE',
          fromStatus: 'PUBLIE',
          toStatus: 'ARCHIVE',
          comment: `Remplacée par la version ${locked.version}`,
        });
      }
      const published = await tx.evaluationVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLIE', publishedAt: now, publishedById: actor.userId, moduleVersionId },
      });
      await tx.evaluation.update({
        where: { id: evaluationId },
        data: { publishedVersionId: versionId, title: published.title },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'PUBLIEE',
        fromStatus: 'APPROUVE',
        toStatus: 'PUBLIE',
        audit: 'evaluation.published',
      });
    });
  }

  /** Retrait de la version publiée : plus aucune nouvelle tentative ; l'historique est conservé. */
  async archive(actor: Actor, evaluationId: string, input: MotivatedDecisionInput): Promise<void> {
    assertCan(actor, 'evaluation.review');
    const { versionId, comment } = parseInput(motivatedDecisionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM evaluations WHERE id = ${evaluationId}::uuid FOR UPDATE`;
      const locked = await lockEvaluationVersion(tx, evaluationId, versionId);
      if (locked.status !== 'PUBLIE') throw invalidEvaluationTransition(locked.status);
      await tx.evaluation.update({
        where: { id: evaluationId },
        data: { publishedVersionId: null },
      });
      await tx.evaluationVersion.update({
        where: { id: versionId },
        data: { status: 'ARCHIVE', archivedAt: new Date() },
      });
      await recordEvaluationEvent(tx, actor, {
        evaluationId,
        versionId,
        action: 'ARCHIVEE',
        fromStatus: 'PUBLIE',
        toStatus: 'ARCHIVE',
        comment,
        audit: 'evaluation.archived',
      });
    });
  }
}
