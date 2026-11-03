'use client';

import { ACTIVITY_STATUS_LABELS, type ActivityStatus, type ActivitySummary } from '@tesla/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ActivityStatusBadge } from '@/components/progression/status-badges';
import { Button } from '@/components/ui/button';
import { monthGrid } from '@/lib/calendar';
import { formatDate, formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

// Calendrier mensuel des séances réelles (aucune séance générée). Tablette et ordinateur : titres
// cliquables dans la grille ; mobile : pastilles dans la grille et liste du mois en dessous.

const WEEKDAYS = [
  ['L', 'lundi'],
  ['M', 'mardi'],
  ['M', 'mercredi'],
  ['J', 'jeudi'],
  ['V', 'vendredi'],
  ['S', 'samedi'],
  ['D', 'dimanche'],
] as const;

/** Repère visuel du statut (toujours doublé du libellé ou du badge). */
export const STATUS_MARK: Record<ActivityStatus, string> = {
  PLANIFIEE: 'border-l-tesla-rouge bg-tesla-sable/50 text-tesla-bordeaux',
  REALISEE: 'border-l-emerald-700 bg-emerald-50 text-emerald-900',
  REPORTEE: 'border-l-tesla-or bg-amber-50 text-amber-900',
  ANNULEE: 'border-l-muted-foreground bg-muted text-muted-foreground line-through',
};

const STATUS_DOT: Record<ActivityStatus, string> = {
  PLANIFIEE: 'bg-tesla-rouge',
  REALISEE: 'bg-emerald-700',
  REPORTEE: 'bg-tesla-or',
  ANNULEE: 'bg-muted-foreground',
};

/** Date affichée d'une séance : date effective si réalisée, sinon date prévue. */
export const sessionDate = (activity: Pick<ActivitySummary, 'heldOn' | 'plannedOn'>) =>
  activity.heldOn ?? activity.plannedOn;

export function ProgrammeCalendar({
  activities,
  month,
  today,
  onMonthChange,
}: {
  activities: readonly ActivitySummary[];
  /** Mois affiché (AAAA-MM). */
  month: string;
  today: string;
  onMonthChange: (delta: number | 'today') => void;
}) {
  const byDate = new Map<string, ActivitySummary[]>();
  for (const activity of activities) {
    const date = sessionDate(activity);
    byDate.set(date, [...(byDate.get(date) ?? []), activity]);
  }
  const ofMonth = activities
    .filter((activity) => sessionDate(activity).startsWith(month))
    .sort((a, b) => sessionDate(a).localeCompare(sessionDate(b)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Mois précédent"
          onClick={() => onMonthChange(-1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <h3
          className="min-w-0 flex-1 text-center text-base font-semibold capitalize sm:flex-none sm:text-left"
          aria-live="polite"
        >
          {formatMonth(month, 'long')}
        </h3>
        <Button
          variant="outline"
          size="icon"
          aria-label="Mois suivant"
          onClick={() => onMonthChange(1)}
        >
          <ChevronRight aria-hidden />
        </Button>
        {!today.startsWith(month) && (
          <Button variant="ghost" size="sm" onClick={() => onMonthChange('today')}>
            Aujourd’hui
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/60 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map(([short, long]) => (
            <abbr key={long} title={long} className="py-2 no-underline">
              {short}
            </abbr>
          ))}
        </div>
        {monthGrid(month).map((week) => (
          <div key={week[0]!.date} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day) => {
              const sessions = day.inMonth ? (byDate.get(day.date) ?? []) : [];
              return (
                <div
                  key={day.date}
                  className={cn(
                    'min-h-14 border-r p-1 last:border-r-0 sm:min-h-24 sm:p-1.5',
                    !day.inMonth && 'bg-muted/30',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      !day.inMonth && 'text-muted-foreground/60',
                      day.date === today && 'bg-tesla-bordeaux font-semibold text-white',
                    )}
                  >
                    {day.day}
                  </span>
                  {sessions.length > 0 && (
                    <>
                      {/* Mobile : pastilles seules, la liste du mois porte les liens. */}
                      <span className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                        {sessions.map((session) => (
                          <span
                            key={session.id}
                            className={cn('size-2 rounded-full', STATUS_DOT[session.status])}
                          />
                        ))}
                      </span>
                      <ul className="mt-1 hidden space-y-1 sm:block">
                        {sessions.slice(0, 3).map((session) => (
                          <li key={session.id}>
                            <Link
                              href={`/administration/activites/${session.id}`}
                              title={`${session.title} · ${ACTIVITY_STATUS_LABELS[session.status]}`}
                              className={cn(
                                'block truncate rounded border-l-2 px-1.5 py-0.5 text-xs font-medium hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                                STATUS_MARK[session.status],
                              )}
                            >
                              {session.title}
                              <span className="sr-only">
                                {' '}
                                · {ACTIVITY_STATUS_LABELS[session.status]}
                              </span>
                            </Link>
                          </li>
                        ))}
                        {sessions.length > 3 && (
                          <li className="px-1.5 text-xs text-muted-foreground">
                            +{sessions.length - 3}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        {(Object.keys(STATUS_DOT) as ActivityStatus[]).map((status) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />
            {ACTIVITY_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>

      <div className="sm:hidden">
        {ofMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune séance ce mois-ci.</p>
        ) : (
          <SessionList sessions={ofMonth} />
        )}
      </div>
    </div>
  );
}

/** Liste de séances (date, titre, thème, statut), chacune menant à sa fiche. */
export function SessionList({ sessions }: { sessions: readonly ActivitySummary[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/administration/activites/${session.id}`}
            className="flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="hidden w-36 shrink-0 text-sm text-muted-foreground tabular-nums sm:block">
              {formatDate(sessionDate(session))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground tabular-nums sm:hidden">
                {formatDate(sessionDate(session))}
              </span>
              <span
                className={cn(
                  'block truncate font-medium',
                  session.status === 'ANNULEE' && 'line-through',
                )}
              >
                {session.title}
              </span>
              {(session.theme || session.categories.length > 0) && (
                <span className="block truncate text-xs text-muted-foreground">
                  {[session.theme, ...session.categories.map((c) => c.label)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </span>
            <ActivityStatusBadge status={session.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
