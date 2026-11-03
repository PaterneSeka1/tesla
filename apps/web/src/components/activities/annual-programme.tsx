'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUSES,
  type ActivityStatus,
  type ActivitySummary,
  IMPORT_ROW_ACTION_LABELS,
  type ImportRowAction,
  type Programme,
  type ProgrammeImportReport,
} from '@tesla/shared';
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Disclosure } from '@/components/disclosure';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { ProgressBar } from '@/components/progress-bar';
import { Tabs } from '@/components/progression/tabs';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  activitiesQueryOptions,
  importProgramme,
  programmeCategoriesQueryOptions,
  programmesQueryOptions,
  updateProgrammeCategory,
} from '@/lib/api/programmes';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { addMonths, programmeOverview } from '@/lib/calendar';
import { formatDate, formatMonth, todayIsoDate } from '@/lib/format';
import { userCan } from '@/lib/navigation';
import { ProgrammeCalendar, SessionList, sessionDate } from './programme-calendar';

// La page répond d'abord à : que faire prochainement, qu'a-t-on réalisé, qu'est-ce qui est en
// retard, que reste-t-il à programmer ? L'import et la correspondance des catégories sont des
// outils ponctuels, repliés en bas de page. Aucune séance n'est générée ni déduite.

/** Séances lues en une fois : un programme annuel en compte quelques dizaines. */
const SESSION_PAGE_SIZE = 100;

