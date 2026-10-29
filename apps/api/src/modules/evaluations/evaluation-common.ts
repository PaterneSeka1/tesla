import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  type EditorQuestion,
  type EvaluationEvent,
  type EvaluationVersionAction,
  type EvaluationVersionDetail,
  type EvaluationVersionStatus,
  type EvaluationVersionSummary,
  formatEvaluationCode,
  formatModuleCode,
  type EvaluationModuleRef,
  roundPoints,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { can } from '../../common/permissions.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../scouts/presenters.js';

export type EvaluationAccess = 'AUTEUR' | 'REDACTEUR_DU_MODULE' | 'RESPONSABLE';

// ─── Erreurs métier ────────────────────────────────────────────────────────

export function evaluationNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'EVALUATION_NOT_FOUND',
    message: 'Évaluation introuvable.',
  });
}

export function evaluationVersionNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'EVALUATION_VERSION_NOT_FOUND',
    message: 'Version introuvable pour cette évaluation.',
  });
}

export function questionNotFound(): NotFoundException {
  return new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Question introuvable.' });
}

export function editConflict(): ConflictException {
  return new ConflictException({
    code: 'EDIT_CONFLICT',
    message:
      'Ce contenu a été modifié par une autre personne entre-temps. Rechargez-le avant d’enregistrer.',
  });
}

export function evaluationNotEditable(status: EvaluationVersionStatus): ConflictException {
  const message =
    status === 'A_CORRIGER'
      ? 'Des corrections ont été demandées : reprenez la rédaction pour modifier cette version.'
      : 'Cette version n’est plus modifiable : seule une version à l’état brouillon peut être modifiée.';
  return new ConflictException({ code: 'VERSION_NOT_EDITABLE', message });
}

export function invalidEvaluationTransition(status: EvaluationVersionStatus): ConflictException {
  return new ConflictException({
    code: 'INVALID_TRANSITION',
    message: `Action impossible : la version est à l’état « ${status} ».`,
  });
}

// ─── Accès éditorial ───────────────────────────────────────────────────────

/** Évaluations rédigeables par l'acteur : les siennes et celles des modules qu'il rédige (toutes pour le responsable). */
export function editableEvaluationsWhere(actor: Actor): Prisma.EvaluationWhereInput {
  if (can(actor, 'evaluation.writeAny')) return {};
  return {
    OR: [
      { createdById: actor.userId },
      { module: { createdById: actor.userId } },
      { module: { collaborators: { some: { userId: actor.userId, removedAt: null } } } },
    ],
  };
}

/** Relation de l'acteur avec l'évaluation ; 404 sans accès (l'existence d'un brouillon n'est pas révélée). */
export async function resolveEvaluationAccess(
  client: Prisma.TransactionClient,
  actor: Actor,
  evaluationId: string,
): Promise<EvaluationAccess> {
  const evaluation = await client.evaluation.findUnique({
    where: { id: evaluationId },
    select: {
      createdById: true,
      module: {
        select: {
          createdById: true,
          collaborators: { where: { userId: actor.userId, removedAt: null }, select: { id: true } },
        },
      },
    },
  });
  if (!evaluation) throw evaluationNotFound();
  if (can(actor, 'evaluation.writeAny')) return 'RESPONSABLE';
  if (evaluation.createdById === actor.userId) return 'AUTEUR';
  if (
    evaluation.module &&
    (evaluation.module.createdById === actor.userId || evaluation.module.collaborators.length > 0)
  ) {
    return 'REDACTEUR_DU_MODULE';
  }
  throw evaluationNotFound();
}

/** Verrouille la version (sérialise éditions et transitions) et vérifie son appartenance à l'évaluation. */
export async function lockEvaluationVersion(
  tx: Prisma.TransactionClient,
  evaluationId: string,
  versionId: string,
): Promise<{ status: EvaluationVersionStatus; revision: number; version: number }> {
  const rows = await tx.$queryRaw<
    { evaluation_id: string; status: EvaluationVersionStatus; revision: number; version: number }[]
  >`SELECT evaluation_id, status, revision, version FROM evaluation_versions
    WHERE id = ${versionId}::uuid FOR UPDATE`;
  const row = rows[0];
  if (!row || row.evaluation_id !== evaluationId) throw evaluationVersionNotFound();
  return { status: row.status, revision: row.revision, version: row.version };
}

