'use client';

import {
  type ActivitySummary,
  DASHBOARD_TASK_LABELS,
  type DashboardTask,
  type DashboardTaskKind,
  type YearOverview,
} from '@tesla/shared';
import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FilePenLine,
  type LucideIcon,
  Medal,
  MessageSquareText,
  PartyPopper,
  PenLine,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatWaiting } from '@/lib/format';
import { cn } from '@/lib/utils';

// Blocs communs aux tableaux de bord du responsable et des chefs : ce qui attend une action,
// la prochaine activité et l'avancement de l'année. Les liens mènent aux écrans existants, qui
// portent l'action et vérifient les droits (l'API reste l'autorité).

const TASKS: Record<DashboardTaskKind, { icon: LucideIcon; href: (id: string) => string }> = {
  MODULE_A_APPROUVER: { icon: FileCheck2, href: (id) => `/administration/modules/${id}/revision` },
  QUESTIONNAIRE_A_APPROUVER: {
    icon: ClipboardCheck,
    href: (id) => `/administration/evaluations/${id}`,
  },
  RESULTAT_A_EXAMINER: {
    icon: ShieldCheck,
    href: (id) => `/administration/evaluations-a-valider/${id}`,
  },
  PROPOSITION_A_DECIDER: { icon: Medal, href: (id) => `/administration/validations/${id}` },
  COPIE_A_CORRIGER: { icon: PenLine, href: (code) => `/encadrement/corrections/${code}` },
  COPIE_PAPIER_A_CORRIGER: {
    icon: Printer,
    href: (code) => `/encadrement/evaluations/papier/${code}`,
  },
  MODULE_A_REPRENDRE: { icon: FilePenLine, href: (id) => `/encadrement/modules/${id}/modifier` },
  QUESTIONNAIRE_A_REPRENDRE: {
    icon: ClipboardCheck,
    href: (id) => `/encadrement/evaluations/${id}/modifier`,
  },
  COMPLEMENT_A_APPORTER: {
    icon: MessageSquareText,
    href: (id) => `/administration/validations/${id}`,
  },
  PRESENCES_A_RENSEIGNER: { icon: CalendarCheck, href: (id) => `/administration/activites/${id}` },
};

export function taskHref(task: Pick<DashboardTask, 'kind' | 'targetId'>): string {
  return TASKS[task.kind].href(encodeURIComponent(task.targetId));
}

/** Bandeau d'accueil : nombre d'éléments en attente et prochaine activité de la communauté. */
export function StaffHero({
  firstName,
  taskTotal,
  nextActivity,
}: {
  firstName: string;
  taskTotal: number;
  nextActivity: ActivitySummary | null;
}) {
  return (
    <div className="grid gap-4 rounded-xl bg-tesla-bordeaux p-5 text-white shadow-sm md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-2xl font-semibold">Bonjour {firstName}</p>
        <p className="mt-1 text-sm text-tesla-sable">
          {taskTotal === 0
            ? 'Rien ne vous attend pour le moment.'
            : taskTotal === 1
              ? 'Un élément attend votre action.'
              : `${taskTotal} éléments attendent votre action.`}
        </p>
      </div>
      {nextActivity ? (
        <Link
          href={`/administration/activites/${nextActivity.id}`}
          className="group rounded-lg bg-white/10 p-3 transition-all active:scale-[0.98] hover:bg-white/15 focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none md:min-w-64"
        >
          <span className="block text-xs text-tesla-or">Prochaine activité</span>
          <span className="block font-medium">{nextActivity.title}</span>
          <span className="flex items-center gap-1 text-sm text-tesla-sable">
            {formatDate(nextActivity.plannedOn)}
            {nextActivity.leaderLabel && ` · ${nextActivity.leaderLabel}`}
            <ChevronRight className="ml-auto size-4" aria-hidden />
          </span>
        </Link>
      ) : (
        <p className="text-sm text-tesla-sable">Aucune activité planifiée.</p>
      )}
    </div>
  );
}

export interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Raccourcis vers les gestes fréquents du rôle (écrans existants uniquement). */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <nav aria-label="Actions rapides" className="flex flex-wrap gap-2">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-xs transition-all active:scale-95 hover:border-tesla-or hover:text-tesla-rouge focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Icon className="size-4 text-tesla-rouge" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** File unique des éléments à traiter, du plus ancien au plus récent. */
export function TaskInbox({
  tasks,
  total,
  className,
}: {
  tasks: DashboardTask[];
  total: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          À faire maintenant
          <Badge variant={total > 0 ? 'accent' : 'outline'} className="tabular-nums">
            {total}
          </Badge>
        </CardTitle>
        {total > tasks.length && (
          <CardDescription>
            Les {tasks.length} plus anciens sur {total}.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Tout est à jour" />
        ) : (
          <ul className="-mx-3 divide-y">
            {tasks.map((task) => {
              const Icon = TASKS[task.kind].icon;
              return (
                <li key={`${task.kind}-${task.targetId}`}>
                  <Link
                    href={taskHref(task)}
                    className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 transition-transform hover:bg-muted active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="rounded-lg bg-tesla-sable/60 p-2 text-tesla-rouge">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">
                        {DASHBOARD_TASK_LABELS[task.kind]}
                      </span>
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      {task.detail && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {task.detail}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatWaiting(task.since)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Frise de l'année : chaque activité du programme est placée à sa date. Les points sont décoratifs ;
 * le résumé chiffré et le lien vers le programme portent l'information.
 */
export function YearTimeline({ year, className }: { year: YearOverview; className?: string }) {
  const { programme, milestones } = year;
  const dates = milestones.map((row) => toTime(row.plannedOn));
  const start = programme?.startsOn ? toTime(programme.startsOn) : Math.min(...dates);
  const end = programme?.endsOn ? toTime(programme.endsOn) : Math.max(...dates);
  const span = Math.max(DAY, end - start);
  const position = (time: number) => Math.min(100, Math.max(0, ((time - start) / span) * 100));
  const today = Date.parse(new Date().toISOString().slice(0, 10));

  const realised = milestones.filter((row) => row.status === 'REALISEE').length;
  const cancelled = milestones.filter((row) => row.status === 'ANNULEE').length;
  const expected = milestones.length - cancelled;
  const rate = expected > 0 ? Math.round((realised / expected) * 100) : null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">L’année en cours</CardTitle>
        <CardDescription>{programme?.title ?? 'Aucun programme annuel importé.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune activité au programme"
            description="Importez le programme annuel pour suivre l’année."
          />
        ) : (
          <>
            <div>
              <p className="text-3xl font-semibold tabular-nums text-tesla-bordeaux">
                {rate === null ? '—' : `${rate} %`}
              </p>
              <p className="text-sm text-muted-foreground">
                {realised} activité{realised > 1 ? 's' : ''} réalisée{realised > 1 ? 's' : ''} sur{' '}
                {expected} prévue{expected > 1 ? 's' : ''}
                {cancelled > 0 && ` · ${cancelled} annulée${cancelled > 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="relative h-8" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
              <span
                className="absolute top-1/2 left-0 h-1 origin-left -translate-y-1/2 animate-grow rounded-full bg-tesla-sable"
                style={{ width: `${position(today)}%` }}
              />
              {milestones.map((row) => (
                <span
                  key={row.id}
                  title={`${formatDate(row.plannedOn)} · ${row.title}`}
                  className={cn(
                    'absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                    row.status === 'REALISEE' && 'bg-tesla-rouge',
                    row.status === 'ANNULEE' && 'bg-muted-foreground/30',
                    (row.status === 'PLANIFIEE' || row.status === 'REPORTEE') &&
                      'border-2 border-tesla-or bg-card',
                  )}
                  style={{ left: `${position(toTime(row.plannedOn))}%` }}
                />
              ))}
              {today >= start && today <= end && (
                <span
                  className="absolute top-0 h-8 w-0.5 -translate-x-1/2 bg-tesla-bordeaux"
                  style={{ left: `${position(today)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatDate(new Date(start).toISOString())}</span>
              <span>{formatDate(new Date(end).toISOString())}</span>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-tesla-rouge" aria-hidden /> Réalisée
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border-2 border-tesla-or" aria-hidden /> À
                venir
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-0.5 bg-tesla-bordeaux" aria-hidden /> Aujourd’hui
              </li>
            </ul>
          </>
        )}
        <Link
          href="/administration/programme-annuel"
          className="inline-flex items-center gap-1 text-sm font-medium text-tesla-rouge underline-offset-4 hover:underline"
        >
          Programme annuel
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