export function AnnualProgramme() {
  const user = useSessionUser();
  const programmes = useQuery(programmesQueryOptions);
  const [selected, setSelected] = useState('');
  const programme =
    programmes.data?.items.find((p) => p.id === selected) ?? programmes.data?.items[0];

  return (
    <>
      <PageHeading
        title="Programme annuel"
        description="Aucune séance n’est générée automatiquement."
      />
      {programmes.isPending ? (
        <TableSkeleton rows={4} />
      ) : programmes.isError ? (
        <QueryError error={programmes.error} onRetry={() => void programmes.refetch()} />
      ) : !programme ? (
        <EmptyState icon={CalendarDays} title="Aucun programme configuré." />
      ) : (
        <>
          {programmes.data.items.length > 1 && (
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="programme">Programme</Label>
              <NativeSelect
                id="programme"
                value={programme.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {programmes.data.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <ProgrammeSessions key={programme.id} programme={programme} />
          {userCan(user, 'programme.configure') && (
            <ProgrammeImport key={`import-${programme.id}`} programmeId={programme.id} />
          )}
          <CategoryCorrespondence />
        </>
      )}
    </>
  );
}

function ProgrammeSessions({ programme }: { programme: Programme }) {
  const today = todayIsoDate();
  const sessions = useQuery(
    activitiesQueryOptions({
      programmeId: programme.id,
      pageSize: SESSION_PAGE_SIZE,
      order: 'asc',
    }),
  );
  const [view, setView] = useState('calendar');
  const [status, setStatus] = useState<ActivityStatus | ''>('');
  const [month, setMonth] = useState(today.slice(0, 7));

  if (sessions.isPending) return <TableSkeleton rows={6} />;
  if (sessions.isError) {
    return <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }

  const items = sessions.data.items;
  const overview = programmeOverview(
    items.map((item) => ({ plannedOn: sessionDate(item), status: item.status })),
    today,
    programme,
  );
  const next = items
    .filter(
      (item) =>
        (item.status === 'PLANIFIEE' || item.status === 'REPORTEE') && item.plannedOn >= today,
    )
    .slice(0, 3);
  const countable = items.length - overview.cancelled;
  const hasPeriod = Boolean(programme.startsOn && programme.endsOn);
  const shown = status ? items.filter((item) => item.status === status) : items;

  return (
    <>
      <section
        aria-labelledby="programme-summary"
        className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 id="programme-summary" className="text-lg font-semibold text-tesla-bordeaux">
              {programme.title}
            </h2>
            {programme.startsOn && programme.endsOn && (
              <p className="text-sm text-muted-foreground">
                Du {formatDate(programme.startsOn)} au {formatDate(programme.endsOn)}
              </p>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/administration/activites">
              <ClipboardList aria-hidden />
              Gérer les séances
            </Link>
          </Button>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>Avancement</span>
            <span className="tabular-nums text-muted-foreground">
              {overview.realised} réalisée{overview.realised > 1 ? 's' : ''} sur {countable}
            </span>
          </div>
          <ProgressBar
            label="Avancement du programme"
            value={overview.realised}
            max={countable}
            valueText={`${overview.realised} séances réalisées sur ${countable}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="À venir" value={overview.upcoming} icon={CalendarClock} />
          <StatCard label="Réalisées" value={overview.realised} icon={CalendarCheck} />
          <StatCard
            label="En retard"
            value={overview.overdue}
            icon={CircleAlert}
            hint="Date passée, statut à mettre à jour"
          />
          <StatCard
            label="Mois sans séance"
            value={hasPeriod ? overview.monthsWithoutSession.length : '—'}
            icon={CalendarPlus}
            hint={
              !hasPeriod
                ? 'Période du programme non renseignée'
                : overview.monthsWithoutSession.length > 0
                  ? overview.monthsWithoutSession.map((m) => formatMonth(m)).join(', ')
                  : undefined
            }
          />
        </div>
        {next.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Prochaines séances</h3>
            <SessionList sessions={next} />
          </div>
        )}
      </section>

      <section aria-labelledby="programme-sessions" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="programme-sessions" className="text-lg font-semibold text-tesla-bordeaux">
            Séances
          </h2>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="session-status">Statut</Label>
            <NativeSelect
              id="session-status"
              value={status}
              onChange={(e) => setStatus(ACTIVITY_STATUSES.find((s) => s === e.target.value) ?? '')}
            >
              <option value="">Tous</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTIVITY_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {sessions.data.total > items.length && (
          <p className="text-sm text-muted-foreground">
            {items.length} premières séances affichées sur {sessions.data.total}.
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune séance dans ce programme."
            description="Les séances s’ajoutent depuis « Activités » ou par import du programme approuvé."
          />
        ) : (
          <Tabs
            label="Affichage des séances"
            items={[
              { key: 'calendar', label: 'Calendrier' },
              { key: 'timeline', label: 'Chronologie' },
            ]}
            active={view}
            onChange={setView}
          >
            {view === 'calendar' ? (
              <ProgrammeCalendar
                activities={shown}
                month={month}
                today={today}
                onMonthChange={(delta) =>
                  setMonth(delta === 'today' ? today.slice(0, 7) : addMonths(month, delta))
                }
              />
            ) : (
              <Timeline sessions={shown} />
            )}
          </Tabs>
        )}
      </section>
    </>
  );
}

/** Séances regroupées par mois, dans l'ordre chronologique. */
function Timeline({ sessions }: { sessions: readonly ActivitySummary[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune séance pour ce statut.</p>;
  }
  const months = new Map<string, ActivitySummary[]>();
  for (const session of [...sessions].sort((a, b) =>
    sessionDate(a).localeCompare(sessionDate(b)),
  )) {
    const month = sessionDate(session).slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), session]);
  }
  return (
    <ol className="space-y-5">
      {[...months].map(([month, items]) => (
        <li key={month} className="space-y-2">
          <h3 className="text-sm font-semibold capitalize text-muted-foreground">
            {formatMonth(month, 'long')}
          </h3>
          <SessionList sessions={items} />
        </li>
      ))}
    </ol>
  );
}

const IMPORT_ROW_VARIANTS: Record<
  ImportRowAction,
  'secondary' | 'success' | 'outline' | 'accent' | 'destructive'
> = {
  CREER: 'success',
  METTRE_A_JOUR: 'accent',
  INCHANGEE: 'outline',
  CONSERVEE_MANUELLE: 'secondary',
  ERREUR: 'destructive',
};

/** Import du tableau Markdown approuvé : prévisualisation obligatoire, puis confirmation. */
function ProgrammeImport({ programmeId }: { programmeId: string }) {
  const [content, setContent] = useState('');
  const [report, setReport] = useState<ProgrammeImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  const run = async (apply: boolean) => {
    setBusy(true);
    if (!apply) setReport(null);
    await action(
      async () => {
        setReport(await importProgramme(programmeId, content, apply));
      },
      apply
        ? { success: 'Programme importé', error: 'Import impossible' }
        : { success: 'Prévisualisation disponible', error: 'Analyse impossible' },
    );
    setBusy(false);
  };
  return (
    <Disclosure
      title="Importer le programme approuvé"
      summary="Tableau Markdown, prévisualisé avant tout enregistrement."
    >
      <p className="text-sm text-muted-foreground">
        Colonnes Date et Activité ; facultatives : Catégories, Thème, Objectifs (séparés par ;),
        Modules (codes), Responsable, Lieu. Dates : AAAA-MM-JJ ou JJ/MM/AAAA. Les séances modifiées
        manuellement sont conservées.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="programme-source">Tableau source</Label>
        <Textarea
          id="programme-source"
          rows={10}
          maxLength={200000}
          className="font-mono text-sm"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setReport(null);
          }}
        />
      </div>
      <Button variant="outline" disabled={busy || !content} onClick={() => void run(false)}>
        Prévisualiser sans écrire
      </Button>
      {report && (
        <div className="space-y-3">
          <p role="status" className="text-sm font-medium">
            {report.applied
              ? 'Import enregistré.'
              : 'Prévisualisation : vérifiez les lignes avant de confirmer.'}
          </p>
          <ul className="divide-y rounded-lg border">
            {report.rows.map((row, index) => (
              <li key={`${row.line}-${index}`} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">Ligne {row.line}</span>
                  <span className="font-medium">{row.title}</span>
                  <span className="text-muted-foreground">{row.date}</span>
                  <Badge variant={IMPORT_ROW_VARIANTS[row.action]}>
                    {IMPORT_ROW_ACTION_LABELS[row.action]}
                  </Badge>
                </div>
                {row.messages.length > 0 && (
                  <p className="text-muted-foreground">{row.messages.join(' ')}</p>
                )}
              </li>
            ))}
          </ul>
          <Button
            disabled={
              busy || report.applied || report.counts.ERREUR > 0 || report.rows.length === 0
            }
            onClick={() => void run(true)}
          >
            Confirmer l’import prévisualisé
          </Button>
        </div>
      )}
    </Disclosure>
  );
}

/** Correspondance catégories → étapes : confirmée par le responsable, sans effet automatique. */
function CategoryCorrespondence() {
  const user = useSessionUser();
  const categories = useQuery(programmeCategoriesQueryOptions);
  const stages = useQuery(stagesQueryOptions);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  const canConfigure = userCan(user, 'programme.configure');
  return (
    <Disclosure
      title="Correspondance catégories et étapes"
      summary="Confirmée par le responsable ; aucune durée ni promotion automatique."
    >
      {categories.isPending ? (
        <TableSkeleton rows={3} />
      ) : categories.isError ? (
        <QueryError error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <ul className="space-y-3">
          {categories.data.items.map((category) => (
            <li key={`${category.id}-${category.stage?.id}-${category.correspondenceValidated}`}>
              <form
                className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  setBusy(true);
                  await action(
                    () =>
                      updateProgrammeCategory(category.id, {
                        stageId: String(data.get('stageId')) || null,
                        correspondenceValidated: data.get('confirmed') === 'on',
                      }),
                    { success: 'Correspondance enregistrée', error: 'Modification impossible' },
                  );
                  setBusy(false);
                }}
              >
                <div className="min-w-48 flex-1 space-y-1.5">
                  <Label htmlFor={`category-${category.id}`}>{category.label}</Label>
                  <NativeSelect
                    id={`category-${category.id}`}
                    name="stageId"
                    defaultValue={category.stage?.id ?? ''}
                    disabled={!canConfigure}
                  >
                    <option value="">Sans correspondance</option>
                    {stages.data?.items.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="confirmed"
                    className="size-4 accent-tesla-rouge"
                    defaultChecked={category.correspondenceValidated}
                    disabled={!canConfigure}
                  />
                  Correspondance confirmée
                </label>
                {canConfigure && (
                  <Button variant="outline" disabled={busy || !stages.data}>
                    Enregistrer
                  </Button>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </Disclosure>
  );
}
