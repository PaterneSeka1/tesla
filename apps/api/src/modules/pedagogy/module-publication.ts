import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { pendingEditorialNotes } from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { currentEditorialNotes, lockVersion, moduleNotFound, recordEvent } from './module-common.js';

/**
 * Approbation et publication d'une version, dans la transaction appelante. Partagées par les
 * décisions du responsable (`ModuleReviewService`) et par la soumission du responsable plein en
 * fonction, qui publie directement son propre travail (D188) : mêmes contrôles, mêmes événements
 * historisés, mêmes entrées du journal d'audit.
 */

/** SOUMIS → APPROUVE. La version doit être verrouillée et à l'état SOUMIS. */
export async function approveSubmittedVersion(
  tx: Prisma.TransactionClient,
  actor: Actor,
  moduleId: string,
  versionId: string,
  options: { comment: string | null; editorialNotesAcknowledged?: boolean },
): Promise<void> {
  const notes = await currentEditorialNotes(tx, moduleId);
  const pending = notes ? pendingEditorialNotes(notes).length : 0;
  if (pending > 0 && options.editorialNotesAcknowledged !== true) {
    throw new UnprocessableEntityException({
      code: 'EDITORIAL_NOTES_NOT_ACKNOWLEDGED',
      message:
        'Ce module importé comporte des points à vérifier ou à compléter : confirmez les avoir traités avant d’approuver ou de publier.',
    });
  }
  await tx.moduleVersion.update({
    where: { id: versionId },
    data: { status: 'APPROUVE', approvedAt: new Date(), approvedById: actor.userId },
  });
  await recordEvent(tx, actor, {
    moduleId,
    versionId,
    action: 'APPROUVEE',
    fromStatus: 'SOUMIS',
    toStatus: 'APPROUVE',
    comment: options.comment,
    audit: 'module.approved',
    ...(pending > 0 && { metadata: { editorialNotesAcknowledged: pending } }),
  });
}

/**
 * Publication atomique d'une version approuvée : l'éventuelle version publiée précédente est
 * archivée et le pointeur du module basculé dans la même transaction (jamais deux versions publiées).
 */
export async function publishApprovedVersion(
  tx: Prisma.TransactionClient,
  actor: Actor,
  moduleId: string,
  versionId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ published_version_id: string | null }[]>`
    SELECT published_version_id FROM pedagogical_modules WHERE id = ${moduleId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw moduleNotFound();
  const previousId = rows[0]!.published_version_id;
  const locked = await lockVersion(tx, moduleId, versionId);
  if (locked.status !== 'APPROUVE') {
    throw new ConflictException({
      code: 'VERSION_NOT_APPROVED',
      message: 'Seule une version approuvée peut être publiée.',
    });
  }
  const now = new Date();
  if (previousId) {
    await tx.pedagogicalModule.update({
      where: { id: moduleId },
      data: { publishedVersionId: null },
    });
    await tx.moduleVersion.update({
      where: { id: previousId },
      data: { status: 'ARCHIVE', archivedAt: now },
    });
    await recordEvent(tx, actor, {
      moduleId,
      versionId: previousId,
      action: 'REMPLACEE',
      fromStatus: 'PUBLIE',
      toStatus: 'ARCHIVE',
      comment: `Remplacée par la version ${locked.version}.`,
    });
  }
  await tx.moduleVersion.update({
    where: { id: versionId },
    data: { status: 'PUBLIE', publishedAt: now, publishedById: actor.userId },
  });
  await tx.pedagogicalModule.update({
    where: { id: moduleId },
    data: { publishedVersionId: versionId },
  });
  await recordEvent(tx, actor, {
    moduleId,
    versionId,
    action: 'PUBLIEE',
    fromStatus: 'APPROUVE',
    toStatus: 'PUBLIE',
    audit: 'module.published',
    metadata: { replacedVersionId: previousId },
  });
}