/** Historique en ajout seul (+ journal d'audit pour les décisions du responsable). */
export async function recordEvaluationEvent(
  tx: Prisma.TransactionClient,
  actor: Actor,
  event: {
    evaluationId: string;
    versionId: string;
    action: EvaluationVersionAction;
    fromStatus: EvaluationVersionStatus | null;
    toStatus: EvaluationVersionStatus;
    comment?: string | null;
    audit?: string;
  },
): Promise<void> {
  await tx.evaluationVersionEvent.create({
    data: {
      evaluationId: event.evaluationId,
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
        entityType: 'EvaluationVersion',
        entityId: event.versionId,
        metadata: {
          evaluationId: event.evaluationId,
          from: event.fromStatus,
          to: event.toStatus,
          ...(event.comment && { comment: event.comment }),
        },
      },
    });
  }
}

// ─── Présentation ──────────────────────────────────────────────────────────

const iso = (date: Date | null) => date?.toISOString() ?? null;

export const toNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value);

export const versionSummaryInclude = {
  questionItems: { select: { points: true } },
} as const satisfies Prisma.EvaluationVersionInclude;

export const questionInclude = {
  options: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.EvaluationQuestionInclude;

export const versionDetailInclude = {
  basedOn: { select: { version: true } },
  moduleVersion: { select: { version: true } },
  createdBy: userSummarySelect,
  updatedBy: userSummarySelect,
  submittedBy: userSummarySelect,
  approvedBy: userSummarySelect,
  publishedBy: userSummarySelect,
  questionItems: { orderBy: { position: 'asc' }, include: questionInclude },
} as const satisfies Prisma.EvaluationVersionInclude;

export const moduleRefInclude = {
  publishedVersion: { select: { title: true } },
  versions: { orderBy: { version: 'desc' }, take: 1, select: { title: true } },
} as const satisfies Prisma.PedagogicalModuleInclude;

export const evaluationEventInclude = {
  actor: userSummarySelect,
  version: { select: { version: true } },
} as const satisfies Prisma.EvaluationVersionEventInclude;

type SummaryRow = Prisma.EvaluationVersionGetPayload<{ include: typeof versionSummaryInclude }>;
type DetailRow = Prisma.EvaluationVersionGetPayload<{ include: typeof versionDetailInclude }>;
type QuestionRow = Prisma.EvaluationQuestionGetPayload<{ include: typeof questionInclude }>;
type ModuleRow = Prisma.PedagogicalModuleGetPayload<{ include: typeof moduleRefInclude }>;
type EventRow = Prisma.EvaluationVersionEventGetPayload<{ include: typeof evaluationEventInclude }>;

export { formatEvaluationCode };

function sumPoints(items: readonly { points: Prisma.Decimal }[]): number {
  return roundPoints(items.reduce((total, item) => total + Number(item.points), 0));
}

export function toEvaluationVersionSummary(row: SummaryRow | DetailRow): EvaluationVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    questionCount: row.questionItems.length,
    totalPoints: sumPoints(row.questionItems),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: iso(row.submittedAt),
    publishedAt: iso(row.publishedAt),
  };
}

export function toEditorQuestion(row: QuestionRow): EditorQuestion {
  return {
    id: row.id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    points: Number(row.points),
    scoringPolicy: row.scoringPolicy,
    guidance: row.guidance,
    expectedAnswer: row.expectedAnswer,
    revision: row.revision,
    options: row.options.map((option) => ({
      id: option.id,
      position: option.position,
      label: option.label,
      isCorrect: option.isCorrect,
    })),
  };
}

export function toEvaluationVersionDetail(row: DetailRow): EvaluationVersionDetail {
  return {
    ...toEvaluationVersionSummary(row),
    instructions: row.instructions,
    durationMinutes: row.durationMinutes,
    maxAttempts: row.maxAttempts,
    revision: row.revision,
    basedOnVersion: row.basedOn?.version ?? null,
    moduleVersion: row.moduleVersion?.version ?? null,
    createdBy: toUserSummary(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedBy: toUserSummary(row.updatedBy),
    submittedBy: toUserSummary(row.submittedBy),
    submissionNote: row.submissionNote,
    approvedAt: iso(row.approvedAt),
    approvedBy: toUserSummary(row.approvedBy),
    publishedBy: toUserSummary(row.publishedBy),
    archivedAt: iso(row.archivedAt),
    questions: row.questionItems.map(toEditorQuestion),
  };
}

export function toModuleRef(row: ModuleRow | null): EvaluationModuleRef | null {
  if (!row) return null;
  return {
    id: row.id,
    code: formatModuleCode(row.number),
    slug: row.slug,
    title: row.publishedVersion?.title ?? row.versions[0]?.title ?? row.slug,
    published: row.publishedVersionId !== null,
  };
}

export function toEvaluationEvent(row: EventRow): EvaluationEvent {
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
