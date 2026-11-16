'use client';

import { civilDateAt, type PriorStageRecognition, type ScoutPathway } from '@tesla/shared';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField, fieldA11y } from '@/components/form-field';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { recognizePriorStage, revokePriorStage } from '@/lib/api/pathway';
import { formatDate } from '@/lib/format';
import { formatCivilDate } from './pathway-summary';

// Parcours antérieur reconnu (D181) : l'encadrement consulte ; seul le responsable plein reconnaît
// ou révoque (l'API le vérifie ; les boutons ne sont affichés qu'avec la permission).

const MIN_REASON = 5;

function RecognizeDialog({ scoutId, pathway }: { scoutId: string; pathway: ScoutPathway }) {
  const action = usePedagogyAction();
  const today = civilDateAt(new Date());
  const current = pathway.timeline.find((step) => step.status === 'EN_COURS');
  // Étapes antérieures à l'étape actuelle, pas encore reconnues.
  const candidates = pathway.timeline.filter(
    (step) => current && step.stage.position < current.stage.position && step.status !== 'RECONNUE',
  );
  const [stageId, setStageId] = useState(candidates[0]?.stage.id ?? '');
  const [completedOn, setCompletedOn] = useState('');
  const [note, setNote] = useState('');
  if (!current || candidates.length === 0) return null;
  return (
    <ConfirmDialog
      trigger={<Button size="sm">Reconnaître une étape antérieure</Button>}
      title="Reconnaître une étape antérieure"
      confirmLabel="Reconnaître l’étape"
      description={
        <>
          <p>
            Étape accomplie avant l’arrivée sur la plateforme. Ses rattrapages ne seront plus exigés
            ; aucun module n’est déclaré acquis et l’étape actuelle ({current.stage.name}) ne change
            pas.
          </p>
          <FormField id="prior-stage" label="Étape" required>
            <NativeSelect
              id="prior-stage"
              value={stageId}
              onChange={(event) => setStageId(event.target.value)}
            >
              {candidates.map((step) => (
                <option key={step.stage.id} value={step.stage.id}>
                  {step.stage.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="prior-completed"
            label="Date de fin de l’étape"
            hint="Facultative : laissez vide si elle est inconnue."
          >
            <Input
              type="date"
              max={today}
              value={completedOn}
              onChange={(event) => setCompletedOn(event.target.value)}
              {...fieldA11y('prior-completed', undefined, 'hint')}
            />
          </FormField>
          <FormField id="prior-note" label="Observation" hint="Facultative (justificatif, lieu…).">
            <Textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              {...fieldA11y('prior-note', undefined, 'hint')}
            />
          </FormField>
        </>
      }
      onConfirm={() =>
        action(
          () =>
            recognizePriorStage(scoutId, {
              stageId,
              ...(completedOn && { completedOn }),
              ...(note.trim() && { note: note.trim() }),
            }),
          { success: 'Le parcours antérieur a été reconnu.', error: 'Étape non reconnue.' },
        )
      }
    />
  );
}

function RevokeDialog({ recognition }: { recognition: PriorStageRecognition }) {
  const action = usePedagogyAction();
  const [reason, setReason] = useState('');
  const id = `revoke-${recognition.id}`;
  const error =
    reason.trim().length > 0 && reason.trim().length < MIN_REASON
      ? `${MIN_REASON} caractères au minimum.`
      : undefined;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          Corriger
        </Button>
      }
      title={`Révoquer la reconnaissance : ${recognition.stage.name}`}
      confirmLabel="Révoquer"
      destructive
      description={
        <>
          <p>
            À utiliser pour une reconnaissance enregistrée par erreur. Elle reste dans l’historique
            avec votre motif ; les rattrapages de cette étape redeviennent exigibles.
          </p>
          <FormField id={`${id}-reason`} label="Motif" required error={error}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              {...fieldA11y(`${id}-reason`, error)}
            />
          </FormField>
        </>
      }
      onConfirm={() =>
        action(() => revokePriorStage(recognition.id, { reason, confirm: true }), {
          success: 'Reconnaissance révoquée.',
          error: 'Révocation impossible.',
        })
      }
    />
  );
}

/** Parcours antérieur d'un routier, vu par l'encadrement (révocations comprises). */
export function PriorStagesPanel({
  scoutId,
  pathway,
  canDecide,
}: {
  scoutId: string;
  pathway: ScoutPathway;
  canDecide: boolean;
}) {
  const items = pathway.priorStages;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Parcours antérieur</h3>
        {canDecide && <RecognizeDialog scoutId={scoutId} pathway={pathway} />}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune étape reconnue avant l’arrivée.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-2"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">
                  {item.stage.name}{' '}
                  <Badge variant="outline">{item.revokedAt ? 'Révoquée' : 'Reconnue'}</Badge>
                </p>
                <p className="text-muted-foreground">
                  {item.completedOn
                    ? `Terminée le ${formatCivilDate(item.completedOn)}`
                    : 'Date de fin inconnue'}{' '}
                  · enregistrée le {formatDate(item.recordedAt)}
                  {item.recordedBy &&
                    ` par ${item.recordedBy.firstName} ${item.recordedBy.lastName}`}
                </p>
                {item.note && <p className="break-words">{item.note}</p>}
                {item.revokedAt && (
                  <p className="text-muted-foreground">
                    Révoquée le {formatDate(item.revokedAt)}
                    {item.revokedBy &&
                      ` par ${item.revokedBy.firstName} ${item.revokedBy.lastName}`}
                    {item.revokeReason && ` : ${item.revokeReason}`}
                  </p>
                )}
              </div>
              {canDecide && !item.revokedAt && <RevokeDialog recognition={item} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
