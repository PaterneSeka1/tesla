'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ACTIVITY_STATUS_LABELS,
  CATEGORY_FIELD_PREFIX,
  IGNORED_COLUMN,
  IMPORT_ROW_ACTION_LABELS,
  IMPORT_ROW_ACTIONS,
  type ImportDecision,
  type ImportRowAction,
  PROGRAMME_IMPORT_FIELD_LABELS,
  PROGRAMME_IMPORT_FIELDS,
  PROGRAMME_XLSX_MAX_BYTES,
  type Programme,
  type ProgrammeImportReport,
} from '@tesla/shared';
import { CircleAlert, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Disclosure } from '@/components/disclosure';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  importProgramme,
  importProgrammeExcel,
  programmeCategoriesQueryOptions,
  programmeImportsQueryOptions,
} from '@/lib/api/programmes';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

// Parcours : fichier → feuille et colonnes → séances, anomalies et rapprochements → confirmation.
// L'analyse n'écrit rien ; la confirmation renvoie l'empreinte examinée et le serveur refuse si le
// programme a changé entre-temps. L'import exige une connexion : rien n'est simulé hors ligne.

const ROW_VARIANTS: Record<
  ImportRowAction,
  'secondary' | 'success' | 'outline' | 'accent' | 'destructive' | 'default'
> = {
  CREER: 'success',
  METTRE_A_JOUR: 'accent',
  INCHANGEE: 'outline',
  CONSERVEE_MANUELLE: 'secondary',
  A_DECIDER: 'default',
  IGNOREE: 'outline',
  ERREUR: 'destructive',
};

interface SelectedFile {
  name: string;
  base64: string;
}

