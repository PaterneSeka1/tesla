'use client';

import { useQuery } from '@tanstack/react-query';
import { type ScoutPathway } from '@tesla/shared';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { myPathwayQueryOptions } from '@/lib/api/pathway';
import { CatchUpList } from './catch-up-list';
import { CatchUpLockNotice, PathwayModules } from './pathway-modules';
import { PathwaySummary } from './pathway-summary';
import { PathwayTimeline } from './pathway-timeline';

function NotLinked() {
  return (
    <p className="text-sm text-muted-foreground">
      Compte non rattaché à une fiche routier : demandez le rattachement au responsable.
    </p>
  );
}

/** Parcours personnel : âge, étape calculée, échéances, modules par catégorie. */
export function MyPathwayOverview() {
  const query = useQuery(myPathwayQueryOptions);
  if (query.isPending) return <TableSkeleton rows={2} />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotLinked />;
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  const open = query.data.catchUps.filter(
    (obligation) => obligation.decision === null && obligation.status !== 'PARCOURS_ANTERIEUR',
  ).length;
  const catchUpLink = open > 0 && (
    <Button asChild variant="outline" size="sm">
      <Link href="/mes-rattrapages">
        {open} module{open > 1 ? 's' : ''} à rattraper <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
  return (
    <section className="space-y-3" aria-labelledby="mon-parcours">
      <h2 id="mon-parcours" className="text-lg font-semibold">
        Mon parcours
      </h2>
      <PathwaySummary pathway={query.data} audience="routier" />
      <PathwayTimeline steps={query.data.timeline} />
      <ProgressFigures pathway={query.data} />
      <PathwayModules pathway={query.data} />
      {catchUpLink}
    </section>
  );
}

/**
 * Indicateurs distincts, jamais fusionnés (D181) : étapes reconnues (décision officielle), modules
 * de l'étape déclarés étudiés (progression numérique), rattrapages restants. Une étape reconnue ne
 * compte jamais comme cours terminé.
 */
function ProgressFigures({ pathway }: { pathway: ScoutPathway }) {
  const recognized = pathway.timeline.filter((step) => step.status === 'RECONNUE').length;
  const studied = pathway.stageModules.filter((module) => module.studied).length;
  const remaining = pathway.catchUps.filter(
    (obligation) => obligation.decision === null && obligation.status !== 'PARCOURS_ANTERIEUR',
  ).length;
  const figures = [
    { label: 'Étapes reconnues (parcours antérieur)', value: String(recognized) },
    {
      label: 'Modules de mon étape étudiés',
      value: `${studied} / ${pathway.stageModules.length}`,
    },
    { label: 'Modules à rattraper', value: String(remaining) },
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-3">
      {figures.map((figure) => (
        <div key={figure.label} className="rounded-lg border bg-card p-3">
          <dt className="text-sm text-muted-foreground">{figure.label}</dt>
          <dd className="text-lg font-semibold">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Page « Mes rattrapages ». */
export function MyCatchUps() {
  const query = useQuery(myPathwayQueryOptions);
  if (query.isPending) return <TableSkeleton />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotLinked />;
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  return (
    <div className="space-y-3">
      <CatchUpLockNotice pathway={query.data} />
      <CatchUpList
        obligations={query.data.catchUps}
        deadlineUndetermined={query.data.catchUpDeadlineUndetermined}
        audience="routier"
      />
    </div>
  );
}
