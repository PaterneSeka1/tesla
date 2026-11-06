'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type ActivitySummary,
  FOLLOW_UP_REASON_LABELS,
  type FollowUpItem,
  type Statistics,
} from '@tesla/shared';
import {
  BookOpen,
  BookOpenText,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FilePenLine,
  HeartHandshake,
  type LucideIcon,
  Medal,
  MessageSquareText,
  PenLine,
  Printer,
  ShieldCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { EmptyState } from '@/components/empty-state';
import { lastReading, type LastReading } from '@/components/offline/use-offline-images';
import { MyPathwayOverview } from '@/components/pathway/my-pathway';
import { QueryError } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/stat-card';
import {
  chefDashboardQueryOptions,
  myDashboardQueryOptions,
  responsableDashboardQueryOptions,
} from '@/lib/api/dashboards';
import { formatDate, formatScore, fullName } from '@/lib/format';
import {
  type QuickAction,
  QuickActions,
  StaffHero,
  TaskInbox,
  YearTimeline,
} from './staff-overview';

// Tous les indicateurs proviennent de l'API (docs/FEATURES/DASHBOARDS.md) : aucune valeur
// d'exemple, aucun classement entre routiers.

/** Ligne d'une file d'actions : mise en avant seulement lorsqu'il reste quelque chose à faire. */
function ActionRow({
  label,
  count,
  href,
  icon: Icon,
}: {
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 transition-transform hover:bg-muted active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-sm">{label}</span>
        <Badge variant={count > 0 ? 'accent' : 'outline'} className="tabular-nums">
          {count}
        </Badge>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

interface QueueRow {
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
}

/** Files non vides seulement ; rien n'est affiché lorsque tout est traité (« À faire » le dit). */
function QueuePanel({ title, rows }: { title: string; rows: QueueRow[] }) {
  const pending = rows.filter((row) => row.count > 0);
  if (pending.length === 0) return null;
  return (
    <Panel title={title}>
      <ul className="-mx-3">
        {pending.map((row) => (
          <ActionRow key={row.label} {...row} />
        ))}
      </ul>
    </Panel>
  );
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Upcoming({ items }: { items: ActivitySummary[] }) {
  return (
    <Panel title="Prochaines activités">
      {items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucune activité planifiée" />
      ) : (
        <ol className="space-y-3 border-l-2 border-tesla-sable pl-4">
          {items.map((activity) => (
            <li key={activity.id} className="relative">
              <span
                className="absolute top-1.5 left-[-1.4rem] size-2.5 rounded-full bg-tesla-or"
                aria-hidden
              />
              <p className="text-xs font-medium text-muted-foreground">
                {formatDate(activity.plannedOn)}
              </p>
              <p className="text-sm font-medium">{activity.title}</p>
              {activity.theme && <p className="text-xs text-muted-foreground">{activity.theme}</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function FollowUp({ items }: { items: FollowUpItem[] }) {
  return (
    <Panel title="Accompagnement">
      {items.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="Aucun signal enregistré" />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.scout.id} className="py-2">
              <Link
                className="text-sm font-medium text-tesla-rouge underline-offset-4 hover:underline"
                href={`/administration/routiers/${item.scout.id}`}
              >
                {fullName(item.scout)}
              </Link>
              <p className="text-xs text-muted-foreground">
                {item.reasons.map((reason) => FOLLOW_UP_REASON_LABELS[reason]).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Répartition en barres horizontales (valeurs affichées en clair, lisibles sans la barre). */
function Distribution({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3"
        >
          <span className="truncate text-sm">{row.label}</span>
          <span className="h-2 rounded-full bg-muted" aria-hidden>
            <span
              className="block h-2 rounded-full bg-tesla-rouge"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right text-sm font-medium tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Répartition par équipe (la répartition par étape figure dans « Parcours de la communauté »). */
function TeamDistribution({ statistics }: { statistics: Statistics }) {
  return (
    <Panel title="Routiers actifs par équipe">
      <Distribution
        rows={statistics.byTeam.map((row) => ({
          label: row.team?.name ?? 'Sans équipe',
          value: row.active,
        }))}
      />
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

const formatRate = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)} %`);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

const RESPONSABLE_ACTIONS: readonly QuickAction[] = [
  { href: '/administration/routiers/nouveau', label: 'Nouveau routier', icon: UserPlus },
  { href: '/administration/activites', label: 'Activités', icon: CalendarDays },
  { href: '/administration/presences', label: 'Présences', icon: CalendarCheck },
  { href: '/encadrement/evaluations/papier', label: 'Copie papier', icon: Printer },
];

const CHEF_ACTIONS: readonly QuickAction[] = [
  { href: '/administration/routiers', label: 'Noter une observation', icon: MessageSquareText },
  { href: '/administration/validations/nouvelle', label: 'Proposer une compétence', icon: Medal },
  { href: '/encadrement/evaluations/papier', label: 'Copie papier', icon: Printer },
  { href: '/encadrement/modules/nouveau', label: 'Nouveau module', icon: FilePenLine },
];

export function ResponsablePedagogyDashboard() {
  const user = useSessionUser();
  const query = useQuery(responsableDashboardQueryOptions);
  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const { statistics, contentQueue, pedagogyQueue, tasks, taskTotal, year } = query.data;

  return (
    <div className="stagger space-y-6">
      <StaffHero
        firstName={user.firstName}
        taskTotal={taskTotal}
        nextActivity={year.nextActivity}
      />
      <QuickActions actions={RESPONSABLE_ACTIONS} />

      <div className="grid gap-4 lg:grid-cols-3">
        <TaskInbox tasks={tasks} total={taskTotal} className="lg:col-span-2" />
        <YearTimeline year={year} className={taskTotal === 0 ? 'lg:col-span-3' : undefined} />
      </div>

      <FollowUp items={query.data.followUp} />

      <SectionTitle>En chiffres</SectionTitle>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Routiers actifs"
          value={statistics.scouts.active}
          hint={`${statistics.scouts.withoutAccount} sans compte · ${statistics.scouts.withoutTeam} sans équipe`}
          href="/administration/routiers"
          icon={Users}
        />
        <StatCard
          label="Compétences validées"
          value={statistics.competencies.acquired}
          hint={`${statistics.competencies.activeInReferential} au référentiel`}
          href="/administration/validations"
          icon={Medal}
        />
        <StatCard
          label="Modules étudiés"
          value={statistics.moduleStudies}
          href="/administration/statistiques"
          icon={BookOpen}
        />
        <StatCard
          label="Taux de présence"
          value={formatRate(statistics.attendance.rate)}
          hint={`${statistics.activities.realised} activités réalisées`}
          href="/administration/presences"
          icon={CalendarCheck}
        />
      </div>

      <QueuePanel
        title="Files d’attente"
        rows={[
          {
            label: 'Modules à approuver',
            count: contentQueue.modulesToApprove,
            href: '/administration/modules-a-valider',
            icon: FileCheck2,
          },
          {
            label: 'Questionnaires à approuver',
            count: contentQueue.evaluationsToApprove,
            href: '/administration/evaluations',
            icon: ClipboardCheck,
          },
          {
            label: 'Résultats à examiner',
            count: pedagogyQueue.resultsToReview,
            href: '/administration/evaluations-a-valider',
            icon: ShieldCheck,
          },
          {
            label: 'Propositions de compétences',
            count: pedagogyQueue.proposalsPending,
            href: '/administration/validations',
            icon: Medal,
          },
          {
            label: 'Compléments demandés',
            count: pedagogyQueue.complementRequested,
            href: '/administration/validations',
            icon: MessageSquareText,
          },
          {
            label: 'Copies en cours de correction',
            count: pedagogyQueue.correctionsInProgress,
            href: '/encadrement/corrections',
            icon: PenLine,
          },
          {
            label: 'Activités sans présences renseignées',
            count: statistics.activities.attendanceMissing,
            href: '/administration/presences',
            icon: CalendarCheck,
          },
        ]}
      />

      <TeamDistribution statistics={statistics} />
    </div>
  );
}

export function ChefPedagogyDashboard() {
  const user = useSessionUser();
  const query = useQuery(chefDashboardQueryOptions);
  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;

  return (
    <div className="stagger space-y-6">
      <StaffHero
        firstName={user.firstName}
        taskTotal={d.taskTotal}
        nextActivity={d.year.nextActivity}
      />
      <QuickActions actions={CHEF_ACTIONS} />

      <div className="grid gap-4 lg:grid-cols-3">
        <TaskInbox tasks={d.tasks} total={d.taskTotal} className="lg:col-span-2" />
        <YearTimeline year={d.year} className={d.taskTotal === 0 ? 'lg:col-span-3' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Mes propositions">
          <ul className="-mx-3">
            <ActionRow
              label="En attente de décision"
              count={d.myProposals.pending}
              href="/administration/validations"
              icon={Medal}
            />
            <ActionRow
              label="Compléments demandés"
              count={d.myProposals.complementRequested}
              href="/administration/validations"
              icon={MessageSquareText}
            />
          </ul>
          <h3 className="mt-4 mb-2 text-sm font-medium">Décisions récentes</h3>
          {d.myProposals.recentlyDecided.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune.</p>
          ) : (
            <ul className="divide-y">
              {d.myProposals.recentlyDecided.map((proposal) => (
                <li key={proposal.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    className="min-w-0 truncate text-sm text-tesla-rouge underline-offset-4 hover:underline"
                    href={`/administration/validations/${proposal.id}`}
                  >
                    {proposal.competency.name} · {fullName(proposal.scout)}
                  </Link>
                  <Badge variant={proposal.status === 'APPROUVEE' ? 'success' : 'outline'}>
                    {proposal.status === 'APPROUVEE' ? 'Approuvée' : 'Refusée'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Mes observations récentes">
          {d.recentObservations.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="Aucune observation" />
          ) : (
            <ul className="divide-y">
              {d.recentObservations.map((observation) => (
                <li key={observation.id} className="py-2">
                  <p className="text-sm">
                    <Link
                      className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                      href={`/administration/routiers/${observation.scout.id}`}
                    >
                      {fullName(observation.scout)}
                    </Link>{' '}
                    <span className="text-xs text-muted-foreground">
                      · {formatDate(observation.observedOn)}
                    </span>
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {observation.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <FollowUp items={d.followUp} />

      <SectionTitle>En chiffres</SectionTitle>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Routiers suivis"
          value={d.activeScouts}
          href="/administration/routiers"
          icon={Users}
        />
        <StatCard
          label="Modules en préparation"
          value={d.modulesInProgress}
          href="/encadrement/modules"
          icon={FilePenLine}
        />
        <StatCard
          label="Copies à corriger"
          value={d.correctionsToDo}
          href="/encadrement/corrections"
          icon={PenLine}
        />
        <StatCard
          label="Présences à renseigner"
          value={d.attendanceToRecord.length}
          href="/administration/presences"
          icon={CalendarCheck}
        />
      </div>
    </div>
  );
}

/** Dernière leçon ouverte sur cet appareil (coffre local) : rien n'est affiché s'il n'y en a pas. */
function ResumeReading() {
  const [last, setLast] = useState<LastReading | null>(null);
  useEffect(() => {
    let cancelled = false;
    void lastReading().then((value) => !cancelled && setLast(value));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!last) return null;
  return (
    <Link
      href={`/modules/${last.slug}/lecons/${last.lessonId}`}
      className="flex min-h-14 items-center gap-3 rounded-xl border bg-card p-4 transition-transform hover:bg-muted active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BookOpenText className="size-6 shrink-0 text-tesla-rouge" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Reprendre la lecture</span>
        <span className="block truncate font-medium">{last.moduleTitle}</span>
        <span className="block truncate text-sm text-muted-foreground">{last.lessonTitle}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function RoutierPedagogyDashboard() {
  const query = useQuery(myDashboardQueryOptions);
  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  if (!d.linked)
    return (
      <EmptyState
        icon={UserX}
        title="Compte non rattaché"
        description="Demandez le rattachement au responsable."
      />
    );

  return (
    <div className="stagger space-y-6">
      <div className="rounded-xl bg-tesla-bordeaux p-5 text-white shadow-sm">
        <p className="text-xs tracking-wider text-tesla-or uppercase">Étape actuelle</p>
        <p className="mt-1 text-2xl font-semibold">{d.stage?.name ?? 'Non déterminée'}</p>
        <p className="mt-1 text-sm text-tesla-sable">
          {[d.stageSince && `Depuis le ${formatDate(d.stageSince)}`, d.team?.name ?? 'Sans équipe']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <ResumeReading />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Modules étudiés"
          value={d.studiedModules}
          href="/progression"
          icon={BookOpen}
        />
        <StatCard
          label="Compétences validées"
          value={d.acquiredCompetencies.length}
          href="/mes-competences"
          icon={Medal}
        />
      </div>

      <MyPathwayOverview compact />

      <div className="grid gap-4 empty:hidden lg:grid-cols-2">
        {d.recommendedModules.length > 0 && (
          <Panel title="À étudier">
            <ul className="-mx-3">
              {d.recommendedModules.map((module) => (
                <li key={module.id}>
                  <Link
                    href={`/modules/${module.slug}`}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 transition-transform hover:bg-muted active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Badge variant="secondary">{module.code}</Badge>
                    <span className="flex-1 text-sm">{module.title}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {d.recentResults.length > 0 && (
          <Panel title="Résultats récents">
            <ul className="divide-y">
              {d.recentResults.map((result) => (
                <li key={result.code} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm">{result.evaluationTitle}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatScore(result.score, result.maxScore)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {d.upcomingActivities.length > 0 && <Upcoming items={d.upcomingActivities} />}
    </div>
  );
}
