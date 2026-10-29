'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { RequirePermission } from '@/components/auth/require-permission';
import { EmptyState } from '@/components/empty-state';
import { AttemptTable } from '@/components/evaluations/attempt-table';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pendingReviewQueryOptions } from '@/lib/api/evaluations';

/**
 * Résultats corrigés soumis par les chefs (en ligne et papier), les plus anciens d'abord.
 * Distincte de la file des modules et de celle des questionnaires.
 */
export function ResultReviewQueue() {
  const user = useSessionUser();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...pendingReviewQueryOptions({ search: deferredSearch, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <RequirePermission user={user} permission="attempt.decide">
      <PageHeading
        title="Résultats à examiner"
        description="Accepter un résultat corrigé n’est pas valider officiellement un acquis ni changer l’étape d’un routier : ces décisions restent des actes distincts."
      />
      <div className="max-w-md space-y-1">
        <Label htmlFor="pending-search">Rechercher</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="pending-search"
            type="search"
            className="pl-9"
            placeholder="Code, nom, matricule, évaluation"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucun résultat en attente"
          description="Les copies corrigées et soumises par les chefs apparaîtront ici."
        />
      ) : (
        <>
          <AttemptTable
            items={data.items}
            caption="Résultats soumis"
            hrefFor={(item) => `/administration/evaluations-a-valider/${item.id}`}
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </RequirePermission>
  );
}
