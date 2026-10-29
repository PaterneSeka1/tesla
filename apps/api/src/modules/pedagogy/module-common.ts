import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  formatModuleCode,
  type LessonDocument,
  type ModuleEvent,
  type ModuleVersionAction,
  type ModuleVersionDetail,
  type ModuleVersionStatus,
  type ModuleVersionSummary,
  WORKING_MODULE_STATUSES,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { can } from '../../common/permissions.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';

export { formatModuleCode };

export type ModuleAccess = 'AUTEUR' | 'COLLABORATEUR' | 'RESPONSABLE';

// ─── Erreurs métier ────────────────────────────────────────────────────────

export function moduleNotFound(): NotFoundException {
  return new NotFoundException({ code: 'MODULE_NOT_FOUND', message: 'Module introuvable.' });
}

export function versionNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'MODULE_VERSION_NOT_FOUND',
    message: 'Version introuvable pour ce module.',
  });
}

export function lessonNotFound(): NotFoundException {
  return new NotFoundException({ code: 'LESSON_NOT_FOUND', message: 'Leçon introuvable.' });
}

export function editConflict(): ConflictException {
  return new ConflictException({
    code: 'EDIT_CONFLICT',
    message:
      'Ce contenu a été modifié par une autre personne entre-temps. Rechargez-le avant d’enregistrer.',
  });
}

export function versionNotEditable(status: ModuleVersionStatus): ConflictException {
  const message =
    status === 'A_CORRIGER'
      ? 'Des corrections ont été demandées : reprenez la rédaction pour modifier cette version.'
      : 'Cette version n’est plus modifiable : seule une version à l’état brouillon peut être modifiée.';
  return new ConflictException({ code: 'VERSION_NOT_EDITABLE', message });
}

export function invalidTransition(status: ModuleVersionStatus): ConflictException {
  return new ConflictException({
    code: 'INVALID_TRANSITION',
    message: `Action impossible : la version est à l’état « ${status} ».`,
  });
}

// ─── Accès ─────────────────────────────────────────────────────────────────

/** Modules sur lesquels l'acteur peut intervenir (tous pour le responsable). */
export function editableModulesWhere(actor: Actor): Prisma.PedagogicalModuleWhereInput {
  if (can(actor, 'module.writeAny')) return {};
  return {
    OR: [
      { createdById: actor.userId },
      { collaborators: { some: { userId: actor.userId, removedAt: null } } },
    ],
  };
}

/**
 * Relation de l'acteur avec un module ; `null` s'il n'y a pas accès.
 * Un chef sans accès reçoit 404 (l'existence d'un brouillon n'est pas révélée).
 */
export async function resolveAccess(
  client: Prisma.TransactionClient,
  actor: Actor,
  moduleId: string,
): Promise<{ access: ModuleAccess; createdById: string; publishedVersionId: string | null }> {
  const module = await client.pedagogicalModule.findUnique({
    where: { id: moduleId },
    select: {
      createdById: true,
      publishedVersionId: true,
      collaborators: { where: { userId: actor.userId, removedAt: null }, select: { id: true } },
    },
  });
  if (!module) throw moduleNotFound();
  const access: ModuleAccess | null = can(actor, 'module.writeAny')
    ? 'RESPONSABLE'
    : module.createdById === actor.userId
      ? 'AUTEUR'
      : module.collaborators.length > 0
        ? 'COLLABORATEUR'
        : null;
  if (!access) throw moduleNotFound();
  return { access, createdById: module.createdById, publishedVersionId: module.publishedVersionId };
}

/** Verrouille la version (sérialise éditions et transitions) et vérifie son appartenance au module. */
export async function lockVersion(
  tx: Prisma.TransactionClient,
  moduleId: string,
  versionId: string,
  mode: 'UPDATE' | 'SHARE' = 'UPDATE',
): Promise<{ status: ModuleVersionStatus; revision: number; version: number }> {
  const rows =
    mode === 'UPDATE'
      ? await tx.$queryRaw<
          { module_id: string; status: ModuleVersionStatus; revision: number; version: number }[]
        >`
          SELECT module_id, status, revision, version FROM module_versions WHERE id = ${versionId}::uuid FOR UPDATE`
      : await tx.$queryRaw<
          { module_id: string; status: ModuleVersionStatus; revision: number; version: number }[]
        >`
          SELECT module_id, status, revision, version FROM module_versions WHERE id = ${versionId}::uuid FOR SHARE`;
  const row = rows[0];
  if (!row || row.module_id !== moduleId) throw versionNotFound();
  return { status: row.status, revision: row.revision, version: row.version };
}

