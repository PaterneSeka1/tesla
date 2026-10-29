'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { NONE_FILTER, type ScoutListQuery } from '@tesla/shared';
import { Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { scoutsQueryOptions, stagesQueryOptions } from '@/lib/api/scouts';
import { activeTeamsQueryOptions } from '@/lib/api/teams';
import { fullName } from '@/lib/format';

const PAGE_SIZE = 20;

type Filters = Required<Pick<ScoutListQuery, 'status' | 'account'>> & {
  teamId: string;
  stageId: string;
};

const STATUS_VALUES = ['active', 'inactive', 'all'] as const;
const ACCOUNT_VALUES = ['with', 'without', 'all'] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function ScoutList() {
  const user = useSessionUser();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [filters, setFilters] = useState<Filters>({
    teamId: params.get('teamId') ?? '',
    stageId: params.get('stageId') ?? '',
    status: pick(params.get('status'), STATUS_VALUES, 'active'),
    account: pick(params.get('account'), ACCOUNT_VALUES, 'all'),
  });
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const teams = useQuery(activeTeamsQueryOptions);
  const stages = useQuery(stagesQueryOptions);
  const { data, error, isPending, refetch } = useQuery({
    ...scoutsQueryOptions({
      search: deferredSearch,
      teamId: filters.teamId || undefined,
      stageId: filters.stageId || undefined,
      status: filters.status,
      account: filters.account,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const filtered =
    deferredSearch !== '' ||
    filters.teamId !== '' ||
    filters.stageId !== '' ||
    filters.status !== 'active' ||
    filters.account !== 'all';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading
          title="Routiers"
          description="Fiches des routiers, avec ou sans compte. Recherche par nom, prénoms ou matricule."
        />
        {userCan(user, 'scout.create') && (
          <Button asChild>
            <Link href="/administration/routiers/nouveau">
              <Plus aria-hidden />
              Nouveau routier
            </Link>
          </Button>
        )}
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1 sm:col-span-2 xl:col-span-1">
          <Label htmlFor="scout-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="scout-search"
              type="search"
              className="pl-9"
              placeholder="Nom, prénoms ou matricule"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="scout-team">Équipe</Label>
          <NativeSelect
            id="scout-team"
            value={filters.teamId}
            onChange={(event) => setFilter('teamId', event.target.value)}
          >
            <option value="">Toutes</option>
            <option value={NONE_FILTER}>Sans équipe</option>
            {teams.data?.items.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="scout-stage">Étape</Label>
          <NativeSelect
            id="scout-stage"
            value={filters.stageId}
            onChange={(event) => setFilter('stageId', event.target.value)}
          >
            <option value="">Toutes</option>
            <option value={NONE_FILTER}>Non renseignée</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="scout-status">Statut</Label>
          <NativeSelect
            id="scout-status"
            value={filters.status}
            onChange={(event) =>
              setFilter('status', pick(event.target.value, STATUS_VALUES, 'active'))
            }
          >
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
            <option value="all">Tous</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="scout-account">Compte</Label>
          <NativeSelect
            id="scout-account"
            value={filters.account}
            onChange={(event) =>
              setFilter('account', pick(event.target.value, ACCOUNT_VALUES, 'all'))
            }
          >
            <option value="all">Tous</option>
            <option value="with">Avec compte</option>
            <option value="without">Sans compte</option>
          </NativeSelect>
        </div>
      </form>

      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun routier"
          description={
            filtered
              ? 'Aucun routier ne correspond à ces critères.'
              : 'Aucun routier n’est encore enregistré.'
          }
        />
      ) : (
        <>
          <Table>
            <TableCaption>Liste des routiers</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Routier</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead className="hidden md:table-cell">Équipe</TableHead>
                <TableHead className="hidden md:table-cell">Étape</TableHead>
                <TableHead className="hidden lg:table-cell">Compte</TableHead>
                <TableHead className="hidden sm:table-cell">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((scout) => (
                <TableRow key={scout.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/administration/routiers/${scout.id}`}
                      className="text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {fullName(scout)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">{scout.matricule ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {scout.team?.name ?? 'Sans équipe'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {scout.stage?.name ?? 'Non renseignée'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {scout.hasAccount ? (
                      <Badge variant="secondary">Avec compte</Badge>
                    ) : (
                      <Badge variant="outline">Sans compte</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {scout.isActive ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="outline">Désactivé</Badge>
                    )}
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
