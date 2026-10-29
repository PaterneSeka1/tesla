'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type EditorModuleListQuery,
  MODULE_VERSION_STATUS_LABELS,
  MODULE_VERSION_STATUSES,
} from '@tesla/shared';
import { FilePenLine, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
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
import { editorModulesQueryOptions } from '@/lib/api/modules';
import { formatDateTime, fullName } from '@/lib/format';
import { ModuleStatusBadge } from './module-status-badge';

const PAGE_SIZE = 20;
type StatusFilter = NonNullable<EditorModuleListQuery['status']>;

const ACCESS_LABELS = {
  AUTEUR: 'Auteur',
  COLLABORATEUR: 'Collaborateur',
  RESPONSABLE: '—',
} as const;

/**
 * Modules accessibles : ceux dont le chef est auteur ou collaborateur, tous pour le responsable.
 * `review` : liens vers la page de révision (responsable) en plus de l'édition.
 */
export function EditorModuleList({ review = false }: { review?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...editorModulesQueryOptions({ search: deferredSearch, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading
          title={review ? 'Tous les modules' : 'Mes modules'}
          description={
            review
              ? 'Ensemble des modules de la communauté, publiés ou en cours de rédaction.'
              : 'Modules dont vous êtes l’auteur ou sur lesquels vous êtes invité à collaborer.'
          }
        />
        <Button asChild>
          <Link href="/chef/modules/nouveau">
            <Plus aria-hidden />
            Nouveau module
          </Link>
        </Button>
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_14rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="module-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="module-search"
              type="search"
              className="pl-9"
              placeholder="Titre du module"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="module-status">État</Label>
          <NativeSelect
            id="module-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Tous</option>
            <option value="working">En cours (brouillon → approuvé)</option>
            <option value="published">En ligne</option>
            {MODULE_VERSION_STATUSES.map((value) => (
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
          icon={FilePenLine}
          title="Aucun module"
          description={
            deferredSearch || status !== 'all'
              ? 'Aucun module ne correspond à ces critères.'
              : 'Créez un premier module : il restera un brouillon jusqu’à sa soumission et son approbation.'
          }
        />
      ) : (
        <>
          <Table>
            <TableCaption>Liste des modules</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Version de travail</TableHead>
                <TableHead className="hidden md:table-cell">En ligne</TableHead>
                <TableHead className="hidden lg:table-cell">{review ? 'Auteur' : 'Rôle'}</TableHead>
                <TableHead className="hidden sm:table-cell">Dernière activité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((module) => {
                const shown = module.working ?? module.latest;
                const href =
                  review && module.working && ['SOUMIS', 'APPROUVE'].includes(module.working.status)
                    ? `/administration/modules/${module.id}/revision`
                    : `/chef/modules/${module.id}/modifier`;
                return (
                  <TableRow key={module.id}>
                    <TableCell>
                      <Link
                        href={href}
                        className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                      >
                        {shown.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{module.code}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <ModuleStatusBadge status={shown.status} />
                        <span className="text-xs text-muted-foreground">v{shown.version}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {module.published ? `Version ${module.published.version}` : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {review ? fullName(module.createdBy) : ACCESS_LABELS[module.access]}
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
