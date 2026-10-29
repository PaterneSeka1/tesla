'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  COMPETENCY_STATUS_LABELS,
  type ScoutProgression,
  STAGE_CHANGE_KIND_LABELS,
  type StageChange,
} from '@tesla/shared';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { changeStage } from '@/lib/api/progression';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { formatDate, formatDateTime, fullName, todayIsoDate } from '@/lib/format';

/** Ancienneté dans l'étape, en jours calendaires (information, aucune règle de durée appliquée). */
function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000);
}

const formSchema = z.object({
  toStageId: z.string().min(1, { error: 'Choisissez la nouvelle étape.' }),
  effectiveOn: z.iso.date({ error: 'Date invalide.' }),
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Motif obligatoire (3 caractères au minimum).' })
    .max(2000, { error: '2 000 caractères au maximum.' }),
  observations: z.string().max(3000),
  evidence: z.string().max(3000),
  ceremonyReference: z.string().max(200),
});

type FormValues = z.infer<typeof formSchema>;

function StageHistory({ changes }: { changes: StageChange[] }) {
  if (changes.length === 0) {
    return <EmptyState icon={Flag} title="Aucune étape enregistrée" />;
  }
  return (
    <ol className="space-y-2 text-sm">
      {changes.map((change) => (
        <li key={change.id} className="space-y-1 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {change.from?.name ?? 'Aucune'} → <strong>{change.to?.name ?? 'Aucune'}</strong>
            </span>
            <Badge variant={change.kind === 'CORRECTION' ? 'accent' : 'outline'}>
              {STAGE_CHANGE_KIND_LABELS[change.kind]}
            </Badge>
            {change.correctedByChangeId && <Badge variant="secondary">Corrigée ensuite</Badge>}
          </div>
          <p>{change.reason}</p>
          {change.evidence && (
            <p className="text-muted-foreground">Éléments examinés : {change.evidence}</p>
          )}
          {change.observations && (
            <p className="text-muted-foreground">Observations : {change.observations}</p>
          )}
          {change.ceremonyReference && (
            <p className="text-muted-foreground">Cérémonie : {change.ceremonyReference}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Effet le {formatDate(change.effectiveOn)} · décidé le {formatDateTime(change.decidedAt)}
            {change.decidedBy && ` par ${fullName(change.decidedBy)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Décision de changement d'étape (responsable) : le dossier complet est rappelé et une
 * confirmation explicite est demandée avant l'enregistrement. Aucun seuil n'est appliqué.
 */
function ChangeStageForm({ progression }: { progression: ScoutProgression }) {
  const run = usePedagogyAction();
  const stages = useQuery(stagesQueryOptions);
  const [pending, setPending] = useState<FormValues | null>(null);
  const [correction, setCorrection] = useState(false);
  const latest = progression.stageChanges[0];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toStageId: '',
      effectiveOn: todayIsoDate(),
      reason: '',
      observations: '',
      evidence: '',
      ceremonyReference: '',
    },
  });
  const { scout } = progression;
  const target = stages.data?.items.find((stage) => stage.id === pending?.toStageId);
  const acquired = progression.competencies.filter((item) => item.status === 'ACQUIS');
  const remaining = progression.competencies.filter(
    (item) => item.status !== 'ACQUIS' && item.competency.stage?.id === scout.stage?.id,
  );

  const confirm = async () => {
    if (!pending) return;
    const ok = await run(
      () =>
        changeStage(scout.id, {
          expectedCurrentStageId: scout.stage?.id ?? null,
          toStageId: pending.toStageId,
          effectiveOn: pending.effectiveOn,
          reason: pending.reason,
          observations: pending.observations,
          evidence: pending.evidence,
          ceremonyReference: pending.ceremonyReference,
          ...(correction && latest && { correctsChangeId: latest.id }),
          confirm: true,
        }),
      { success: 'Décision enregistrée', error: 'Décision non enregistrée' },
    );
    if (ok) {
      setPending(null);
      setCorrection(false);
      reset();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Décision de changement d’étape</CardTitle>
        <CardDescription>
          Acte officiel du responsable, jamais automatique, fondé sur le dossier ci-dessous.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!scout.isActive ? (
          <p className="text-sm text-muted-foreground">
            Ce profil est désactivé : réactivez-le avant toute décision.
          </p>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => void handleSubmit((values) => setPending(values))(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="stage-target"
                label="Nouvelle étape"
                required
                error={errors.toStageId?.message}
              >
                <NativeSelect
                  {...fieldA11y('stage-target', errors.toStageId?.message)}
                  {...register('toStageId')}
                >
                  <option value="">Choisir…</option>
                  {stages.data?.items.map((stage) => (
                    <option
                      key={stage.id}
                      value={stage.id}
                      disabled={stage.id === scout.stage?.id && !correction}
                    >
                      {stage.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                id="stage-date"
                label="Date d’effet"
                required
                error={errors.effectiveOn?.message}
              >
                <Input
                  {...fieldA11y('stage-date', errors.effectiveOn?.message)}
                  type="date"
                  max={todayIsoDate()}
                  {...register('effectiveOn')}
                />
              </FormField>
            </div>
            <FormField
              id="stage-reason"
              label="Motif de la décision"
              required
              error={errors.reason?.message}
            >
              <Textarea
                {...fieldA11y('stage-reason', errors.reason?.message)}
                rows={3}
                {...register('reason')}
              />
            </FormField>
            <FormField
              id="stage-evidence"
              label="Éléments justificatifs examinés"
              error={errors.evidence?.message}
            >
              <Textarea
                {...fieldA11y('stage-evidence', errors.evidence?.message)}
                rows={2}
                {...register('evidence')}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="stage-observations"
                label="Observations"
                error={errors.observations?.message}
              >
                <Textarea
                  {...fieldA11y('stage-observations', errors.observations?.message)}
                  rows={2}
                  {...register('observations')}
                />
              </FormField>
              <FormField
                id="stage-ceremony"
                label="Référence de cérémonie"
                hint="Facultatif (ex. date ou lieu de la cérémonie)."
                error={errors.ceremonyReference?.message}
              >
                <Input
                  {...fieldA11y('stage-ceremony', errors.ceremonyReference?.message, 'hint')}
                  {...register('ceremonyReference')}
                />
              </FormField>
            </div>
            {latest && latest.kind !== 'REPRISE' && !latest.correctedByChangeId && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={correction}
                  onChange={(event) => setCorrection(event.target.checked)}
                />
                <span>
                  Corriger la dernière décision ({latest.from?.name ?? 'aucune'} →{' '}
                  {latest.to?.name ?? 'aucune'}, effet le {formatDate(latest.effectiveOn)}) : elle
                  reste visible dans l’historique, avec cette correction.
                </span>
              </label>
            )}
            <Button type="submit">Vérifier et confirmer…</Button>
          </form>
        )}
      </CardContent>
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {correction ? 'Confirmer la correction' : 'Confirmer le changement d’étape'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Routier</dt>
                  <dd>{fullName(scout)}</dd>
                  <dt className="text-muted-foreground">Matricule</dt>
                  <dd className="font-mono">{scout.matricule ?? 'Non renseigné'}</dd>
                  <dt className="text-muted-foreground">Équipe</dt>
                  <dd>{scout.team?.name ?? 'Sans équipe'}</dd>
                  <dt className="text-muted-foreground">Étape actuelle</dt>
                  <dd>
                    {scout.stage?.name ?? 'Non renseignée'}
                    {scout.stageSince &&
                      ` depuis le ${formatDate(scout.stageSince)} (${daysSince(scout.stageSince)} jours)`}
                  </dd>
                  <dt className="text-muted-foreground">Nouvelle étape</dt>
                  <dd className="font-semibold">{target?.name}</dd>
                  <dt className="text-muted-foreground">Date d’effet</dt>
                  <dd>{pending && formatDate(pending.effectiveOn)}</dd>
                </dl>
                <p>
                  <strong>{acquired.length}</strong> compétence(s) officiellement validée(s) ;{' '}
                  <strong>{remaining.length}</strong> compétence(s) de l’étape actuelle restant à
                  travailler
                  {remaining.length > 0 &&
                    ` (${remaining.map((item) => `${item.competency.code} : ${COMPETENCY_STATUS_LABELS[item.status]}`).join(', ')})`}
                  .
                </p>
                <p>
                  {progression.attempts.filter((attempt) => attempt.status === 'VALIDEE').length}{' '}
                  résultat(s) d’évaluation accepté(s) · {progression.attendance.present} présence(s)
                  enregistrée(s) ·{' '}
                  {progression.moduleStudies.filter((study) => !study.cancelledAt).length} module(s)
                  étudié(s).
                </p>
                <p className="text-muted-foreground">
                  La décision est définitive et journalisée ; une erreur se corrige par une nouvelle
                  décision motivée.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={() => void confirm()}>Confirmer la décision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function StageSection({ progression }: { progression: ScoutProgression }) {
  const { scout } = progression;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Étape actuelle</CardTitle>
          <CardDescription>
            {scout.stage
              ? `${scout.stage.name}${scout.stageSince ? ` depuis le ${formatDate(scout.stageSince)} (${daysSince(scout.stageSince)} jours)` : ''}`
              : 'Étape non renseignée'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StageHistory changes={progression.stageChanges} />
        </CardContent>
      </Card>
      {progression.canDecide && <ChangeStageForm progression={progression} />}
    </>
  );
}