interface Settings {
  sheet?: string;
  headerRow?: number;
  mapping: Record<string, string>;
  decisions: ImportDecision[];
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

/** Import du programme annuel : Excel en parcours principal, Markdown en option secondaire. */
export function ProgrammeImportPanel({ programme }: { programme: Programme }) {
  return (
    <section aria-labelledby="programme-import" className="space-y-3">
      <h2 id="programme-import" className="text-lg font-semibold text-tesla-bordeaux">
        Importer un programme Excel
      </h2>
      <ExcelImport key={programme.id} programmeId={programme.id} title={programme.title} />
      <ImportHistory programmeId={programme.id} />
      <MarkdownImport key={`md-${programme.id}`} programmeId={programme.id} />
    </section>
  );
}

function ExcelImport({ programmeId, title }: { programmeId: string; title: string }) {
  const inputId = useId();
  const categories = useQuery(programmeCategoriesQueryOptions);
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [settings, setSettings] = useState<Settings>({ mapping: {}, decisions: [] });
  const [report, setReport] = useState<ProgrammeImportReport | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ImportRowAction | ''>('');
  const action = usePedagogyAction();

  const change = (next: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...next }));
    setDirty(true);
  };

  const analyse = async (selected = file, current = settings) => {
    if (!selected) return;
    if (isOffline()) {
      setError('L’import nécessite une connexion : rien n’a été envoyé.');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await action(
      async () => {
        const result = await importProgrammeExcel(
          programmeId,
          {
            fileName: selected.name,
            fileBase64: selected.base64,
            ...current,
            decisions: current.decisions.length > 0 ? current.decisions : undefined,
          },
          false,
        );
        setReport(result);
        setSettings((s) => ({ ...s, sheet: result.source.sheet ?? undefined }));
      },
      { success: 'Analyse terminée : rien n’a été enregistré', error: 'Analyse impossible' },
    );
    if (ok) setDirty(false);
    setBusy(false);
  };

  const confirm = async () => {
    if (!file || !report) return;
    if (isOffline()) {
      setError('L’import nécessite une connexion : rien n’a été enregistré.');
      return;
    }
    setBusy(true);
    await action(
      async () => {
        setReport(
          await importProgrammeExcel(
            programmeId,
            {
              fileName: file.name,
              fileBase64: file.base64,
              ...settings,
              decisions: settings.decisions.length > 0 ? settings.decisions : undefined,
              fingerprint: report.fingerprint,
            },
            true,
          ),
        );
      },
      { success: 'Programme importé', error: 'Import refusé' },
    );
    setBusy(false);
  };

  const fieldOptions = [
    ...PROGRAMME_IMPORT_FIELDS.map((field) => ({
      value: field,
      label: PROGRAMME_IMPORT_FIELD_LABELS[field],
    })),
    ...(categories.data?.items ?? []).map((c) => ({
      value: `${CATEGORY_FIELD_PREFIX}${c.code}`,
      label: `Programme — ${c.label}`,
    })),
    { value: IGNORED_COLUMN, label: 'Ignorer cette colonne' },
  ];
  const errors = report?.issues.filter((i) => i.severity === 'ERREUR') ?? [];
  const warnings = report?.issues.filter((i) => i.severity === 'AVERTISSEMENT') ?? [];
  const blocking =
    !report ||
    report.applied ||
    dirty ||
    errors.length > 0 ||
    report.counts.ERREUR > 0 ||
    report.counts.A_DECIDER > 0;
  const writes = report ? report.counts.CREER + report.counts.METTRE_A_JOUR : 0;
  const rows = report?.rows.filter((row) => !filter || row.action === filter) ?? [];

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">
        Programme cible : <span className="font-medium text-foreground">{title}</span>. Le classeur
        est analysé sans rien enregistrer ; les séances réalisées, présences et comptes rendus ne
        sont jamais modifiés. Le fichier n’est pas conservé.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Classeur Excel (.xlsx, 2 Mo au maximum)</Label>
        <Input
          id={inputId}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            setReport(null);
            setFile(null);
            setError('');
            const fresh: Settings = { mapping: {}, decisions: [] };
            setSettings(fresh);
            if (!selected) return;
            if (!/\.xlsx$/i.test(selected.name)) {
              setError(
                'Choisissez un classeur au format .xlsx (enregistrez un .xls ou .ods en .xlsx).',
              );
              return;
            }
            if (selected.size > PROGRAMME_XLSX_MAX_BYTES) {
              setError('Fichier trop volumineux (2 Mo au maximum).');
              return;
            }
            const chosen = { name: selected.name, base64: await readAsBase64(selected) };
            setFile(chosen);
            await analyse(chosen, fresh);
          }}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && (
        <>
          <ReportSummary report={report} />

          {!report.applied && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                {report.source.sheets.length > 1 && (
                  <div className="w-56 space-y-1.5">
                    <Label htmlFor={`${inputId}-sheet`}>Feuille</Label>
                    <NativeSelect
                      id={`${inputId}-sheet`}
                      value={settings.sheet ?? ''}
                      onChange={(e) =>
                        change({
                          sheet: e.target.value,
                          headerRow: undefined,
                          mapping: {},
                          decisions: [],
                        })
                      }
                    >
                      {report.source.sheets.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} ({s.rows} lignes{s.hidden ? ', masquée' : ''})
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <div className="w-40 space-y-1.5">
                  <Label htmlFor={`${inputId}-header`}>Ligne des en-têtes</Label>
                  <Input
                    id={`${inputId}-header`}
                    type="number"
                    min={1}
                    value={settings.headerRow ?? report.source.headerLine ?? ''}
                    onChange={(e) =>
                      change({
                        headerRow: e.target.value ? Number(e.target.value) : undefined,
                        mapping: {},
                      })
                    }
                  />
                </div>
                <Button variant="outline" disabled={busy || !dirty} onClick={() => void analyse()}>
                  Relancer l’analyse
                </Button>
              </div>

              {report.columns.length > 0 && (
                <Disclosure
                  title="Colonnes reconnues"
                  summary={`${report.columns.filter((c) => c.field && c.field !== IGNORED_COLUMN).length} colonne(s) utilisée(s) sur ${report.columns.length}`}
                  defaultOpen={report.columns.some((c) => c.field === null && c.nonEmpty > 0)}
                >
                  <ul className="divide-y rounded-lg border">
                    {report.columns.map((column) => {
                      const id = `${inputId}-col-${column.key}`;
                      const value = settings.mapping[column.key] ?? column.field ?? '';
                      return (
                        <li
                          key={column.key}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <Label
                            htmlFor={id}
                            className="min-w-0 flex-1 flex-col items-start font-normal"
                          >
                            <span className="font-medium">
                              {column.key} · {column.header || 'Sans titre'}
                            </span>
                            {column.sample && (
                              <span className="line-clamp-1 text-muted-foreground">
                                Ex. : {column.sample}
                              </span>
                            )}
                          </Label>
                          <NativeSelect
                            id={id}
                            className="w-full sm:w-72"
                            aria-invalid={column.field === null && column.nonEmpty > 0}
                            value={value}
                            onChange={(e) =>
                              change({
                                mapping: { ...settings.mapping, [column.key]: e.target.value },
                              })
                            }
                          >
                            <option value="" disabled>
                              Non reconnue : choisir
                            </option>
                            {fieldOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </li>
                      );
                    })}
                  </ul>
                </Disclosure>
              )}
            </>
          )}

          {(errors.length > 0 || warnings.length > 0) && (
            <Disclosure
              title={`Anomalies : ${errors.length} erreur(s), ${warnings.length} avertissement(s)`}
              summary="Corrigez le fichier Excel puis relancez l’analyse ; les avertissements ne bloquent pas."
              defaultOpen={errors.length > 0}
            >
              <ul className="space-y-2 text-sm">
                {[...errors, ...warnings].map((issue, index) => (
                  <li key={index} className="flex gap-2">
                    {issue.severity === 'ERREUR' ? (
                      <CircleAlert
                        aria-label="Erreur"
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                      />
                    ) : (
                      <TriangleAlert
                        aria-label="Avertissement"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                    <span>
                      {(issue.line !== null || issue.column) && (
                        <span className="text-muted-foreground">
                          {[
                            report.source.sheet,
                            issue.line !== null && `ligne ${issue.line}`,
                            issue.column && `colonne ${issue.column}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                          —{' '}
                        </span>
                      )}
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          {report.rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3 className="text-sm font-semibold">Séances ({report.rows.length})</h3>
                <div className="w-56 space-y-1.5">
                  <Label htmlFor={`${inputId}-filter`}>Afficher</Label>
                  <NativeSelect
                    id={`${inputId}-filter`}
                    value={filter}
                    onChange={(e) =>
                      setFilter(IMPORT_ROW_ACTIONS.find((a) => a === e.target.value) ?? '')
                    }
                  >
                    <option value="">Toutes</option>
                    {IMPORT_ROW_ACTIONS.filter((a) => report.counts[a] > 0).map((a) => (
                      <option key={a} value={a}>
                        {IMPORT_ROW_ACTION_LABELS[a]} ({report.counts[a]})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <ul className="divide-y rounded-lg border">
                {rows.map((row) => (
                  <ImportRow
                    key={row.line}
                    row={row}
                    readOnly={report.applied}
                    decision={settings.decisions.find((d) => d.line === row.line)}
                    onDecide={(decision) =>
                      change({
                        decisions: [
                          ...settings.decisions.filter((d) => d.line !== row.line),
                          ...(decision ? [decision] : []),
                        ],
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {report.absent.length > 0 && (
            <Disclosure
              title={`${report.absent.length} séance(s) du programme absente(s) du fichier`}
              summary="Elles ne sont jamais supprimées ; annulez-les depuis leur fiche si nécessaire."
            >
              <ul className="space-y-1 text-sm">
                {report.absent.map((s) => (
                  <li key={s.id}>
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={`/administration/activites/${s.id}`}
                    >
                      {formatDate(s.plannedOn)} · {s.title}
                    </Link>{' '}
                    <span className="text-muted-foreground">
                      ({ACTIVITY_STATUS_LABELS[s.status]})
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          {!report.applied ? (
            <div className="space-y-2">
              {dirty && (
                <p role="status" className="text-sm text-muted-foreground">
                  Paramètres ou décisions modifiés : relancez l’analyse avant de confirmer.
                </p>
              )}
              {report.counts.A_DECIDER > 0 && !dirty && (
                <p role="status" className="text-sm text-muted-foreground">
                  {report.counts.A_DECIDER} rapprochement(s) à décider avant de confirmer.
                </p>
              )}
              <Button
                disabled={busy || blocking}
                className="h-auto min-h-10 whitespace-normal py-2"
                onClick={() => void confirm()}
              >
                Confirmer l’import : {report.counts.CREER} création(s),{' '}
                {report.counts.METTRE_A_JOUR} mise(s) à jour
              </Button>
              {writes === 0 && !blocking && (
                <p className="text-sm text-muted-foreground">
                  Aucune séance à créer ni à modifier : la confirmation enregistre seulement
                  l’import dans l’historique.
                </p>
              )}
            </div>
          ) : (
            <p role="status" className="text-sm font-medium">
              Import enregistré. Les séances apparaissent dans le calendrier ci-dessus.
            </p>
          )}
        </>
      )}
      {!report && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet aria-hidden className="size-4" />
          {busy ? 'Analyse du classeur…' : 'Aucun fichier sélectionné.'}
        </p>
      )}
    </div>
  );
}

function ReportSummary({ report }: { report: ProgrammeImportReport }) {
  const items: [string, number][] = [
    ['Créations', report.counts.CREER],
    ['Mises à jour', report.counts.METTRE_A_JOUR],
    ['Inchangées', report.counts.INCHANGEE],
    ['Protégées', report.counts.CONSERVEE_MANUELLE],
    ['À décider', report.counts.A_DECIDER],
    ['Ignorées', report.counts.IGNOREE],
    ['Erreurs', report.counts.ERREUR],
  ];
  return (
    <div className="space-y-2">
      <p role="status" className="text-sm">
        {report.applied ? 'Bilan de l’import' : 'Prévisualisation (rien n’est enregistré)'} ·{' '}
        <span className="font-medium">{report.source.fileName}</span>
        {report.source.sheet && ` · feuille « ${report.source.sheet} »`}
        {report.source.headerLine && ` · en-têtes ligne ${report.source.headerLine}`} ·{' '}
        {report.source.dataRows} séance(s) lue(s)
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type ReportRow = ProgrammeImportReport['rows'][number];

function ImportRow({
  row,
  readOnly,
  decision,
  onDecide,
}: {
  row: ReportRow;
  readOnly: boolean;
  decision: ImportDecision | undefined;
  onDecide: (decision: ImportDecision | null) => void;
}) {
  const name = useId();
  const decidable = !readOnly && (row.candidates.length > 0 || row.action === 'IGNOREE');
  const choice =
    decision?.action === 'METTRE_A_JOUR' ? decision.activityId : (decision?.action ?? '');
  return (
    <li className="px-3 py-2 text-sm">
      <details>
        <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
          <span className="text-muted-foreground tabular-nums">Ligne {row.line}</span>
          {row.date && <span className="tabular-nums">{formatDate(row.date)}</span>}
          <span className="order-last min-w-0 basis-full font-medium sm:order-none sm:basis-0 sm:flex-1">
            {row.title ?? 'Sans intitulé'}
          </span>
          <Badge variant={ROW_VARIANTS[row.action]}>{IMPORT_ROW_ACTION_LABELS[row.action]}</Badge>
        </summary>
        <div className="mt-2 space-y-3 border-l-2 border-tesla-sable pl-3">
          {row.messages.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {row.messages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
          {row.planned && (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
              {(
                [
                  ['Axe du mois', row.planned.theme],
                  ['Format', row.planned.format],
                  ['Responsable prévu', row.planned.leaderLabel],
                  ['Statut (fichier)', row.planned.sourceStatus],
                  ['Effectif (fichier)', row.planned.sourceAttendance?.toString() ?? null],
                  ['Observations', row.planned.planningNotes],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line">{value ?? '—'}</dd>
                </div>
              ))}
              {row.planned.categories.map((c) => (
                <div key={c.code} className="contents">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="whitespace-pre-line">{c.content ?? '—'}</dd>
                </div>
              ))}
            </dl>
          )}
          {row.changes.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium">
                {row.action === 'CONSERVEE_MANUELLE'
                  ? 'Différences non appliquées'
                  : 'Modifications proposées'}
              </p>
              <ul className="space-y-1">
                {row.changes.map((change) => (
                  <li key={change.field}>
                    <span className="text-muted-foreground">{change.label} : </span>
                    <span className="line-through decoration-muted-foreground/60">
                      {change.from ?? '—'}
                    </span>
                    {' → '}
                    <span>{change.to ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decidable && (
            <fieldset className="space-y-1.5">
              <legend className="font-medium">Décision</legend>
              {row.candidates.map((c) => (
                <label key={c.id} className="flex min-h-8 items-center gap-2">
                  <input
                    type="radio"
                    name={name}
                    className="size-4 accent-tesla-rouge"
                    checked={choice === c.id}
                    onChange={() =>
                      onDecide({ line: row.line, action: 'METTRE_A_JOUR', activityId: c.id })
                    }
                  />
                  Mettre à jour « {c.title} » ({formatDate(c.plannedOn)},{' '}
                  {ACTIVITY_STATUS_LABELS[c.status].toLowerCase()})
                </label>
              ))}
              {row.candidates.length > 0 && (
                <label className="flex min-h-8 items-center gap-2">
                  <input
                    type="radio"
                    name={name}
                    className="size-4 accent-tesla-rouge"
                    checked={choice === 'CREER'}
                    onChange={() => onDecide({ line: row.line, action: 'CREER' })}
                  />
                  Créer une nouvelle séance
                </label>
              )}
              <label className="flex min-h-8 items-center gap-2">
                <input
                  type="radio"
                  name={name}
                  className="size-4 accent-tesla-rouge"
                  checked={choice === 'IGNORER'}
                  onChange={() => onDecide({ line: row.line, action: 'IGNORER' })}
                />
                Ignorer cette ligne
              </label>
              {decision && (
                <Button variant="ghost" size="sm" onClick={() => onDecide(null)}>
                  Annuler la décision
                </Button>
              )}
            </fieldset>
          )}
          {!readOnly && !decidable && row.action !== 'ERREUR' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDecide({ line: row.line, action: 'IGNORER' })}
            >
              Ne pas importer cette ligne
            </Button>
          )}
        </div>
      </details>
    </li>
  );
}

function ImportHistory({ programmeId }: { programmeId: string }) {
  const history = useQuery(programmeImportsQueryOptions(programmeId));
  if (!history.data || history.data.items.length === 0) return null;
  return (
    <Disclosure
      title="Historique des imports"
      summary={`${history.data.items.length} import(s) confirmé(s)`}
    >
      <ul className="divide-y text-sm">
        {history.data.items.map((item) => (
          <li key={item.id} className="py-2">
            <p>
              <span className="font-medium">{formatDateTime(item.createdAt)}</span> ·{' '}
              {fullName(item.actor)} · {item.format === 'XLSX' ? 'Excel' : 'Markdown'}
              {item.fileName && ` · ${item.fileName}`}
              {item.sheet && ` (${item.sheet})`}
            </p>
            <p className="text-muted-foreground">
              {item.counts.CREER ?? 0} création(s), {item.counts.METTRE_A_JOUR ?? 0} mise(s) à jour,{' '}
              {item.counts.INCHANGEE ?? 0} inchangée(s), {item.counts.CONSERVEE_MANUELLE ?? 0}{' '}
              protégée(s), {item.counts.IGNOREE ?? 0} ignorée(s)
              {item.fileSha256 && (
                <span title={item.fileSha256}> · empreinte {item.fileSha256.slice(0, 12)}…</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** Import Markdown historique, conservé en option secondaire. */
function MarkdownImport({ programmeId }: { programmeId: string }) {
  const [content, setContent] = useState('');
  const [report, setReport] = useState<ProgrammeImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const action = usePedagogyAction();
  const run = async (apply: boolean) => {
    setBusy(true);
    if (!apply) setReport(null);
    await action(
      async () => {
        setReport(
          await importProgramme(
            programmeId,
            content,
            apply,
            apply && report ? { fingerprint: report.fingerprint } : {},
          ),
        );
      },
      apply
        ? { success: 'Programme importé', error: 'Import impossible' }
        : { success: 'Prévisualisation disponible', error: 'Analyse impossible' },
    );
    setBusy(false);
  };
  return (
    <Disclosure
      title="Importer un tableau Markdown (option secondaire)"
      summary="Ancien format texte, prévisualisé avant tout enregistrement."
    >
      <p className="text-sm text-muted-foreground">
        Colonnes Date et Activité ; facultatives : Catégories, Thème, Objectifs (séparés par ;),
        Modules (codes), Responsable, Lieu. Dates : AAAA-MM-JJ ou JJ/MM/AAAA.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="programme-source">Tableau source</Label>
        <Textarea
          id="programme-source"
          rows={8}
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
          <ReportSummary report={report} />
          <ul className="divide-y rounded-lg border">
            {report.rows.map((row) => (
              <li key={row.line} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">Ligne {row.line}</span>
                  <span className="font-medium">{row.title}</span>
                  <span className="text-muted-foreground">{row.date}</span>
                  <Badge variant={ROW_VARIANTS[row.action]}>
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
              busy ||
              report.applied ||
              report.counts.ERREUR > 0 ||
              report.counts.A_DECIDER > 0 ||
              report.rows.length === 0
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