export function isWorkingStatus(status: ModuleVersionStatus): boolean {
  return (WORKING_MODULE_STATUSES as readonly string[]).includes(status);
}

/** Historique en ajout seul (+ journal d'audit pour les décisions du responsable). */
export async function recordEvent(
  tx: Prisma.TransactionClient,
  actor: Actor,
  event: {
    moduleId: string;
    versionId: string;
    action: ModuleVersionAction;
    fromStatus: ModuleVersionStatus | null;
    toStatus: ModuleVersionStatus;
    comment?: string | null;
    audit?: string;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.moduleVersionEvent.create({
    data: {
      moduleId: event.moduleId,
      versionId: event.versionId,
      actorId: actor.userId,
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      comment: event.comment ?? null,
    },
  });
  if (event.audit) {
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: event.audit,
        entityType: 'ModuleVersion',
        entityId: event.versionId,
        metadata: {
          moduleId: event.moduleId,
          from: event.fromStatus,
          to: event.toStatus,
          ...(event.comment && { comment: event.comment }),
          ...event.metadata,
        },
      },
    });
  }
}

// ─── Présentation ──────────────────────────────────────────────────────────

export const versionSummaryInclude = {
  stage: true,
  _count: { select: { lessons: true } },
} as const satisfies Prisma.ModuleVersionInclude;

export const versionDetailInclude = {
  stage: true,
  basedOn: { select: { version: true } },
  createdBy: userSummarySelect,
  updatedBy: userSummarySelect,
  submittedBy: userSummarySelect,
  approvedBy: userSummarySelect,
  publishedBy: userSummarySelect,
  lessons: { orderBy: { position: 'asc' }, include: { updatedBy: userSummarySelect } },
  resources: { orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.ModuleVersionInclude;

export const eventInclude = {
  actor: userSummarySelect,
  version: { select: { version: true, title: true } },
} as const satisfies Prisma.ModuleVersionEventInclude;

type SummaryRow = Prisma.ModuleVersionGetPayload<{ include: typeof versionSummaryInclude }>;
type DetailRow = Prisma.ModuleVersionGetPayload<{ include: typeof versionDetailInclude }>;
type EventRow = Prisma.ModuleVersionEventGetPayload<{ include: typeof eventInclude }>;
type ResourceRow = DetailRow['resources'][number];

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toVersionSummary(row: SummaryRow): ModuleVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    stage: toStageSummary(row.stage),
    theme: row.theme,
    lessonCount: row._count.lessons,
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: iso(row.submittedAt),
    publishedAt: iso(row.publishedAt),
  };
}

export function toResource(row: ResourceRow) {
  return {
    id: row.id,
    lessonId: row.lessonId,
    kind: row.kind,
    title: row.title,
    url: row.url,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Le contenu a été validé par `lessonDocumentSchema` à l'écriture. */
export function toLessonDocument(content: Prisma.JsonValue): LessonDocument {
  return content as unknown as LessonDocument;
}

export function toVersionDetail(row: DetailRow): ModuleVersionDetail {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    summary: row.summary,
    objectives: row.objectives,
    prerequisites: row.prerequisites,
    durationMinutes: row.durationMinutes,
    stage: toStageSummary(row.stage),
    theme: row.theme,
    revision: row.revision,
    basedOnVersion: row.basedOn?.version ?? null,
    createdBy: toUserSummary(row.createdBy)!,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: toUserSummary(row.updatedBy),
    submittedAt: iso(row.submittedAt),
    submittedBy: toUserSummary(row.submittedBy),
    submissionNote: row.submissionNote,
    approvedAt: iso(row.approvedAt),
    approvedBy: toUserSummary(row.approvedBy),
    publishedAt: iso(row.publishedAt),
    publishedBy: toUserSummary(row.publishedBy),
    archivedAt: iso(row.archivedAt),
    lessons: row.lessons.map((lesson) => ({
      id: lesson.id,
      position: lesson.position,
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
      content: toLessonDocument(lesson.content),
      revision: lesson.revision,
      updatedAt: lesson.updatedAt.toISOString(),
      updatedBy: toUserSummary(lesson.updatedBy),
    })),
    resources: row.resources.map(toResource),
  };
}

export function toEvent(row: EventRow): ModuleEvent {
  return {
    id: row.id,
    versionId: row.versionId,
    version: row.version.version,
    action: row.action,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actor: toUserSummary(row.actor)!,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Élément d'activité ou d'historique des publications (événement + identité du module). */
export function toActivityItem(row: EventRow & { module: { number: number } }) {
  return {
    ...toEvent(row),
    moduleId: row.moduleId,
    code: formatModuleCode(row.module.number),
    title: row.version.title,
  };
}
