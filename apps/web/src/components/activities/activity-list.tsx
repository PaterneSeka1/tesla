'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ACTIVITY_ORIGIN_LABELS,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityStatus,
  createActivityInputSchema,
} from '@tesla/shared';
import { CalendarCheck, CalendarDays, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { ActivityStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { activitiesQueryOptions, createActivity } from '@/lib/api/programmes';
import { formatDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 20;

/** Activités (`presences` : seulement celles dont les présences restent à saisir). */
export function ActivityList({ presences = false }: { presences?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ActivityStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const filtered = Boolean(debouncedSearch || status);
  const query = useQuery({
    ...activitiesQueryOptions({
      search: debouncedSearch,
      page,
      pageSize: PAGE_SIZE,
      status: status || undefined,
      attendanceMissing: presences ? 'true' : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title={presences ? 'Présences à renseigner' : 'Activités'} />
        {!presences && <CreateActivityDialog />}
      </div>

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[1fr_12rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <SearchInput
          id="activity-search"
          placeholder="Titre ou thème"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <div className="space-y-1">
          <Label htmlFor="activity-status">Statut</Label>
          <NativeSelect
            id="activity-status"
            value={status}
            onChange={(event) => {
              setStatus(ACTIVITY_STATUSES.find((s) => s === event.target.value) ?? '');
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>
      <p className="text-sm">
        <Link
          className="text-tesla-rouge underline-offset-4 hover:underline"
          href={presences ? '/administration/activites' : '/administration/presences'}
        >
          {presences ? 'Toutes les activités' : 'Présences à renseigner'}
        </Link>
      </p>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={presences ? CalendarCheck : CalendarDays}
          title={
            presences && !filtered ? 'Toutes les présences sont renseignées' : 'Aucune activité'
          }
          description={filtered ? 'Modifiez la recherche ou les filtres.' : undefined}
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {query.data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/administration/activites/${item.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatDate(item.heldOn ?? item.plannedOn)} ·{' '}
                      {item.leaderLabel || 'Responsable non renseigné'}
                      <span className="hidden sm:inline">
                        {' '}
                        · {ACTIVITY_ORIGIN_LABELS[item.origin]}
                      </span>
                    </span>
                  </span>
                  <ActivityStatusBadge status={item.status} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

const createFormSchema = createActivityInputSchema;
type CreateForm = z.input<typeof createFormSchema>;

/** Création d'une activité supplémentaire (les séances du programme viennent de l'import). */
function CreateActivityDialog() {
  const [open, setOpen] = useState(false);
  const action = usePedagogyAction();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm, unknown, z.output<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { title: '', plannedOn: '', leaderLabel: '', description: '' },
  });

  const submit = handleSubmit(async (data) => {
    const ok = await action(
      () =>
        createActivity({
          ...data,
          theme: data.theme ?? undefined,
          leaderLabel: data.leaderLabel ?? undefined,
          plannedLocation: data.plannedLocation ?? undefined,
        }),
      { success: 'Activité créée', error: 'Création impossible' },
    );
    if (ok) {
      reset();
      setOpen(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Activité supplémentaire
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle activité supplémentaire</DialogTitle>
          <DialogDescription>Hors programme annuel.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <FormField id="activity-title" label="Titre" error={errors.title?.message} required>
            <Input
              {...fieldA11y('activity-title', errors.title?.message)}
              maxLength={200}
              {...register('title')}
            />
          </FormField>
          <FormField
            id="activity-date"
            label="Date prévue"
            error={errors.plannedOn?.message}
            required
          >
            <Input
              {...fieldA11y('activity-date', errors.plannedOn?.message)}
              type="date"
              {...register('plannedOn')}
            />
          </FormField>
          <FormField id="activity-leader" label="Responsable" error={errors.leaderLabel?.message}>
            <Input
              {...fieldA11y('activity-leader', errors.leaderLabel?.message)}
              maxLength={150}
              {...register('leaderLabel')}
            />
          </FormField>
          <FormField
            id="activity-description"
            label="Description"
            error={errors.description?.message}
          >
            <Textarea
              {...fieldA11y('activity-description', errors.description?.message)}
              maxLength={5000}
              rows={4}
              {...register('description')}
            />
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              Créer l’activité
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
