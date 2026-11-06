'use client';

import { useQuery } from '@tanstack/react-query';
import {
  civilDateAt,
  STAGE_OVERRIDE_STATUS_LABELS,
  type StageOverride,
  type StageOverridePreview,
  type StageSupervision,
  THEORETICAL_STAGE_REASON_LABELS,
} from '@tesla/shared';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField, fieldA11y } from '@/components/form-field';
import { formatCivilDate } from '@/components/pathway/pathway-summary';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  createStageOverride,
  liftStageOverride,
  previewStageOverride,
  stageSupervisionQueryOptions,
} from '@/lib/api/pathway';

// Supervision de la progression (D176) : réservée au responsable plein en fonction ; l'API refuse
// tout autre profil. La progression par l'âge reste la règle ; la correction exceptionnelle est une
// procédure de secours, temporaire, motivée et historisée.

const MIN_REASON = 10;

const reasonError = (value: string) =>
  value.trim().length > 0 && value.trim().length < MIN_REASON
    ? `${MIN_REASON} caractères au minimum.`
    : undefined;

function OverrideDialog({ scoutId, data }: { scoutId: string; data: StageSupervision }) {
  const action = usePedagogyAction();
  const today = civilDateAt(new Date());
  const [stageCode, setStageCode] = useState(data.allowedStages[0]?.code ?? '');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<StageOverridePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const error = reasonError(reason);
  const input = { stageCode, startsOn, endsOn, reason };
  const reset = () => setPreview(null);

  const runPreview = async () => {
    setPreviewError(null);
    try {
      setPreview(await previewStageOverride(scoutId, input));
    } catch (failure) {
      setPreview(null);
      setPreviewError(failure instanceof Error ? failure.message : 'Aperçu impossible.');
    }
  };

  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          Correction exceptionnelle de l’étape
        </Button>
      }
      title="Correction exceptionnelle de l’étape"
      confirmLabel="Appliquer l’exception"
      description={
        <>
          <p>
            Étape normale : <strong>{data.computedStage?.name ?? 'non déterminée'}</strong>.
            Procédure de secours temporaire ; l’étape normale reprend à la date de fin. Dernier jour
            possible : {data.branchExitOn ? formatCivilDate(lastDay(data.branchExitOn)) : '—'}.
          </p>
          <FormField id="override-stage" label="Étape exceptionnelle" required>
            <NativeSelect
              id="override-stage"
              value={stageCode}
              onChange={(event) => {
                setStageCode(event.target.value);
                reset();
              }}
            >
              {data.allowedStages.map((stage) => (
                <option key={stage.id} value={stage.code}>
                  {stage.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="override-start" label="Du" required>
              <Input
                id="override-start"
                type="date"
                min={today}
                value={startsOn}
                onChange={(event) => {
                  setStartsOn(event.target.value);
                  reset();
                }}
              />
            </FormField>
            <FormField id="override-end" label="Au (inclus)" required>
              <Input
                id="override-end"
                type="date"
                min={startsOn || today}
                max={data.branchExitOn ? lastDay(data.branchExitOn) : undefined}
                value={endsOn}
                onChange={(event) => {
                  setEndsOn(event.target.value);
                  reset();
                }}
              />
            </FormField>
          </div>
          <FormField id="override-reason" label="Motif" required error={error}>
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                reset();
              }}
              {...fieldA11y('override-reason', error)}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!stageCode || !startsOn || !endsOn || reason.trim().length < MIN_REASON}
            onClick={() => void runPreview()}
          >
            Prévisualiser
          </Button>
          {previewError && (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          )}
          {preview && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm" aria-live="polite">
              <li>
                {preview.requestedStage.name} du {formatCivilDate(preview.startsOn)} au{' '}
                {formatCivilDate(preview.endsOn)} ({preview.days} jour{preview.days > 1 ? 's' : ''}
                ), puis retour à l’étape normale.
              </li>
              <li>
                Modules de l’étape appliquée : {preview.requestedStageModules} ; de l’étape normale
                : {preview.computedStageModules}.
              </li>
              <li>Rattrapages ouverts conservés : {preview.openCatchUps}.</li>
              <li>Âge, date d’entrée, acquis, cérémonies et sortie de la branche : inchangés.</li>
              {preview.conflict && (
                <li className="text-destructive">Une exception couvre déjà cette période.</li>
              )}
            </ul>
          )}
        </>
      }
      onConfirm={async () => {
        if (!preview || preview.conflict) {
          setPreviewError('Prévisualisez d’abord les conséquences.');
          return false;
        }
        return action(() => createStageOverride(scoutId, { ...input, confirm: true }), {
          success: 'Exception appliquée.',
          error: 'Exception non appliquée.',
        });
      }}
    />
  );
}

