'use client';

import { useQuery } from '@tanstack/react-query';
import { NONE_FILTER } from '@tesla/shared';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { scoutsQueryOptions } from '@/lib/api/scouts';
import { teamsQueryOptions } from '@/lib/api/teams';

/** Indicateur chiffré réel (total renvoyé par l'API) menant à la liste correspondante. */
export function Tile({
  label,
  href,
  query,
}: {
  label: string;
  href: string;
  query: { data?: { total: number }; isPending: boolean; isError: boolean };
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-4 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      {query.isPending ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p className="mt-1 text-3xl font-semibold text-tesla-bordeaux">
          {query.isError ? '—' : query.data?.total}
        </p>
      )}
    </Link>
  );
}

/** Vue d'ensemble du suivi des routiers (responsable et chefs). */
export function FollowUpOverview() {
  const active = useQuery(scoutsQueryOptions({ status: 'active', pageSize: 1 }));
  const withoutTeam = useQuery(scoutsQueryOptions({ teamId: NONE_FILTER, pageSize: 1 }));
  const withoutAccount = useQuery(scoutsQueryOptions({ account: 'without', pageSize: 1 }));
  const teams = useQuery(teamsQueryOptions({ status: 'active', pageSize: 1 }));

  return (
    <section aria-labelledby="overview-title" className="space-y-3">
      <h3 id="overview-title" className="text-lg font-semibold">
        Suivi des routiers
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Routiers actifs" href="/administration/routiers" query={active} />
        <Tile
          label="Sans équipe"
          href={`/administration/routiers?teamId=${NONE_FILTER}`}
          query={withoutTeam}
        />
        <Tile
          label="Sans compte"
          href="/administration/routiers?account=without"
          query={withoutAccount}
        />
        <Tile label="Équipes actives" href="/administration/equipes" query={teams} />
      </div>
    </section>
  );
}
