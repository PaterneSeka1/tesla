'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  EVALUATION_VERSION_STATUSES,
  type EditorEvaluationListQuery,
  MODULE_VERSION_STATUS_LABELS,
} from '@tesla/shared';
import { ClipboardList, Plus, Printer, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { editorEvaluationsQueryOptions } from '@/lib/api/evaluations';
import { formatDateTime, formatPoints, fullName } from '@/lib/format';

const PAGE_SIZE = 20;
type StatusFilter = NonNullable<EditorEvaluationListQuery['status']>;

/**
 * Questionnaires accessibles : ceux du chef (ou des modules qu'il rédige), tous pour le responsable.
 * `review` : liens vers la page d'examen (responsable) pour les versions soumises ou approuvées.
 */
export function EvaluationList({ review = false }: { review?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...editorEvaluationsQueryOptions({ search: deferredSearch, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading
          title={review ? 'Toutes les évaluations' : 'Évaluations'}
          description={
            review
              ? 'Questionnaires de la communauté, publiés ou en cours de rédaction.'
              : 'Questionnaires que vous rédigez. Un questionnaire n’est passé par les routiers qu’après approbation et publication par le responsable.'
          }
        />
        <div className="flex flex-wrap gap-2">
          {!review && (
            <Button asChild variant="outline">
              <Link href="/chef/evaluations/papier">
                <Printer aria-hidden />
                Évaluation papier
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/chef/evaluations/nouvelle">
              <Plus aria-hidden />
              Nouveau questionnaire
            </Link>
          </Button>
        </div>
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_14rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="evaluation-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="evaluation-search"
              type="search"
              className="pl-9"
              placeholder="Titre du questionnaire"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="evaluation-status">État</Label>
          <NativeSelect
            id="evaluation-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Tous</option>
            <option value="working">En cours (brouillon → approuvé)</option>
            <option value="published">Publiés</option>
            {EVALUATION_VERSION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {MODULE_VERSION_STATUS_LABELS[value]}
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
          icon={ClipboardList}
          title="Aucun questionnaire"
          description={
            deferredSearch || status !== 'all'
              ? 'Aucun questionnaire ne correspond à ces critères.'
              : 'Créez un premier questionnaire : il restera un brouillon jusqu’à sa soumission.'
          }
        />
      ) : (
        <>
          <Table>
            <TableCaption>Liste des questionnaires</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Questionnaire</TableHead>
                <TableHead>Version de travail</TableHead>
                <TableHead className="hidden md:table-cell">Publiée</TableHead>
                <TableHead className="hidden lg:table-cell">Étape</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {review ? 'Auteur' : 'Tentatives'}
                </TableHead>
                <TableHead className="hidden sm:table-cell">Dernière activité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const shown = item.working ?? item.latest;
                const href =
                  review && item.working && ['SOUMIS', 'APPROUVE'].includes(item.working.status)
                    ? `/administration/evaluations/${item.id}`
                    : `/chef/evaluations/${item.id}/modifier`;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={href}
                        className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                      >
                        {shown.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.code} · {shown.questionCount} question
                        {shown.questionCount > 1 ? 's' : ''} · {formatPoints(shown.totalPoints)}
                        {item.module && ` · ${item.module.code}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <ModuleStatusBadge status={shown.status} />
                        <span className="text-xs text-muted-foreground">v{shown.version}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.published ? `Version ${item.published.version}` : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{item.stage.name}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {review
                        ? item.createdBy
                          ? fullName(item.createdBy)
                          : '—'
                        : item.attemptCount}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDateTime(shown.updatedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
