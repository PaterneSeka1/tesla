import { type ActivityStatus } from '@tesla/shared';

// Calcul du calendrier mensuel et de la synthèse du programme : dates calendaires AAAA-MM-JJ en UTC
// (aucun décalage de fuseau, Abidjan = UTC+0), semaines du lundi au dimanche.

/** Jour d'une grille mensuelle ; `inMonth` faux pour les jours des mois voisins. */
export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
}

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

/** Mois (AAAA-MM) décalé de `delta` mois. */
export function addMonths(month: string, delta: number): string {
  const date = toDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return toIso(date).slice(0, 7);
}

/** Semaines complètes (lundi → dimanche) couvrant le mois. */
export function monthGrid(month: string): CalendarDay[][] {
  const first = toDate(`${month}-01`);
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarDay[] = [];
    for (let index = 0; index < 7; index += 1) {
      const date = toIso(cursor);
      week.push({ date, day: cursor.getUTCDate(), inMonth: date.startsWith(month) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (toIso(cursor).startsWith(month));
  return weeks;
}

/** Mois de `from` à `to` inclus (AAAA-MM). */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export interface ProgrammeSession {
  plannedOn: string;
  status: ActivityStatus;
}

export interface ProgrammeOverview {
  /** Séances planifiées ou reportées à venir (aujourd'hui compris). */
  upcoming: number;
  realised: number;
  /** Séances encore « planifiées » dont la date est passée : statut à mettre à jour. */
  overdue: number;
  postponed: number;
  cancelled: number;
  /** Mois de la période du programme sans aucune séance prévue. */
  monthsWithoutSession: string[];
}

/** Synthèse factuelle du programme : aucune séance n'est déduite ni générée. */
export function programmeOverview(
  sessions: readonly ProgrammeSession[],
  today: string,
  period?: { startsOn: string | null; endsOn: string | null },
): ProgrammeOverview {
  const count = (test: (session: ProgrammeSession) => boolean) => sessions.filter(test).length;
  const scheduled = new Set(
    sessions.filter((s) => s.status !== 'ANNULEE').map((s) => s.plannedOn.slice(0, 7)),
  );
  const months =
    period?.startsOn && period.endsOn ? monthsBetween(period.startsOn, period.endsOn) : [];
  return {
    upcoming: count(
      (s) => (s.status === 'PLANIFIEE' || s.status === 'REPORTEE') && s.plannedOn >= today,
    ),
    realised: count((s) => s.status === 'REALISEE'),
    overdue: count((s) => s.status === 'PLANIFIEE' && s.plannedOn < today),
    postponed: count((s) => s.status === 'REPORTEE'),
    cancelled: count((s) => s.status === 'ANNULEE'),
    monthsWithoutSession: months.filter((month) => !scheduled.has(month)),
  };
}
