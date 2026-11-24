'use client';

import { useQuery } from '@tanstack/react-query';
import { type EarnedBadge } from '@tesla/shared';
import { ArrowRight, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { journalQueryOptions } from '@/lib/api/practice';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BadgeMedal } from './badge-medal';

/**
 * Carnet d'aventure (D196) : la progression ludique, distincte du parcours officiel (étape,
 * résultats et acquis restent dans leurs pages). Le détail d'un badge s'affiche quand on le choisit.
 */
export function Journal() {
  const { data, error, isPending, refetch } = useQuery(journalQueryOptions);
  const [selected, setSelected] = useState<EarnedBadge | null>(null);
  if (isPending) return <TableSkeleton rows={4} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  const earned = data.badges.filter((badge) => badge.earnedAt).length;

  return (
    <>
      <PageHeading title="Carnet" />
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold text-tesla-bordeaux tabular-nums">
          {data.xp} <span className="text-base font-medium text-muted-foreground">XP</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {data.lessonsRead} halte{data.lessonsRead > 1 ? 's' : ''} lue
          {data.lessonsRead > 1 ? 's' : ''} · {data.activitiesMastered} activité
          {data.activitiesMastered > 1 ? 's' : ''} réussie{data.activitiesMastered > 1 ? 's' : ''}
        </p>
      </div>

      {data.dueReviews.length > 0 && (
        <Link
          href="/defis/revisions"
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-transform active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Repeat className="size-5 text-tesla-rouge" aria-hidden />
          <span className="flex-1 font-medium">
            {data.dueReviews.length === 1
              ? '1 notion à revoir'
              : `${data.dueReviews.length} notions à revoir`}
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Badges · {earned} sur {data.badges.length}
        </h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {data.badges.map((badge) => (
            <li key={badge.key}>
              <button
                type="button"
                onClick={() => setSelected(selected?.key === badge.key ? null : badge)}
                aria-expanded={selected?.key === badge.key}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-[background-color,transform] duration-150 outline-none hover:bg-muted active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected?.key === badge.key && 'bg-muted',
                )}
              >
                <BadgeMedal badgeKey={badge.key} earned={!!badge.earnedAt} />
                <span
                  className={cn(
                    'text-xs leading-tight',
                    !badge.earnedAt && 'text-muted-foreground',
                  )}
                >
                  {badge.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div
            role="status"
            className="animate-enter rounded-xl bg-tesla-sable/40 px-4 py-3 text-sm"
          >
            <p className="font-semibold">{selected.title}</p>
            <p>{selected.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.earnedAt
                ? `Obtenu le ${formatDate(selected.earnedAt)}`
                : 'Pas encore obtenu'}
            </p>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        XP et badges récompensent la découverte et l’entraînement ; ils ne changent ni l’étape, ni
        les résultats, ni les acquis.
      </p>
    </>
  );
}
