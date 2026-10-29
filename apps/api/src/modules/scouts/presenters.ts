import { type StageSummary, type Team as TeamResponse, type UserSummary } from '@tesla/shared';
import { type ProgressionStage, type Team, type User } from '../../generated/prisma/client.js';

/** Date calendaire (`@db.Date`) au format AAAA-MM-JJ. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toStageSummary(stage: ProgressionStage | null): StageSummary | null {
  return stage && { id: stage.id, code: stage.code, name: stage.name, position: stage.position };
}

export function toUserSummary(
  user: Pick<User, 'id' | 'firstName' | 'lastName'> | null,
): UserSummary | null {
  return user && { id: user.id, firstName: user.firstName, lastName: user.lastName };
}

export function toTeamResponse(team: Team, memberCount: number): TeamResponse {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    archivedAt: team.archivedAt?.toISOString() ?? null,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    memberCount,
  };
}

/** Sélection Prisma minimale d'un auteur (jamais l'e-mail ni le hash). */
export const userSummarySelect = { select: { id: true, firstName: true, lastName: true } } as const;
