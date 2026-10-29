'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  evaluationSubmissionsQueryOptions,
  pendingReviewQueryOptions,
} from '@/lib/api/evaluations';
import { submissionsQueryOptions } from '@/lib/api/modules';

/** Files distinctes du responsable (compteurs réels) : modules, questionnaires, résultats. */
export function ReviewOverview() {
  const submitted = useQuery(submissionsQueryOptions({ status: 'SOUMIS' }));
  const approved = useQuery(submissionsQueryOptions({ status: 'APPROUVE' }));
  const questionnaires = useQuery(evaluationSubmissionsQueryOptions({ status: 'SOUMIS' }));
  const results = useQuery(pendingReviewQueryOptions({ pageSize: 1 }));
  const tiles = [
    {
      label: 'Modules à examiner',
      query: submitted,
      href: '/administration/modules-a-valider',
      count: submitted.data?.items.length,
    },
    {
      label: 'Modules approuvés à publier',
      query: approved,
      href: '/administration/modules-a-valider',
      count: approved.data?.items.length,
    },
    {
      label: 'Questionnaires à examiner',
      query: questionnaires,
      href: '/administration/evaluations',
      count: questionnaires.data?.items.length,
    },
    {
      label: 'Résultats à examiner',
      query: results,
      href: '/administration/evaluations-a-valider',
      count: results.data?.total,
    },
  ];
  return (
    <section aria-labelledby="review-overview" className="space-y-3">
      <h3 id="review-overview" className="text-lg font-semibold">
        À traiter
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, query, href, count }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border bg-card p-4 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            {query.isPending ? (
              <Skeleton className="mt-2 h-8 w-12" />
            ) : (
              <p className="mt-1 text-3xl font-semibold text-tesla-bordeaux">
                {query.isError ? '—' : count}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
