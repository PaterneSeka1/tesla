'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { myPathwayQueryOptions } from '@/lib/api/pathway';
import { CatchUpList } from './catch-up-list';
import { PathwaySummary } from './pathway-summary';

function NotLinked() {
  return (
    <p className="text-sm text-muted-foreground">
      Votre compte n’est pas encore rattaché à une fiche routier : demandez le rattachement au
      responsable.
    </p>
  );
}

/** Parcours personnel : âge, étape théorique, étape officielle, échéances (tableau de bord, progression). */
export function MyPathwayOverview() {
  const query = useQuery(myPathwayQueryOptions);
  if (query.isPending) return <TableSkeleton rows={2} />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotLinked />;
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  const open = query.data.catchUps.filter((obligation) => obligation.decision === null).length;
  return (
    <section className="space-y-3" aria-labelledby="mon-parcours">
      <h2 id="mon-parcours" className="text-lg font-semibold">
        Mon parcours
      </h2>
      <PathwaySummary pathway={query.data} audience="routier" />
      {open > 0 && (
        <Button asChild variant="outline" size="sm">
          <Link href="/mes-rattrapages">
            {open} module{open > 1 ? 's' : ''} à rattraper <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
    </section>
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
    <CatchUpList
      obligations={query.data.catchUps}
      deadlineUndetermined={query.data.catchUpDeadlineUndetermined}
      audience="routier"
    />
  );
}
