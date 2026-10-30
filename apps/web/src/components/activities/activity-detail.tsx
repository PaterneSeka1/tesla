'use client';

import { NativeSelect } from '@/components/ui/native-select';

import { Textarea } from '@/components/ui/textarea';

import { Input } from '@/components/ui/input';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  changeActivityStatusInputSchema,
  updateActivityInputSchema,
  type AttendanceSheet,
  type SaveAttendanceInput,
} from '@tesla/shared';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { ActivityStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import {
  activityQueryOptions,
  attendanceQueryOptions,
  changeActivityStatus,
  updateActivity,
  saveAttendance,
  programmeCategoriesQueryOptions,
} from '@/lib/api/programmes';
import { competenciesQueryOptions, publishedModulesQueryOptions } from '@/lib/api/progression';

function AttendanceEditor({ sheet }: { sheet: AttendanceSheet }) {
  const [entries, setEntries] = useState<SaveAttendanceInput['entries']>([]);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Présences</h2>
      <p>
        Une ligne non renseignée reste distincte d’une absence. Seules les lignes modifiées sont
        enregistrées.
      </p>
      {!sheet.editable && <p>La saisie sera ouverte après la date prévue ou la réalisation.</p>}
      <div className="space-y-2">
        {sheet.entries.map((entry) => (
          <label
            key={entry.scout.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
          >
            <span>
              {entry.scout.firstName} {entry.scout.lastName} ·{' '}
              {entry.scout.team?.name ?? 'Sans équipe'}
            </span>
            <NativeSelect
              className="rounded border p-2"
              disabled={!sheet.editable || busy}
              value={
                entries.find((e) => e.scoutProfileId === entry.scout.id)?.status ?? entry.status
              }
              onChange={(e) => {
                const status = ATTENDANCE_STATUSES.find((s) => s === e.target.value);
                setEntries((previous) => [
                  ...previous.filter((row) => row.scoutProfileId !== entry.scout.id),
                  // Statut vu à la saisie : conflit plutôt qu'écrasement si un autre membre l'a changé.
                  ...(status
                    ? [{ scoutProfileId: entry.scout.id, status, expectedStatus: entry.status }]
                    : []),
                ]);
              }}
            >
              <option value="NON_RENSEIGNE" disabled={entry.status !== 'NON_RENSEIGNE'}>
                Non renseigné
              </option>
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </label>
        ))}
      </div>
      {sheet.entries.length === 0 && <p>Aucun routier à afficher.</p>}
      <Button
        disabled={!sheet.editable || busy || entries.length === 0}
        onClick={async () => {
          setBusy(true);
          const ok = await action(
            () => saveAttendance(sheet.activity.id, { entries }, sheet.activity.title),
            {
              success: 'Présences enregistrées',
              error: 'Enregistrement impossible',
            },
          );
          if (ok) setEntries([]);
          setBusy(false);
        }}
      >
        Enregistrer les présences
      </Button>
    </section>
  );
}

export function ActivityDetail({ id }: { id: string }) {
  const query = useQuery(activityQueryOptions(id));
  const attendance = useQuery(attendanceQueryOptions(id));
  const categories = useQuery(programmeCategoriesQueryOptions);
  const modules = useQuery(publishedModulesQueryOptions);
  const competencies = useQuery(competenciesQueryOptions({ status: 'active', pageSize: 100 }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = usePedagogyAction();
  if (query.isPending) return <p role="status">Chargement de l’activité…</p>;
  if (!query.data)
    return (
      <p role="alert">
        Impossible de charger l’activité.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </p>
    );
  const activity = query.data;
  const optionsReady = !!categories.data && !!modules.data && !!competencies.data;
  return (
    <>
      <PageHeading
        title={activity.title}
        description={`${activity.plannedOn} · ${activity.programme?.title ?? 'Activité supplémentaire'}`}
      />
      <ActivityStatusBadge status={activity.status} />
      <p>{activity.description}</p>
      {activity.statusReason && <p>Motif : {activity.statusReason}</p>}
      <form
        key={`status-${activity.revision}`}
        className="grid gap-3 rounded border p-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const parsed = changeActivityStatusInputSchema.safeParse({
            status: data.get('status'),
            revision: activity.revision,
            heldOn: data.get('date'),
            postponedTo: data.get('date'),
            reason: data.get('reason'),
            location: data.get('location'),
          });
          if (!parsed.success) {
            setError(parsed.error.issues.map((i) => i.message).join(' '));
            return;
          }
          setError('');
          setBusy(true);
          await action(
            () =>
              changeActivityStatus(
                id,
                parsed.data.status === 'REALISEE'
                  ? { ...parsed.data, location: parsed.data.location ?? undefined }
                  : parsed.data,
                activity.title,
              ),
            { success: 'Statut enregistré', error: 'Changement impossible' },
          );
          setBusy(false);
        }}
      >
        <h2 className="font-semibold sm:col-span-2">Réalisation et statut</h2>
        <label>
          Statut
          <NativeSelect
            name="status"
            aria-label="Statut"
            defaultValue={activity.status}
            className="block w-full rounded border p-2"
          >
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Date effective ou nouvelle date
          <Input
            type="date"
            name="date"
            defaultValue={activity.heldOn ?? activity.plannedOn}
            className="block w-full rounded border p-2"
          />
        </label>
        <label>
          Lieu effectif
          <Input
            name="location"
            defaultValue={activity.location ?? ''}
            className="block w-full rounded border p-2"
          />
        </label>
        <label>
          Motif (report, annulation, rétablissement)
          <Input name="reason" maxLength={1000} className="block w-full rounded border p-2" />
        </label>
        <Button disabled={busy}>Enregistrer le statut</Button>
      </form>
      <form
        key={`edit-${activity.revision}`}
        className="grid gap-3 rounded border p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const parsed = updateActivityInputSchema.safeParse({
            revision: activity.revision,
            title: data.get('title'),
            plannedOn: data.get('plannedOn'),
            leaderLabel: data.get('leaderLabel'),
            description: data.get('description'),
            theme: data.get('theme'),
            objectives: String(data.get('objectives'))
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            plannedLocation: data.get('plannedLocation'),
            contentDone: data.get('contentDone'),
            difficulties: data.get('difficulties'),
            observations: data.get('observations'),
            report: data.get('report'),
            ...(optionsReady
              ? {
                  categoryIds: data.getAll('categoryIds'),
                  moduleIds: data.getAll('moduleIds'),
                  competencyIds: data.getAll('competencyIds'),
                  observedCompetencyIds: data.getAll('observedCompetencyIds'),
                }
              : {}),
          });
          if (!parsed.success) {
            setError(parsed.error.issues.map((i) => i.message).join(' '));
            return;
          }
          setError('');
          setBusy(true);
          await action(() => updateActivity(id, parsed.data, activity.title), {
            success: 'Activité enregistrée',
            error: 'Modification impossible',
          });
          setBusy(false);
        }}
      >
        <h2 className="text-xl font-semibold">Préparation et compte rendu</h2>
        <label>
          Titre
          <Input
            required
            name="title"
            defaultValue={activity.title}
            className="block w-full rounded border p-2"
          />
        </label>
        <label>
          Date prévue
          <Input
            type="date"
            required
            name="plannedOn"
            defaultValue={activity.plannedOn}
            className="block rounded border p-2"
          />
        </label>
        <label>
          Responsable
          <Input
            name="leaderLabel"
            defaultValue={activity.leaderLabel ?? ''}
            className="block w-full rounded border p-2"
          />
        </label>
        {(
          [
            ['theme', 'Thème', activity.theme],
            ['description', 'Description', activity.description],
            ['objectives', 'Objectifs (un par ligne)', activity.objectives.join('\n')],
            ['plannedLocation', 'Lieu prévu', activity.plannedLocation],
            ['contentDone', 'Contenu réalisé', activity.contentDone],
            ['difficulties', 'Difficultés', activity.difficulties],
            ['observations', 'Observations collectives', activity.observations],
            ['report', 'Compte rendu', activity.report],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name}>
            {label}
            <Textarea
              name={name}
              defaultValue={value ?? ''}
              className="block w-full rounded border p-2"
            />
          </label>
        ))}
        {!optionsReady && (
          <p role="status">
            Référentiels indisponibles ou en chargement ; les associations existantes seront
            conservées.
          </p>
        )}
        {optionsReady && (
          <>
            <fieldset>
              <legend>Catégories concernées</legend>
              {categories.data.items.map((c) => (
                <label key={c.id} className="mr-4 inline-flex gap-2">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={activity.categories.some((a) => a.id === c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </fieldset>
            {activity.modules
              .filter((m) => !modules.data.items.some((option) => option.id === m.id))
              .map((m) => (
                <input key={m.id} type="hidden" name="moduleIds" value={m.id} />
              ))}
            {activity.competencies
              .filter((c) => !competencies.data.items.some((option) => option.id === c.id))
              .map((c) => (
                <div key={c.id}>
                  <input type="hidden" name="competencyIds" value={c.id} />
                  {c.observed && <input type="hidden" name="observedCompetencyIds" value={c.id} />}
                </div>
              ))}
            <fieldset>
              <legend>Modules travaillés</legend>
              {modules.data.items.map((m) => (
                <label key={m.id} className="block">
                  <input
                    type="checkbox"
                    name="moduleIds"
                    value={m.id}
                    defaultChecked={activity.modules.some((a) => a.id === m.id)}
                  />{' '}
                  {m.code} · {m.title}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Compétences associées et observées</legend>
              {competencies.data.items.map((c) => (
                <div key={c.id} className="flex flex-wrap gap-4">
                  <label>
                    <input
                      type="checkbox"
                      name="competencyIds"
                      value={c.id}
                      defaultChecked={activity.competencies.some((a) => a.id === c.id)}
                    />{' '}
                    {c.code} · {c.name}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="observedCompetencyIds"
                      value={c.id}
                      defaultChecked={activity.competencies.some(
                        (a) => a.id === c.id && a.observed,
                      )}
                    />{' '}
                    Observée
                  </label>
                </div>
              ))}
            </fieldset>
          </>
        )}
        <Button disabled={busy}>Enregistrer la préparation et le compte rendu</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {attendance.data ? (
        <AttendanceEditor sheet={attendance.data} />
      ) : (
        <p role={attendance.isError ? 'alert' : 'status'}>
          {attendance.isError ? 'Présences indisponibles.' : 'Chargement des présences…'}
        </p>
      )}
      <section>
        <h2 className="text-xl font-semibold">Historique</h2>
        <ul className="space-y-2">
          {activity.events.map((e) => (
            <li key={e.id} className="rounded border p-3">
              {new Date(e.createdAt).toLocaleString('fr-FR')} · {e.actor.firstName}{' '}
              {e.actor.lastName} · {e.action}
              <p>
                {e.comment} {e.fields.join(', ')}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
