'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ProposalListQuery } from '@tesla/shared';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { ProposalStatusBadge } from '@/components/progression/status-badges';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { proposalsQueryOptions } from '@/lib/api/progression';
import { formatDate, fullName } from '@/lib/format';

/** Liste chronologique de propositions (aucun classement des routiers). */
export function ProposalList({
  query,
  emptyTitle,
  emptyDescription,
}: {
  query: Omit<ProposalListQuery, 'page'>;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery({
    ...proposalsQueryOptions({ ...query, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <TableSkeleton rows={3} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (data.items.length === 0) {
    return <EmptyState icon={BadgeCheck} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <>
      <ul className="space-y-2">
        {data.items.map((proposal) => (
          <li key={proposal.id}>
            <Link
              href={`/administration/validations/${proposal.id}`}
              className="block space-y-1 rounded-lg border bg-card p-4 text-sm transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">
                  {fullName(proposal.scout)} · {proposal.competency.code} {proposal.competency.name}
                </p>
                <ProposalStatusBadge status={proposal.status} />
              </div>
              <p className="text-muted-foreground">
                {proposal.scout.team?.name ?? 'Sans équipe'} ·{' '}
                {proposal.scout.stage?.name ?? 'Étape non renseignée'} · {proposal.evidences.length}{' '}
                élément(s) justificatif(s) · proposée par {fullName(proposal.proposedBy)} le{' '}
                {formatDate(proposal.createdAt)}
              </p>
              {proposal.decisionComment && <p>Réponse : « {proposal.decisionComment} »</p>}
            </Link>
          </li>
        ))}
      </ul>
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        onPageChange={setPage}
      />
    </>
  );
}
