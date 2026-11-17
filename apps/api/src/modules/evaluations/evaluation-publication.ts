import { ConflictException } from '@nestjs/common';
import { type Actor } from '../../common/actor.js';
import { type Prisma } from '../../generated/prisma/client.js';
import {
  evaluationNotFound,
  lockEvaluationVersion,
  recordEvaluationEvent,
} from './evaluation-common.js';

/**
 * Approbation et publication d'une version de questionnaire, dans la transaction appelante.
 * Partagées par les décisions du responsable (`EvaluationReviewService`) et par la soumission du
 * responsable plein en fonction, qui publie directement son propre travail (D188).
 */

/** SOUMIS → APPROUVE. La version doit être verrouillée et à l'état SOUMIS. */
export async function approveSubmittedEvaluationVersion(
  tx: Prisma.TransactionClient,
  actor: Actor,
  evaluationId: string,
  versionId: string,
  comment: string | null,
): Promise<void> {
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
    comment,
    audit: 'evaluation.approved',
  });
}

/**
 * Publication atomique d'une version approuvée (version précédente archivée, module évalué
 * obligatoirement publié et figé sur sa version publiée).
 */
export async function publishApprovedEvaluationVersion(
  tx: Prisma.TransactionClient,
  actor: Actor,
  evaluationId: string,
  versionId: string,
): Promise<void> {
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
}
