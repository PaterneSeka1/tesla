'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ORIGIN_LABELS,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityStatus,
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  changeActivityStatusInputSchema,
  updateActivityInputSchema,
  type ActivityDetail as ActivityDetailData,
  type AttendanceSheet,
  type SaveAttendanceInput,
} from '@tesla/shared';
import { CircleAlert, ClipboardList, Users } from 'lucide-react';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { Disclosure } from '@/components/disclosure';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { Tabs } from '@/components/progression/tabs';
import { ActivityStatusBadge } from '@/components/progression/status-badges';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  activityQueryOptions,
  attendanceQueryOptions,
  changeActivityStatus,
  updateActivity,
  saveAttendance,
  programmeCategoriesQueryOptions,
} from '@/lib/api/programmes';
import { competenciesQueryOptions, publishedModulesQueryOptions } from '@/lib/api/progression';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/utils';

const CHECKBOX = 'size-4 shrink-0 accent-tesla-rouge';

function AttendanceEditor({ sheet }: { sheet: AttendanceSheet }) {
  const [entries, setEntries] = useState<SaveAttendanceInput['entries']>([]);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  const statusOf = (scoutId: string, saved: string) =>
    entries.find((e) => e.scoutProfileId === scoutId)?.status ?? saved;
  const counts = sheet.entries.reduce<Record<string, number>>((acc, entry) => {
    const status = statusOf(entry.scout.id, entry.status);
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">Présences</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Une ligne non renseignée reste distincte d’une absence. Seules les lignes modifiées sont
          enregistrées.
        </p>
        {!sheet.editable && (
          <Alert>
            <CircleAlert aria-hidden />
            <AlertDescription>
              La saisie sera ouverte après la date prévue ou la réalisation.
            </AlertDescription>
          </Alert>
        )}
        {sheet.entries.length === 0 ? (
          <EmptyState icon={Users} title="Aucun routier à afficher." />
        ) : (
          <>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite">
              {ATTENDANCE_STATUSES.map((s) => (
                <span key={s}>
                  {ATTENDANCE_STATUS_LABELS[s]} :{' '}
                  <span className="font-semibold tabular-nums">{counts[s] ?? 0}</span>
                </span>
              ))}
              <span className="text-muted-foreground">
                Non renseigné : <span className="tabular-nums">{counts.NON_RENSEIGNE ?? 0}</span>
              </span>
            </p>
            <ul className="divide-y rounded-lg border">
              {sheet.entries.map((entry) => {
                const selectId = `attendance-${entry.scout.id}`;
                return (
                  <li
                    key={entry.scout.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <Label htmlFor={selectId} className="min-w-0 flex-1 font-normal">
                      <span className="font-medium">{fullName(entry.scout)}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {entry.scout.team?.name ?? 'Sans équipe'}
                      </span>
                    </Label>
                    <NativeSelect
                      id={selectId}
                      className="w-40"
                      disabled={!sheet.editable || busy}
                      value={statusOf(entry.scout.id, entry.status)}
                      onChange={(e) => {
                        const status = ATTENDANCE_STATUSES.find((s) => s === e.target.value);
                        setEntries((previous) => [
                          ...previous.filter((row) => row.scoutProfileId !== entry.scout.id),
                          // Statut vu à la saisie : conflit plutôt qu'écrasement si un autre membre l'a changé.
                          ...(status
                            ? [
                                {
                                  scoutProfileId: entry.scout.id,
                                  status,
                                  expectedStatus: entry.status,
                                },
                              ]
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
                  </li>
                );
              })}
            </ul>
          </>
        )}
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
          {entries.length > 0 && ` (${entries.length})`}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Champs utiles selon le statut choisi (les autres restent soumis, simplement masqués). */
const STATUS_FIELDS: Record<
  ActivityStatus,
  { date?: string; location?: boolean; reason?: boolean }
> = {
  REALISEE: { date: 'Date effective', location: true },
  REPORTEE: { date: 'Nouvelle date', reason: true },
  ANNULEE: { reason: true },
  PLANIFIEE: { reason: true },
};

/** Libellés des champs modifiés à la main (l'historique ne montre jamais un nom technique). */
const FIELD_LABELS: Record<string, string> = {
  title: 'Intitulé',
  theme: 'Axe / thème',
  description: 'Description',
  objectives: 'Objectifs',
  plannedOn: 'Date prévue',
  plannedLocation: 'Lieu prévu',
  leaderLabel: 'Responsable prévu',
  plannedFormat: 'Format prévu',
  planningNotes: 'Observations du programme',
  categoryIds: 'Catégories',
  categoryContents: 'Contenus par catégorie',
  moduleIds: 'Modules',
  competencyIds: 'Compétences',
  observedCompetencyIds: 'Compétences observées',
  location: 'Lieu effectif',
  contentDone: 'Activités menées',
  difficulties: 'Difficultés',
  observations: 'Observations de terrain',
  report: 'Compte rendu',
  heldByLabel: 'Responsable effectif',
  outcomes: 'Objectifs atteints',
  followUp: 'Décisions et suites',
};

const NOT_SET = 'Non renseigné';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('whitespace-pre-line', empty && 'text-muted-foreground')}>
        {empty ? NOT_SET : value}
      </dd>
    </div>
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
  const [tab, setTab] = useState('prevu');
  const [nextStatus, setNextStatus] = useState<ActivityStatus | null>(null);
  const action = usePedagogyAction();
  if (query.isPending) return <TableSkeleton rows={6} />;
  if (!query.data) {
    return (
      <>
        <BackLink href="/administration/activites">Activités</BackLink>
        <QueryError
          error={query.error ?? new Error('Activité introuvable.')}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }
  const activity = query.data;
  const optionsReady = !!categories.data && !!modules.data && !!competencies.data;
  const selectedStatus = nextStatus ?? activity.status;
  const fields = STATUS_FIELDS[selectedStatus];
  const moved = activity.initialPlannedOn !== activity.plannedOn;
  const dateLine = activity.heldOn
    ? activity.heldOn !== activity.initialPlannedOn
      ? `Initialement prévue le ${formatDate(activity.initialPlannedOn)} — Réalisée le ${formatDate(activity.heldOn)}`
      : `Réalisée le ${formatDate(activity.heldOn)}`
    : moved
      ? `Initialement prévue le ${formatDate(activity.initialPlannedOn)} — Prévue désormais le ${formatDate(activity.plannedOn)}`
      : `Prévue le ${formatDate(activity.plannedOn)}`;
  const meta = [
    activity.programme?.title ?? ACTIVITY_ORIGIN_LABELS[activity.origin],
    activity.theme && `Axe : ${activity.theme}`,
    activity.leaderLabel && `Responsable prévu : ${activity.leaderLabel}`,
    activity.heldByLabel && `Animée par : ${activity.heldByLabel}`,
  ].filter(Boolean);
  const plannedContents =
    activity.categoryContents.length > 0
      ? activity.categoryContents
      : activity.categories.map((c) => ({ categoryId: c.id, label: c.label, content: null }));
  const observed = activity.competencies.filter((c) => c.observed);
  const realisation = [
    activity.heldOn,
    activity.heldByLabel,
    activity.location,
    activity.contentDone,
    activity.outcomes,
    activity.difficulties,
    activity.observations,
    activity.report,
    activity.followUp,
  ].some(Boolean);
  const counts = activity.attendance;
  const recorded = counts.present + counts.absent + counts.excused;

  return (
    <>
      <BackLink href="/administration/activites">Activités</BackLink>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <PageHeading title={activity.title} />
          <ActivityStatusBadge status={activity.status} />
        </div>
        <p
          className={cn('text-sm font-medium', (moved || activity.heldOn) && 'text-tesla-bordeaux')}
        >
          {dateLine}
        </p>
        <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
        {activity.statusReason && (
          <p className="text-sm">
            <span className="font-medium">Motif :</span> {activity.statusReason}
          </p>
        )}
      </div>

      <Tabs
        label="Fiche de séance"
        items={[
          { key: 'prevu', label: 'Programme prévu' },
          { key: 'realise', label: 'Réalisation' },
          { key: 'presences', label: 'Présences' },
          { key: 'comparaison', label: 'Prévu / réalisé' },
          { key: 'historique', label: 'Historique' },
        ]}
        active={tab}
        onChange={setTab}
      >
        {tab === 'prevu' && (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Temps commun / objectif" value={activity.title} />
              <Field label="Format prévu" value={activity.plannedFormat} />
              <Field label="Responsable prévu" value={activity.leaderLabel} />
              <Field label="Lieu prévu" value={activity.plannedLocation} />
              {activity.description && <Field label="Description" value={activity.description} />}
              {activity.objectives.length > 0 && (
                <Field
                  label="Objectifs prévus"
                  value={
                    <ul className="list-disc pl-5">
                      {activity.objectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  }
                />
              )}
            </dl>
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Contenus prévus par catégorie</h2>
              <p className="text-sm text-muted-foreground">
                Un contenu prévu n’indique pas que la catégorie a participé : voir les présences.
              </p>
              {plannedContents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune catégorie indiquée.</p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {plannedContents.map((c) => (
                    <div key={c.categoryId} className="rounded-lg border p-3">
                      <Field label={c.label} value={c.content} />
                    </div>
                  ))}
                </dl>
              )}
            </section>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Modules associés"
                value={activity.modules.map((m) => `${m.code} · ${m.title}`).join('\n')}
              />
              <Field
                label="Compétences visées"
                value={activity.competencies.map((c) => `${c.code} · ${c.name}`).join('\n')}
              />
              <Field label="Observations du programme" value={activity.planningNotes} />
              {(activity.sourceStatus || activity.sourceAttendanceCount !== null) && (
                <Field
                  label="Indiqué dans le fichier du programme"
                  value={[
                    activity.sourceStatus && `Statut : ${activity.sourceStatus}`,
                    activity.sourceAttendanceCount !== null &&
                      `Effectif : ${activity.sourceAttendanceCount}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              )}
            </dl>
          </div>
        )}

        {tab === 'realise' && (
          <div className="space-y-5">
            {!realisation ? (
              <EmptyState
                icon={ClipboardList}
                title="Aucune réalisation enregistrée."
                description="Changez le statut puis complétez le compte rendu ci-dessous."
              />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Date effective"
                  value={activity.heldOn && formatDate(activity.heldOn)}
                />
                <Field label="Responsable effectif" value={activity.heldByLabel} />
                <Field label="Lieu effectif" value={activity.location} />
                <Field label="Activités menées" value={activity.contentDone} />
                <Field label="Objectifs atteints ou non" value={activity.outcomes} />
                <Field label="Difficultés" value={activity.difficulties} />
                <Field label="Observations de terrain" value={activity.observations} />
                <Field label="Décisions et suites à donner" value={activity.followUp} />
                <Field
                  label="Compétences observées"
                  value={observed.map((c) => `${c.code} · ${c.name}`).join('\n')}
                />
                <div className="sm:col-span-2">
                  <Field label="Compte rendu" value={activity.report} />
                </div>
              </dl>
            )}
            <StatusCard
              activity={activity}
              busy={busy}
              fields={fields}
              selectedStatus={selectedStatus}
              onStatus={setNextStatus}
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
                const ok = await action(
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
                if (ok) setNextStatus(null);
                setBusy(false);
              }}
            />
          </div>
        )}

        {tab === 'presences' &&
          (attendance.isPending ? (
            <TableSkeleton rows={4} />
          ) : attendance.isError ? (
            <QueryError error={attendance.error} onRetry={() => void attendance.refetch()} />
          ) : (
            <AttendanceEditor sheet={attendance.data} />
          ))}

        {tab === 'comparaison' && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[9rem_1fr_1fr] gap-3 px-3 text-sm font-semibold sm:grid">
              <span>Élément</span>
              <span>Prévu</span>
              <span>Réalisé</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {(
                [
                  [
                    'Date',
                    formatDate(activity.initialPlannedOn) +
                      (moved ? ` (reprogrammée au ${formatDate(activity.plannedOn)})` : ''),
                    activity.heldOn && formatDate(activity.heldOn),
                  ],
                  ['Responsable', activity.leaderLabel, activity.heldByLabel],
                  ['Lieu', activity.plannedLocation, activity.location],
                  [
                    'Objectifs',
                    [activity.title, ...activity.objectives].join('\n'),
                    activity.outcomes,
                  ],
                  [
                    'Activités',
                    plannedContents
                      .filter((c) => c.content)
                      .map((c) => `${c.label} : ${c.content}`)
                      .join('\n') || activity.description,
                    activity.contentDone,
                  ],
                  [
                    'Effectif',
                    activity.sourceAttendanceCount !== null
                      ? `${activity.sourceAttendanceCount} (fichier du programme)`
                      : null,
                    recorded > 0
                      ? `${counts.present} présent(s), ${counts.absent} absent(s), ${counts.excused} excusé(s) — saisie nominative`
                      : null,
                  ],
                  ['Observations', activity.planningNotes, activity.observations],
                ] as const
              ).map(([label, planned, done]) => (
                <li
                  key={label}
                  className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[9rem_1fr_1fr] sm:gap-3"
                >
                  <span className="font-medium">{label}</span>
                  <span className={cn('whitespace-pre-line', !planned && 'text-muted-foreground')}>
                    <span className="text-muted-foreground sm:hidden">Prévu : </span>
                    {planned || '—'}
                  </span>
                  <span className={cn('whitespace-pre-line', !done && 'text-muted-foreground')}>
                    <span className="text-muted-foreground sm:hidden">Réalisé : </span>
                    {done || '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'historique' && (
          <ol className="space-y-3 border-l-2 border-tesla-sable pl-4">
            {activity.events.map((e) => (
              <li key={e.id} className="text-sm">
                <p>
                  <span className="font-medium">{ACTIVITY_ACTION_LABELS[e.action]}</span>
                  {e.toStatus && e.action === 'STATUT_MODIFIE' && (
                    <span> : {ACTIVITY_STATUS_LABELS[e.toStatus]}</span>
                  )}
                  <span className="text-muted-foreground">
                    {' '}
                    · {fullName(e.actor)} · {formatDateTime(e.createdAt)}
                  </span>
                </p>
                {e.plannedOnChange && (
                  <p>
                    Date : {formatDate(e.plannedOnChange.from)} → {formatDate(e.plannedOnChange.to)}
                  </p>
                )}
                {e.comment && <p className="text-muted-foreground">{e.comment}</p>}
                {e.fields.length > 0 && (
                  <p className="text-muted-foreground">
                    Modifié : {e.fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Tabs>

      <Disclosure
        title="Modifier la préparation et le compte rendu"
        summary="Programme prévu, réalisation, modules et compétences."
      >
        <form
          key={`edit-${activity.revision}`}
          className="space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const checked = optionsReady
              ? data.getAll('categoryIds').map(String)
              : activity.categories.map((c) => c.id);
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
              plannedFormat: data.get('plannedFormat'),
              planningNotes: data.get('planningNotes'),
              heldByLabel: data.get('heldByLabel'),
              contentDone: data.get('contentDone'),
              outcomes: data.get('outcomes'),
              difficulties: data.get('difficulties'),
              observations: data.get('observations'),
              followUp: data.get('followUp'),
              report: data.get('report'),
              ...(optionsReady
                ? {
                    categoryIds: checked,
                    categoryContents: checked.map((categoryId) => ({
                      categoryId,
                      content: String(data.get(`content-${categoryId}`) ?? ''),
                    })),
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
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Programme prévu</legend>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="activity-title">Intitulé (temps commun / objectif)</Label>
              <Input id="activity-title" required name="title" defaultValue={activity.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-planned">Date prévue</Label>
              <Input
                id="activity-planned"
                type="date"
                required
                name="plannedOn"
                defaultValue={activity.plannedOn}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-leader">Responsable prévu</Label>
              <Input
                id="activity-leader"
                name="leaderLabel"
                defaultValue={activity.leaderLabel ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-format">Format prévu</Label>
              <Input
                id="activity-format"
                name="plannedFormat"
                maxLength={150}
                defaultValue={activity.plannedFormat ?? ''}
              />
            </div>
            {(
              [
                ['theme', 'Axe / thème', activity.theme],
                ['plannedLocation', 'Lieu prévu', activity.plannedLocation],
                ['description', 'Description', activity.description],
                ['objectives', 'Objectifs (un par ligne)', activity.objectives.join('\n')],
                ['planningNotes', 'Observations du programme', activity.planningNotes],
              ] as const
            ).map(([name, label, value]) => (
              <TextField key={name} name={name} label={label} value={value} />
            ))}
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Réalisation</legend>
            <div className="space-y-1.5">
              <Label htmlFor="activity-held-by">Responsable effectif</Label>
              <Input
                id="activity-held-by"
                name="heldByLabel"
                maxLength={150}
                defaultValue={activity.heldByLabel ?? ''}
              />
            </div>
            {(
              [
                ['contentDone', 'Activités menées', activity.contentDone],
                ['outcomes', 'Objectifs atteints ou non atteints', activity.outcomes],
                ['difficulties', 'Difficultés', activity.difficulties],
                ['observations', 'Observations de terrain', activity.observations],
                ['followUp', 'Décisions et suites à donner', activity.followUp],
                ['report', 'Compte rendu', activity.report],
              ] as const
            ).map(([name, label, value]) => (
              <TextField key={name} name={name} label={label} value={value} />
            ))}
          </fieldset>
          {!optionsReady && (
            <p role="status" className="text-sm text-muted-foreground">
              Référentiels indisponibles ou en chargement ; les associations existantes seront
              conservées.
            </p>
          )}
          {optionsReady && (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-semibold">
                  Catégories concernées et contenus prévus
                </legend>
                {categories.data.items.map((c) => {
                  const current = activity.categoryContents.find((a) => a.categoryId === c.id);
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <label className="inline-flex min-h-8 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className={CHECKBOX}
                          name="categoryIds"
                          value={c.id}
                          defaultChecked={activity.categories.some((a) => a.id === c.id)}
                        />
                        {c.label}
                      </label>
                      <Textarea
                        aria-label={`Contenu prévu — ${c.label}`}
                        name={`content-${c.id}`}
                        rows={2}
                        maxLength={3000}
                        defaultValue={current?.content ?? ''}
                      />
                    </div>
                  );
                })}
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
                    {c.observed && (
                      <input type="hidden" name="observedCompetencyIds" value={c.id} />
                    )}
                  </div>
                ))}
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Modules travaillés</legend>
                {modules.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun module publié.</p>
                ) : (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {modules.data.items.map((m) => (
                      <label key={m.id} className="flex min-h-8 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className={CHECKBOX}
                          name="moduleIds"
                          value={m.id}
                          defaultChecked={activity.modules.some((a) => a.id === m.id)}
                        />
                        <span>
                          <span className="text-muted-foreground">{m.code}</span> · {m.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">
                  Compétences associées et observées
                </legend>
                {competencies.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune compétence active.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {competencies.data.items.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2"
                      >
                        <label className="flex min-h-8 flex-1 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            name="competencyIds"
                            value={c.id}
                            defaultChecked={activity.competencies.some((a) => a.id === c.id)}
                          />
                          <span>
                            <span className="text-muted-foreground">{c.code}</span> · {c.name}
                          </span>
                        </label>
                        <label className="flex min-h-8 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            name="observedCompetencyIds"
                            value={c.id}
                            defaultChecked={activity.competencies.some(
                              (a) => a.id === c.id && a.observed,
                            )}
                          />
                          Observée
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </>
          )}
          <Button disabled={busy} className="h-auto min-h-10 max-w-full whitespace-normal py-2">
            Enregistrer la préparation et le compte rendu
          </Button>
        </form>
      </Disclosure>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

/** Changement de statut motivé (réalisée, reportée, annulée, rétablie). */
function StatusCard({
  activity,
  busy,
  fields,
  selectedStatus,
  onStatus,
  onSubmit,
}: {
  activity: ActivityDetailData;
  busy: boolean;
  fields: (typeof STATUS_FIELDS)[ActivityStatus];
  selectedStatus: ActivityStatus;
  onStatus: (status: ActivityStatus | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">Statut</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          key={`status-${activity.revision}`}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => void onSubmit(event)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="activity-next-status">Statut</Label>
            <NativeSelect
              id="activity-next-status"
              name="status"
              value={selectedStatus}
              onChange={(e) =>
                onStatus(ACTIVITY_STATUSES.find((s) => s === e.target.value) ?? null)
              }
            >
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTIVITY_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className={cn('space-y-1.5', !fields.date && 'hidden')}>
            <Label htmlFor="activity-status-date">{fields.date ?? 'Date'}</Label>
            <Input
              id="activity-status-date"
              type="date"
              name="date"
              defaultValue={activity.heldOn ?? activity.plannedOn}
            />
          </div>
          <div className={cn('space-y-1.5', !fields.location && 'hidden')}>
            <Label htmlFor="activity-status-location">Lieu effectif</Label>
            <Input
              id="activity-status-location"
              name="location"
              defaultValue={activity.location ?? ''}
            />
          </div>
          <div className={cn('space-y-1.5 sm:col-span-2', !fields.reason && 'hidden')}>
            <Label htmlFor="activity-status-reason">Motif</Label>
            <Input id="activity-status-reason" name="reason" maxLength={1000} />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={busy}>Enregistrer le statut</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({ name, label, value }: { name: string; label: string; value: string | null }) {
  const id = `activity-${name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} rows={3} defaultValue={value ?? ''} />
    </div>
  );
}
