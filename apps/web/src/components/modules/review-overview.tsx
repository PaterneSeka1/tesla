'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { submissionsQueryOptions } from '@/lib/api/modules';

/** Files de validation des modules (compteurs réels). La file des évaluations viendra en phase 4. */
export function ReviewOverview() {
  const submitted = useQuery(submissionsQueryOptions({ status: 'SOUMIS' }));
  const approved = useQuery(submissionsQueryOptions({ status: 'APPROUVE' }));
  const tiles = [
    { label: 'Modules à examiner', query: submitted },
    { label: 'Modules approuvés à publier', query: approved },
  ];
  return (
    <section aria-labelledby="review-overview" className="space-y-3">
      <h3 id="review-overview" className="text-lg font-semibold">
        Modules à approuver
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, query }) => (
          <Link
            key={label}
            href="/administration/modules-a-valider"
            className="rounded-lg border bg-card p-4 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            {query.isPending ? (
              <Skeleton className="mt-2 h-8 w-12" />
            ) : (
              <p className="mt-1 text-3xl font-semibold text-tesla-bordeaux">
                {query.isError ? '—' : query.data.items.length}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
