'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type TeamListQuery } from '@tesla/shared';
import { Plus, Search, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import { teamsQueryOptions } from '@/lib/api/teams';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 20;

export function TeamList() {
  const user = useSessionUser();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<NonNullable<TeamListQuery['status']>>('active');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const { data, error, isPending, refetch } = useQuery({
    ...teamsQueryOptions({ search: deferredSearch, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Équipes" />
        {userCan(user, 'team.manage') && (
          <Button asChild>
            <Link href="/administration/equipes/nouvelle">
              <Plus aria-hidden />
              Nouvelle équipe
            </Link>
          </Button>
        )}
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="team-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="team-search"
              type="search"
              className="pl-9"
              placeholder="Nom ou description"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="team-status">Statut</Label>
          <NativeSelect
            id="team-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="active">Actives</option>
            <option value="archived">Archivées</option>
            <option value="all">Toutes</option>
          </NativeSelect>
        </div>
      </form>

      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Aucune équipe"
          description={
            deferredSearch || status !== 'active'
              ? 'Modifiez la recherche ou les filtres.'
              : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableCaption>Liste des équipes</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Membres</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Créée le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/administration/equipes/${team.id}`}
                      className="text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {team.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                    {team.description ?? '—'}
                  </TableCell>
                  <TableCell>{team.memberCount}</TableCell>
                  <TableCell>
                    {team.archivedAt ? (
                      <Badge variant="outline">Archivée</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatDate(team.createdAt)}
                  </TableCell>
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
    </>
  );
}
