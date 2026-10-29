import { NotFoundException } from '@nestjs/common';
import { type ActivitySummary, type AttendanceCounts } from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';
import { type PrismaService } from '../../prisma/prisma.service.js';
import { toIsoDate } from '../scouts/presenters.js';

export function activityNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ACTIVITY_NOT_FOUND', message: 'Activité introuvable.' });
}

export const activitySummaryInclude = {
  categories: { include: { category: true }, orderBy: { category: { position: 'asc' } } },
} as const satisfies Prisma.ActivityInclude;

type SummaryRow = Prisma.ActivityGetPayload<{ include: typeof activitySummaryInclude }>;

const EMPTY_COUNTS: AttendanceCounts = { present: 0, absent: 0, excused: 0 };

export function toActivitySummary(row: SummaryRow, counts?: AttendanceCounts): ActivitySummary {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    origin: row.origin,
    status: row.status,
    plannedOn: toIsoDate(row.plannedOn),
    heldOn: row.heldOn ? toIsoDate(row.heldOn) : null,
    leaderLabel: row.leaderLabel,
    categories: row.categories.map(({ category }) => ({ id: category.id, label: category.label })),
    attendance: counts ?? EMPTY_COUNTS,
  };
}

/** Décompte des présences par activité (une requête groupée). */
export async function attendanceCounts(
  prisma: PrismaService | Prisma.TransactionClient,
  activityIds: string[],
): Promise<Map<string, AttendanceCounts>> {
  const map = new Map<string, AttendanceCounts>();
  if (activityIds.length === 0) return map;
  const groups = await prisma.activityAttendance.groupBy({
    by: ['activityId', 'status'],
    where: { activityId: { in: activityIds } },
    _count: { _all: true },
  });
  for (const group of groups) {
    const counts = map.get(group.activityId) ?? { ...EMPTY_COUNTS };
    const key =
      group.status === 'PRESENT' ? 'present' : group.status === 'ABSENT' ? 'absent' : 'excused';
    counts[key] = group._count._all;
    map.set(group.activityId, counts);
  }
  return map;
}

/**
 * Activités dont les présences restent à saisir : réalisées, ou planifiées/reportées dont la date
 * prévue est passée, sans aucune présence enregistrée.
 */
export function attendanceMissingWhere(today: Date): Prisma.ActivityWhereInput {
  return {
    attendances: { none: {} },
    OR: [
      { status: 'REALISEE' },
      { status: { in: ['PLANIFIEE', 'REPORTEE'] }, plannedOn: { lte: today } },
    ],
  };
}

/** Saisie des présences possible : activité réalisée, ou prévue à une date passée (pas annulée). */
export function isAttendanceEditable(
  activity: { status: string; plannedOn: Date },
  today: Date,
): boolean {
  if (activity.status === 'REALISEE') return true;
  if (activity.status === 'ANNULEE') return false;
  return activity.plannedOn.getTime() <= today.getTime();
}

/** Date du jour à minuit UTC (dates calendaires `@db.Date`). */
export function startOfTodayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}
