'use client';

import { NativeSelect } from '@/components/ui/native-select';

import { Textarea } from '@/components/ui/textarea';

import { Input } from '@/components/ui/input';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  createActivityInputSchema,
} from '@tesla/shared';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { ActivityStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { activitiesQueryOptions, createActivity } from '@/lib/api/programmes';

export function ActivityList({ presences = false }: { presences?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = usePedagogyAction();
  const query = useQuery(
    activitiesQueryOptions({
      search,
      page,
      pageSize: 20,
      status: ACTIVITY_STATUSES.find((s) => s === status),
      attendanceMissing: presences ? 'true' : undefined,
    }),
  );
  return (
    <>
      <PageHeading title={presences ? 'Présences à renseigner' : 'Activités'} />
      <div className="flex flex-wrap gap-3">
        <label>
          Rechercher
          <Input
            className="block rounded border p-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Statut
          <NativeSelect
            aria-label="Statut"
            className="block rounded border p-2"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
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
        </label>
        <Link
          className="self-end underline"
          href={presences ? '/administration/activites' : '/administration/presences'}
        >
          {presences ? 'Toutes les activités' : 'Présences à renseigner'}
        </Link>
      </div>
      {query.isPending && <p role="status">Chargement…</p>}
      {query.isError && (
        <p role="alert">
          Impossible de charger les activités.{' '}
          <button onClick={() => void query.refetch()} className="underline">
            Réessayer
          </button>
        </p>
      )}
      {query.data && (
        <>
          <ul className="space-y-3">
            {query.data.items.map((item) => (
              <li key={item.id} className="rounded border p-4">
                <Link
                  className="font-semibold underline"
                  href={`/administration/activites/${item.id}`}
                >
                  {item.title}
                </Link>
                <p>
                  {item.plannedOn} · {item.leaderLabel || 'Responsable non renseigné'}
                </p>
                <ActivityStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
          {query.data.items.length === 0 && <p>Aucune activité pour ces filtres.</p>}
          <div className="flex gap-3">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span>Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 20 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
      {!presences && (
        <details className="rounded border p-4">
          <summary className="cursor-pointer font-semibold">
            Créer une activité supplémentaire
          </summary>
          <form
            className="mt-4 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const parsed = createActivityInputSchema.safeParse({
                title: data.get('title'),
                plannedOn: data.get('plannedOn'),
                leaderLabel: data.get('leaderLabel'),
                description: data.get('description'),
              });
              if (!parsed.success) {
                setError(parsed.error.issues.map((i) => i.message).join(' '));
                return;
              }
              setError('');
              setBusy(true);
              const ok = await action(
                () =>
                  createActivity({
                    ...parsed.data,
                    theme: parsed.data.theme ?? undefined,
                    leaderLabel: parsed.data.leaderLabel ?? undefined,
                    plannedLocation: parsed.data.plannedLocation ?? undefined,
                  }),
                { success: 'Activité créée', error: 'Création impossible' },
              );
              setBusy(false);
              if (ok) form.reset();
            }}
          >
            <label>
              Titre
              <Input
                name="title"
                required
                maxLength={200}
                className="block w-full rounded border p-2"
              />
            </label>
            <label>
              Date prévue
              <Input name="plannedOn" type="date" required className="block rounded border p-2" />
            </label>
            <label>
              Responsable
              <Input
                name="leaderLabel"
                maxLength={150}
                className="block w-full rounded border p-2"
              />
            </label>
            <label>
              Description
              <Textarea
                name="description"
                maxLength={5000}
                className="block w-full rounded border p-2"
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy}>Créer l’activité</Button>
          </form>
        </details>
      )}
    </>
  );
}
