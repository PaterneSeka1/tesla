'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { EligibilityBadge } from '@/components/evaluations/eligibility-badge';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { availableEvaluationsQueryOptions } from '@/lib/api/evaluations';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { formatDuration } from '@/lib/format';

const PAGE_SIZE = 12;

/** Évaluations publiées avec l'éligibilité du routier connecté (calculée par le serveur). */
export function AvailableEvaluations() {
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const stages = useQuery(stagesQueryOptions);
  const { data, error, isPending, refetch } = useQuery({
    ...availableEvaluationsQueryOptions({
      search: deferredSearch,
      ...(stageId && { stageId }),
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeading
        title="Évaluations"
        description="Les évaluations complètent les modules et les activités : elles s’ouvrent selon votre étape ou sur décision du responsable."
      />
      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_14rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="available-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="available-search"
              type="search"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="available-stage">Étape</Label>
          <NativeSelect
            id="available-stage"
            value={stageId}
            onChange={(event) => {
              setStageId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucune évaluation"
          description="Aucune évaluation publiée ne correspond à ces critères."
        />
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/evaluations/${item.id}`}
                  className="block h-full space-y-2 rounded-lg border bg-card p-4 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-tesla-bordeaux">{item.title}</h3>
                    {item.eligibility && <EligibilityBadge eligibility={item.eligibility} />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.stage.name} · {item.questionCount} question
                    {item.questionCount > 1 ? 's' : ''}
                    {item.durationMinutes && ` · ${formatDuration(item.durationMinutes)}`}
                  </p>
                  {item.module && <p className="text-sm">Module : {item.module.title}</p>}
                  {item.eligibility?.openAttempt?.status === 'EN_COURS' && (
                    <p className="text-sm font-medium text-tesla-rouge">
                      Tentative en cours à reprendre
                    </p>
                  )}
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
      )}
    </>
  );
}
