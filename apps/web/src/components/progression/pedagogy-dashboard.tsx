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
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CloudDownload,
  FileCheck2,
  FilePenLine,
  HeartHandshake,
  type LucideIcon,
  Medal,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Trophy,
  Users,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { QueryError } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  chefDashboardQueryOptions,
  myDashboardQueryOptions,
  responsableDashboardQueryOptions,
} from '@/lib/api/dashboards';
import { formatDate, formatScore, fullName } from '@/lib/format';
import { listDownloads } from '@/lib/offline/downloads';
import { ownerId } from '@/lib/offline/vault';

// Tous les indicateurs proviennent de l'API (docs/FEATURES/DASHBOARDS.md) : aucune valeur
// d'exemple, aucun classement entre routiers.

function Kpi({
  label,
  value,
  href,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  href: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="rounded-lg bg-tesla-sable/60 p-2 text-tesla-rouge">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block text-2xl font-semibold tabular-nums text-tesla-bordeaux">
          {value}
        </span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </Link>
  );
}

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
        className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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
        <EmptyState
          icon={CalendarDays}
          title="Aucune activité planifiée"
          description="Les activités à venir apparaîtront ici."
        />
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
    <Panel
      title="Accompagnement"
      description="Faits à examiner par l’encadrement ; aucune sanction ni décision automatique."
    >
      {items.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="Aucun signal enregistré"
          description="Les routiers à accompagner apparaîtront ici."
        />
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

function Distributions({ statistics }: { statistics: Statistics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Routiers actifs par équipe">
        <Distribution
          rows={statistics.byTeam.map((row) => ({
            label: row.team?.name ?? 'Sans équipe',
            value: row.active,
          }))}
        />
      </Panel>
      <Panel title="Routiers actifs par étape">
        <Distribution
          rows={statistics.byStage.map((row) => ({
            label: row.stage?.name ?? 'Étape non renseignée',
            value: row.active,
          }))}
        />
      </Panel>
    </div>
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

export function ResponsablePedagogyDashboard() {
  const query = useQuery(responsableDashboardQueryOptions);
  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const { statistics, contentQueue, pedagogyQueue } = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Routiers actifs"
          value={statistics.scouts.active}
          hint={`${statistics.scouts.withoutAccount} sans compte · ${statistics.scouts.withoutTeam} sans équipe`}
          href="/administration/routiers"
          icon={Users}
        />
        <Kpi
          label="Compétences validées"
          value={statistics.competencies.acquired}
          hint={`${statistics.competencies.activeInReferential} au référentiel`}
          href="/administration/validations"
          icon={Medal}
        />
        <Kpi
          label="Modules étudiés"
          value={statistics.moduleStudies}
          hint="Études enregistrées"
          href="/administration/statistiques"
          icon={BookOpen}
        />
        <Kpi
          label="Taux de présence"
          value={formatRate(statistics.attendance.rate)}
          hint={`${statistics.activities.realised} activités réalisées`}
          href="/administration/presences"
          icon={CalendarCheck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Validation des contenus"
          description="Modules et questionnaires soumis par les chefs."
        >
          <ul className="-mx-3">
            <ActionRow
              label="Modules à approuver"
              count={contentQueue.modulesToApprove}
              href="/administration/modules-a-valider"
              icon={FileCheck2}
            />
            <ActionRow
              label="Questionnaires à approuver"
              count={contentQueue.evaluationsToApprove}
              href="/administration/evaluations"
              icon={ClipboardCheck}
            />
          </ul>
        </Panel>
        <Panel
          title="Décisions sur les routiers"
          description="Résultats, acquis et présences : décisions humaines uniquement."
        >
          <ul className="-mx-3">
            <ActionRow
              label="Résultats à examiner"
              count={pedagogyQueue.resultsToReview}
              href="/administration/evaluations-a-valider"
              icon={ShieldCheck}
            />
            <ActionRow
              label="Propositions de compétences"
              count={pedagogyQueue.proposalsPending}
              href="/administration/validations"
              icon={Medal}
            />
            <ActionRow
              label="Compléments demandés"
              count={pedagogyQueue.complementRequested}
              href="/administration/validations"
              icon={MessageSquareText}
            />
            <ActionRow
              label="Copies en cours de correction"
              count={pedagogyQueue.correctionsInProgress}
              href="/chef/corrections"
              icon={PenLine}
            />
            <ActionRow
              label="Activités sans présences renseignées"
              count={statistics.activities.attendanceMissing}
              href="/administration/presences"
              icon={CalendarCheck}
            />
          </ul>
        </Panel>
      </div>

      <Distributions statistics={statistics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Upcoming items={query.data.upcomingActivities} />
        <FollowUp items={query.data.followUp} />
      </div>
    </div>
  );
}

export function ChefPedagogyDashboard() {
  const query = useQuery(chefDashboardQueryOptions);
  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Routiers suivis"
          value={d.activeScouts}
          href="/administration/routiers"
          icon={Users}
        />
        <Kpi
          label="Modules en préparation"
          value={d.modulesInProgress}
          href="/chef/modules"
          icon={FilePenLine}
        />
        <Kpi
          label="Copies à corriger"
          value={d.correctionsToDo}
          href="/chef/corrections"
          icon={PenLine}
        />
        <Kpi
          label="Présences à renseigner"
          value={d.attendanceToRecord.length}
          href="/administration/presences"
          icon={CalendarCheck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Mes propositions de validation"
          description="La décision officielle appartient au responsable pédagogique."
        >
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
            <p className="text-sm text-muted-foreground">Aucune décision récente.</p>
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
            <EmptyState
              icon={MessageSquareText}
              title="Aucune observation"
              description="Vos observations d’accompagnement apparaîtront ici."
            />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Upcoming items={d.upcomingActivities} />
        <FollowUp items={d.followUp} />
      </div>
    </div>
  );
}

/**
 * Modules téléchargés sur cet appareil. Le coffre chiffré n'est lisible qu'une fois déverrouillé :
 * sinon, seul un lien vers l'écran hors ligne est proposé (aucune lecture sans la phrase locale).
 */
function OfflineSummary() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!ownerId()) return;
    let cancelled = false;
    listDownloads()
      .then((downloads) => !cancelled && setCount(downloads.length))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Kpi
      label="Modules hors ligne"
      value={count ?? '—'}
      hint={count === null ? 'Coffre local verrouillé' : 'Sur cet appareil'}
      href="/hors-ligne"
      icon={CloudDownload}
    />
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
        description="Votre compte n’est pas encore rattaché à un profil routier. Contactez le responsable pédagogique."
      />
    );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-tesla-bordeaux p-5 text-white shadow-sm">
        <p className="text-xs tracking-wider text-tesla-or uppercase">Étape actuelle</p>
        <p className="mt-1 text-2xl font-semibold">{d.stage?.name ?? 'Étape non renseignée'}</p>
        <p className="mt-1 text-sm text-tesla-sable">
          {d.stageSince ? `Depuis le ${formatDate(d.stageSince)}` : 'Date non renseignée'} ·{' '}
          {d.team?.name ?? 'Sans équipe'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Modules étudiés" value={d.studiedModules} href="/progression" icon={BookOpen} />
        <Kpi
          label="Compétences validées"
          value={d.acquiredCompetencies.length}
          hint="Validations officielles"
          href="/mes-competences"
          icon={Medal}
        />
        <Kpi
          label="Résultats communiqués"
          value={d.recentResults.length}
          hint="Récents"
          href="/mes-resultats"
          icon={Trophy}
        />
        <OfflineSummary />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Modules recommandés"
          description="Modules publiés de votre étape, pas encore étudiés."
        >
          {d.recommendedModules.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Aucune recommandation"
              description="La bibliothèque reste ouverte à tous les modules publiés."
            />
          ) : (
            <ul className="-mx-3">
              {d.recommendedModules.map((module) => (
                <li key={module.id}>
                  <Link
                    href={`/modules/${module.slug}`}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Badge variant="secondary">{module.code}</Badge>
                    <span className="flex-1 text-sm">{module.title}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Résultats récents" description="Un résultat ne valide jamais une étape.">
          {d.recentResults.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Aucun résultat communiqué"
              description="Vos résultats examinés par le responsable apparaîtront ici."
            />
          ) : (
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
          )}
        </Panel>
      </div>

      <Upcoming items={d.upcomingActivities} />
    </div>
  );
}
