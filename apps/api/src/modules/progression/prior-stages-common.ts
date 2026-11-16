import { UnprocessableEntityException } from '@nestjs/common';
import { type PriorStageInput, priorStageIssue, type PriorStageRecognition } from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { type Prisma } from '../../generated/prisma/client.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';
import { computedStageOf, type StageContext } from './computed-stage.js';

// Parcours antérieur reconnu (D181) : présentation et écriture partagées par l'inscription
// (`ScoutProfilesService.create`) et la fiche (`PriorStagesService`). Sans dépendance d'injection
// (évite un import circulaire avec `PathwayService`).

export const priorStageInclude = {
  stage: true,
  recordedBy: userSummarySelect,
  revokedBy: userSummarySelect,
} as const satisfies Prisma.PriorStageRecognitionInclude;

export type RecognitionRow = Prisma.PriorStageRecognitionGetPayload<{
  include: typeof priorStageInclude;
}>;

const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

/** `withNote` : l'observation et l'auteur sont réservés à l'encadrement. */
export function toPriorStage(row: RecognitionRow, withNote: boolean): PriorStageRecognition {
  return {
    id: row.id,
    stage: toStageSummary(row.stage)!,
    completedOn: row.completedOn ? toIsoDate(row.completedOn) : null,
    note: withNote ? row.note : null,
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: withNote ? toUserSummary(row.recordedBy) : null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedBy: withNote && row.revokedBy ? toUserSummary(row.revokedBy) : null,
    revokeReason: withNote ? row.revokeReason : null,
  };
}

type Writer = Prisma.TransactionClient;

/**
 * Enregistre des reconnaissances dans la transaction de l'appelant (inscription ou fiche) : le
 * profil doit être verrouillé (`FOR UPDATE`) ou créé dans la même transaction, et l'habilitation du
 * plein revérifiée (`assertCanAtWrite`). L'étape de référence est l'étape **normale selon l'âge**
 * (les rattrapages en découlent), jamais une exception de secours.
 */
export async function recordPriorStages(
  tx: Writer,
  actor: Actor,
  profile: { id: string; birthDate: Date | null; membershipStatus: 'ACTIF' | 'SORTI' },
  requested: readonly PriorStageInput[],
  context: StageContext,
): Promise<RecognitionRow[]> {
  if (requested.length === 0) return [];
  const active = await tx.priorStageRecognition.findMany({
    where: { scoutProfileId: profile.id, revokedAt: null },
    select: { stageId: true },
  });
  const issue = priorStageIssue({
    requested,
    stages: context.stages,
    currentStage: computedStageOf(profile, context).computedStage,
    alreadyRecognized: new Set(active.map((row) => row.stageId)),
    birthDate: profile.birthDate && toIsoDate(profile.birthDate),
    today: context.today,
  });
  if (issue) throw new UnprocessableEntityException(issue);
  const rows: RecognitionRow[] = [];
  for (const item of requested) {
    const row = await tx.priorStageRecognition.create({
      data: {
        scoutProfileId: profile.id,
        stageId: item.stageId,
        completedOn: item.completedOn ? toDate(item.completedOn) : null,
        note: item.note || null,
        recordedById: actor.userId,
      },
      include: priorStageInclude,
    });
    // Journal sans l'observation (conservée dans la reconnaissance elle-même).
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'priorStage.recognized',
        entityType: 'PriorStageRecognition',
        entityId: row.id,
        metadata: {
          scoutProfileId: profile.id,
          stage: row.stage.code,
          completedOn: item.completedOn ?? null,
        },
      },
    });
    rows.push(row);
  }
  return rows;
}
