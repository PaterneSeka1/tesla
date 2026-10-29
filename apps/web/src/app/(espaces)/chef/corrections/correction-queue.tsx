'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ATTEMPT_STATUS_LABELS,
  type CorrectionListQuery,
  EVALUATION_MODE_LABELS,
  EVALUATION_MODES,
  type EvaluationMode,
} from '@tesla/shared';
import { PenLine, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { AttemptTable } from '@/components/evaluations/attempt-table';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { correctionsQueryOptions } from '@/lib/api/evaluations';

const PAGE_SIZE = 20;
type StatusFilter = NonNullable<CorrectionListQuery['status']>;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'A_CORRIGER', label: 'À corriger' },
  { value: 'SOUMISE', label: 'Soumises au responsable' },
  { value: 'PREPAREE', label: 'Feuilles préparées' },
  { value: 'EN_COURS', label: 'En cours (en ligne)' },
  { value: 'VALIDEE', label: ATTEMPT_STATUS_LABELS.VALIDEE },
  { value: 'open', label: 'Toutes les tentatives ouvertes' },
  { value: 'all', label: 'Toutes' },
];

/** File de correction des chefs : copies en ligne remises et copies papier, recherche par code ou nom. */
export function CorrectionQueue() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('A_CORRIGER');
  const [mode, setMode] = useState<EvaluationMode | ''>('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...correctionsQueryOptions({
      search: deferredSearch,
      status,
      ...(mode && { mode }),
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeading
        title="Corrections"
        description="Copies à corriger : les questions à choix sont corrigées automatiquement, les réponses rédigées par un chef. Une note n’est jamais une validation officielle."
      />
      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_14rem_10rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="correction-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="correction-search"
              type="search"
              className="pl-9"
              placeholder="Code NT-…, nom, matricule, titre"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="correction-status">État</Label>
          <NativeSelect
            id="correction-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="correction-mode">Mode</Label>
          <NativeSelect
            id="correction-mode"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as EvaluationMode | '');
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {EVALUATION_MODES.map((value) => (
              <option key={value} value={value}>
                {EVALUATION_MODE_LABELS[value]}
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
          icon={PenLine}
          title="Aucune copie"
          description="Aucune tentative ne correspond à ces critères."
        />
      ) : (
        <>
          <AttemptTable
            items={data.items}
            caption="Copies"
            hrefFor={(item) =>
              item.mode === 'PAPIER'
                ? `/chef/evaluations/papier/${item.code}`
                : `/chef/corrections/${item.code}`
            }
          />
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
