'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MODULE_VERSION_ACTION_LABELS } from '@tesla/shared';
import { History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { ResponsableOnly } from '@/components/auth/responsable-only';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { publicationHistoryQueryOptions } from '@/lib/api/modules';
import { formatDateTime, fullName } from '@/lib/format';

export function PublicationHistory() {
  const user = useSessionUser();
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery({
    ...publicationHistoryQueryOptions(page),
    placeholderData: keepPreviousData,
  });

  return (
    <ResponsableOnly role={user.role}>
      <PageHeading
        title="Historique des publications"
        description="Décisions du responsable : approbations, corrections, refus, publications et archivages."
      />
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aucune décision"
          description="Aucune décision n’a encore été prise."
        />
      ) : (
        <>
          <Table>
            <TableCaption>
              Décisions de publication, de la plus récente à la plus ancienne
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Décision</TableHead>
                <TableHead className="hidden md:table-cell">Motif</TableHead>
                <TableHead className="hidden sm:table-cell">Par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/administration/modules/${item.moduleId}/revision`}
                      className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.code} · version {item.version}
                    </p>
                  </TableCell>
                  <TableCell>{MODULE_VERSION_ACTION_LABELS[item.action]}</TableCell>
                  <TableCell className="hidden max-w-xs text-muted-foreground md:table-cell">
                    {item.comment ?? '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{fullName(item.actor)}</TableCell>
                </TableRow>
              ))}
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
    </ResponsableOnly>
  );
}
