'use client';

import {
  CATCH_UP_DECISIONS,
  CATCH_UP_STATUS_LABELS,
  type CatchUpDecision,
  type CatchUpObligation,
  type CatchUpStatus,
} from '@tesla/shared';
import { CheckCircle2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { decideCatchUp } from '@/lib/api/pathway';
import { formatCivilDate } from './pathway-summary';

const STATUS_VARIANT: Record<
  CatchUpStatus,
  'outline' | 'accent' | 'success' | 'destructive' | 'secondary'
> = {
  A_FAIRE: 'outline',
  EN_COURS: 'secondary',
  EN_ATTENTE_VALIDATION: 'accent',
  ACQUIS: 'success',
  EN_RETARD: 'destructive',
  NON_APPLICABLE: 'secondary',
};

const DECISION_LABELS: Record<CatchUpDecision, string> = {
  ACQUIS: 'Reconnaître le module comme acquis',
  NON_APPLICABLE: 'Déclarer l’obligation non applicable',
};

function DecisionDialog({ obligation }: { obligation: CatchUpObligation }) {
  const action = usePedagogyAction();
  const [decision, setDecision] = useState<CatchUpDecision>('ACQUIS');
  const [reason, setReason] = useState('');
  const error =
    reason.trim().length > 0 && reason.trim().length < 3 ? '3 caractères au minimum.' : undefined;
  const id = `decision-${obligation.id}`;
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          Statuer
        </Button>
      }
      title={`Rattrapage : ${obligation.module.title}`}
      confirmLabel="Enregistrer la décision"
      description={
        <>
          <p>Décision officielle, motivée et définitive (journalisée).</p>
          <FormField id={`${id}-kind`} label="Décision" required>
            <NativeSelect
              id={`${id}-kind`}
              value={decision}
              onChange={(event) => setDecision(event.target.value as CatchUpDecision)}
            >
              {CATCH_UP_DECISIONS.map((value) => (
                <option key={value} value={value}>
                  {DECISION_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
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
        action(() => decideCatchUp(obligation.id, { decision, reason, confirm: true }), {
          success: 'Décision enregistrée.',
          error: 'Décision non enregistrée.',
        })
      }
    />
  );
}

/**
 * Obligations de rattrapage : modules obligatoires d'étapes antérieures non encore reconnus acquis.
 * Une lecture ou un résultat ne suffit jamais : seule une décision humaine clôt l'obligation.
 */
export function CatchUpList({
  obligations,
  deadlineUndetermined,
  canDecide = false,
  audience,
}: {
  obligations: readonly CatchUpObligation[];
  deadlineUndetermined: boolean;
  canDecide?: boolean;
  audience: 'routier' | 'encadrement';
}) {
  if (obligations.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Aucun rattrapage"
        description={
          audience === 'routier'
            ? 'Aucun module obligatoire d’une étape antérieure ne reste à acquérir.'
            : 'Aucun module obligatoire d’une étape antérieure ne reste à acquérir pour ce routier.'
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {deadlineUndetermined && (
        <p className="text-sm text-muted-foreground">
          Aucune durée officielle de rattrapage n’est encore validée : les échéances restent non
          déterminées (arbitrage du responsable nécessaire).
        </p>
      )}
      <ul className="stagger space-y-2">
        {obligations.map((obligation) => (
          <li
            key={obligation.id}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Undo2 className="size-4 text-tesla-bordeaux" aria-hidden />
                <span className="truncate">
                  {obligation.module.code} · {obligation.module.title}
                </span>
                <Badge variant={STATUS_VARIANT[obligation.status]}>
                  {CATCH_UP_STATUS_LABELS[obligation.status]}
                </Badge>
                {!obligation.stillRequired && obligation.decision === null && (
                  <Badge variant="outline">N’est plus obligatoire</Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Étape d’origine : {obligation.originStage.name} · Échéance :{' '}
                {obligation.dueOn ? formatCivilDate(obligation.dueOn) : 'non déterminée'} ·{' '}
                {obligation.studies} étude(s), {obligation.attempts} tentative(s)
                {obligation.acceptedAttempts > 0 &&
                  `, ${obligation.acceptedAttempts} résultat(s) accepté(s)`}
              </p>
              {obligation.decisionReason && (
                <p className="text-sm">
                  Décision : {obligation.decisionReason}
                  {obligation.decidedBy &&
                    ` — ${obligation.decidedBy.firstName} ${obligation.decidedBy.lastName}`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {audience === 'routier' && obligation.decision === null && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/modules">Étudier</Link>
                </Button>
              )}
              {canDecide && obligation.decision === null && (
                <DecisionDialog obligation={obligation} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