function LiftDialog({ override }: { override: StageOverride }) {
  const action = usePedagogyAction();
  const [reason, setReason] = useState('');
  const error = reasonError(reason);
  const id = `lift-${override.id}`;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          Lever
        </Button>
      }
      title="Lever l’exception"
      confirmLabel="Lever l’exception"
      destructive
      description={
        <>
          <p>L’étape normale s’applique immédiatement. L’exception reste dans l’historique.</p>
          <FormField id={`${id}-reason`} label="Motif de la levée" required error={error}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              {...fieldA11y(`${id}-reason`, error)}
            />
          </FormField>
        </>
      }
      onConfirm={() =>
        action(() => liftStageOverride(override.id, { reason, confirm: true }), {
          success: 'Exception levée.',
          error: 'Exception non levée.',
        })
      }
    />
  );
}

const lastDay = (exitOn: string) => {
  const date = new Date(`${exitOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

/** Règles appliquées, étape normale et appliquée, exceptions : responsable plein seulement. */
export function StageSupervisionSection({ scoutId }: { scoutId: string }) {
  const query = useQuery(stageSupervisionQueryOptions(scoutId));
  const data = query.data;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Supervision de la progression</CardTitle>
        {data?.canOverride && <OverrideDialog scoutId={scoutId} data={data} />}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {query.isPending && <TableSkeleton rows={3} />}
        {query.error && <QueryError error={query.error} onRetry={() => void query.refetch()} />}
        {data && (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Étape normale</dt>
                <dd>
                  {data.computedStage?.name ?? 'Non déterminée'}
                  <span className="block text-xs text-muted-foreground">
                    {THEORETICAL_STAGE_REASON_LABELS[data.computedReason]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Étape appliquée</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {data.effectiveStage?.name ?? 'Non déterminée'}
                  {data.activeOverride && (
                    <Badge variant="accent">
                      <ShieldAlert aria-hidden /> Exception jusqu’au{' '}
                      {formatCivilDate(data.activeOverride.endsOn)}
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Référentiel</dt>
                <dd>
                  {data.ruleSetVersion ?? 'Aucun'}
                  <span className="block text-xs text-muted-foreground">
                    Délai de rattrapage :{' '}
                    {data.catchUpDelayDays !== null
                      ? `${data.catchUpDelayDays} jours par étape`
                      : data.catchUpDelayMonths !== null
                        ? `${data.catchUpDelayMonths} mois`
                        : 'non validé'}
                  </span>
                </dd>
              </div>
            </dl>

            {data.periods.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <caption className="sr-only">Périodes selon l’âge</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Étape</th>
                      <th className="py-1 pr-3 font-medium">Du</th>
                      <th className="py-1 font-medium">Au</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.periods.map((period) => (
                      <tr key={period.stage.id} className="border-t">
                        <td className="py-1 pr-3">{period.stage.name}</td>
                        <td className="py-1 pr-3">{formatCivilDate(period.startsOn)}</td>
                        <td className="py-1">
                          {period.endsOn ? formatCivilDate(lastDay(period.endsOn)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.branchExitOn && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sortie de la branche le {formatCivilDate(data.branchExitOn)} à 00 h 00 (heure
                    d’Abidjan), sans prolongation possible.
                  </p>
                )}
              </div>
            )}

            {data.overrides.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Exceptions</h3>
                <ul className="space-y-2">
                  {data.overrides.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {row.stage.name} · {formatCivilDate(row.startsOn)} →{' '}
                          {formatCivilDate(row.endsOn)}
                          <Badge variant={row.status === 'ACTIVE' ? 'accent' : 'outline'}>
                            {STAGE_OVERRIDE_STATUS_LABELS[row.status]}
                          </Badge>
                        </p>
                        <p className="break-words">{row.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          Étape normale à la demande : {row.computedStageAtRequest?.name ?? '—'}
                          {row.createdBy &&
                            ` · ${row.createdBy.firstName} ${row.createdBy.lastName}`}
                        </p>
                        {row.liftReason && (
                          <p className="text-xs text-muted-foreground">
                            Levée : {row.liftReason}
                            {row.liftedBy &&
                              ` — ${row.liftedBy.firstName} ${row.liftedBy.lastName}`}
                          </p>
                        )}
                      </div>
                      {(row.status === 'ACTIVE' || row.status === 'PROGRAMMEE') && (
                        <LiftDialog override={row} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
