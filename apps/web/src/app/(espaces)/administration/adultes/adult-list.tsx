'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ScoutListQuery } from '@tesla/shared';
import { ChevronRight, Plus, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
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
import { scoutsQueryOptions } from '@/lib/api/scouts';
import { fullName } from '@/lib/format';
import { userCan } from '@/lib/navigation';

const PAGE_SIZE = 20;

type Status = NonNullable<ScoutListQuery['status']>;

/**
 * Apprenants adultes (D185) : ni équipe, ni étape, ni matricule. Ils lisent les cours et passent les
 * évaluations publiés ; leurs résultats se consultent sur leur fiche.
 */
export function AdultList() {
  const user = useSessionUser();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...scoutsQueryOptions({
      kind: 'ADULTE',
      search: deferredSearch,
      status,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });
  const filtered = deferredSearch !== '' || status !== 'active';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Adultes" />
        {userCan(user, 'scout.create') && (
          <Button asChild>
            <Link href="/administration/adultes/nouveau">
              <Plus aria-hidden />
              Nouvel adulte
            </Link>
          </Button>
        )}
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[2fr_1fr]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="adult-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="adult-search"
              type="search"
              className="pl-9"
              placeholder="Nom ou prénoms"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="adult-status">Statut</Label>
          <NativeSelect
            id="adult-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Status);
              setPage(1);
            }}
          >
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
            <option value="all">Tous</option>
          </NativeSelect>
        </div>
      </form>

      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aucun adulte"
          description={
            filtered
              ? 'Modifiez la recherche ou le statut.'
              : 'Un adulte inscrit peut suivre les cours et passer les évaluations publiés.'
          }
        />
      ) : (
        <>
          <ul
            className="divide-y rounded-lg border bg-card md:hidden"
            aria-label="Liste des adultes"
          >
            {data.items.map((adult) => (
              <li key={adult.id}>
                <Link
                  href={`/administration/adultes/${adult.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block font-medium wrap-break-word text-tesla-rouge">
                      {fullName(adult)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {adult.hasAccount ? 'Avec compte' : 'Sans compte'}
                      {!adult.isActive && <Badge variant="outline">Désactivé</Badge>}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <TableCaption>Liste des adultes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Adulte</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((adult) => (
                  <TableRow key={adult.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/administration/adultes/${adult.id}`}
                        className="text-tesla-rouge underline-offset-4 hover:underline"
                      >
                        {fullName(adult)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {adult.hasAccount ? (
                        <Badge variant="secondary">Avec compte</Badge>
                      ) : (
                        <Badge variant="outline">Sans compte</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {adult.isActive ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="outline">Désactivé</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
