import { civilDateAt } from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';

// Règles de validité des mandats et délégations, évaluées à la lecture (aucune dépendance à une
// tâche planifiée). Dates civiles d'Abidjan ; bornes incluses (dernier jour exercé compris).

/** Date civile du jour, en `Date` UTC minuit (format des colonnes `@db.Date`). */
export function civilToday(now: Date = new Date()): Date {
  return new Date(`${civilDateAt(now)}T00:00:00Z`);
}

export function activeMandateWhere(date: Date): Prisma.LeadershipMandateWhereInput {
  return {
    startsOn: { lte: date },
    OR: [{ endedEarlyOn: { gte: date } }, { endedEarlyOn: null, endsOn: { gte: date } }],
  };
}

/**
 * Délégation active : non révoquée, dans sa période, délégant toujours plein en exercice et
 * délégataire toujours sous mandat (la délégation ne survit pas à la fin du mandat du délégataire).
 */
export function activeDelegationWhere(date: Date): Prisma.DelegationWhereInput {
  return {
    revokedAt: null,
    startsOn: { lte: date },
    endsOn: { gte: date },
    delegator: { mandates: { some: { function: 'PLEIN', ...activeMandateWhere(date) } } },
    delegate: { mandates: { some: activeMandateWhere(date) } },
  };
}
