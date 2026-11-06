'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type AgeRuleSet } from '@tesla/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { activateAgeRuleSet, ageRuleSetsQueryOptions } from '@/lib/api/pathway';
import { userCan } from '@/lib/navigation';
import { AgeRuleSetForm } from './age-rule-set-form';
import { formatCivilDate } from './pathway-summary';

const point = (p: { years: number; months: number }) =>
  `${p.years} ans${p.months ? ` et ${p.months} mois` : ''}`;

const undetermined = <span className="text-muted-foreground">Non arbitré</span>;

/**
 * Mise en vigueur (décision du plein) : date choisie explicitement, confirmation ; le référentiel
 * devient immuable et l'étape de chaque routier est recalculée à partir de cette date.
 */
function ActivateDialog({ ruleSet }: { ruleSet: AgeRuleSet }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  return (
    <ConfirmDialog
      trigger={<Button size="sm">Mettre en vigueur</Button>}
      title={`Mettre en vigueur la version ${ruleSet.version} ?`}
      description={
        <>
          <p>
            Elle devient définitive : plus aucune modification possible. L’étape de chaque routier
            sera recalculée à partir de la date choisie.
          </p>
          <div className="space-y-1.5 text-foreground">
            <Label htmlFor={`effective-${ruleSet.id}`}>Date d’entrée en vigueur</Label>
            <Input
              id={`effective-${ruleSet.id}`}
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `effective-${ruleSet.id}-error` : undefined}
            />
          </div>
          <label className="flex items-start gap-2 text-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Je confirme les périodes et leurs sources.
          </label>
          {error && (
            <p id={`effective-${ruleSet.id}-error`} role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </>
      }
      confirmLabel="Mettre en vigueur"
      onConfirm={async () => {
        if (!effectiveFrom) {
          setError('Choisissez la date d’entrée en vigueur.');
          return false;
        }
        if (!confirmed) {
          setError('Cochez la confirmation.');
          return false;
        }
        try {
          await activateAgeRuleSet(ruleSet.id, { effectiveFrom, confirm: true });
          // Étapes, éligibilités et statistiques dépendent du référentiel : tout est relu.
          await queryClient.invalidateQueries();
          toast.success(`Version ${ruleSet.version} en vigueur`);
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Mise en vigueur impossible.');
          return false;
        }
      }}
    />
  );
}

function RuleSetCard({
  ruleSet,
  current,
  canManage,
}: {
  ruleSet: AgeRuleSet;
  current: boolean;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Version {ruleSet.version}
          {current && <Badge variant="success">Applicable aujourd’hui</Badge>}
          <Badge variant="outline">
            {ruleSet.status === 'EN_VIGUEUR' ? 'En vigueur (figé)' : 'Brouillon'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {ruleSet.effectiveFrom ? `Depuis le ${formatCivilDate(ruleSet.effectiveFrom)} · ` : ''}
          Source : {ruleSet.sourceReference}
        </CardDescription>
        {canManage && ruleSet.status === 'BROUILLON' && (
          <div>
            <ActivateDialog ruleSet={ruleSet} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Sortie de la branche</dt>
          <dd>
            {ruleSet.branchExitAgeYears
              ? `Jour du ${ruleSet.branchExitAgeYears}e anniversaire`
              : undetermined}
          </dd>
          <dt className="text-muted-foreground">Délai de rattrapage</dt>
          <dd>
            {ruleSet.catchUpDelayMonths ? `${ruleSet.catchUpDelayMonths} mois` : undetermined}
          </dd>
          <dt className="text-muted-foreground">Alerte avant la sortie</dt>
          <dd>{ruleSet.exitAlertMonths ? `${ruleSet.exitAlertMonths} mois` : undetermined}</dd>
        </dl>
        <div>
          <p className="font-medium">Périodes d’étape</p>
          {ruleSet.stages.length === 0 ? (
            <p className="text-muted-foreground">Aucune période validée.</p>
          ) : (
            <ul className="space-y-1">
              {ruleSet.stages.map((rule) => (
                <li key={rule.stageCode}>
                  <strong>{rule.stageName}</strong> : de {point(rule.start)}{' '}
                  {rule.end ? `à ${point(rule.end)} (exclu)` : 'jusqu’à la sortie'} —{' '}
                  <span className="text-muted-foreground">{rule.sourceReference}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {ruleSet.notes && <p className="text-muted-foreground">{ruleSet.notes}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Référentiels d'âge versionnés : consultation par l'encadrement ; saisie d'un brouillon et mise en
 * vigueur par le responsable plein en fonction (`ageRules.manage`, revérifié par l'API).
 */
export function AgeRulesView() {
  const user = useSessionUser();
  const canManage = userCan(user, 'ageRules.manage');
  const query = useQuery(ageRuleSetsQueryOptions);
  const [creating, setCreating] = useState(false);
  if (query.isPending) return <TableSkeleton rows={3} />;
  if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const { items, currentVersion } = query.data;
  // Point de départ d'un nouveau brouillon : le référentiel applicable, sinon le plus récent.
  const base = items.find((item) => item.version === currentVersion) ?? items[0] ?? null;
  return (
    <div className="space-y-4">
      {canManage &&
        (creating ? (
          <AgeRuleSetForm base={base} onDone={() => setCreating(false)} />
        ) : (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nouveau référentiel
          </Button>
        ))}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun référentiel : l’étape et la sortie de la branche ne sont pas calculées.
        </p>
      ) : (
        items.map((ruleSet) => (
          <RuleSetCard
            key={ruleSet.id}
            ruleSet={ruleSet}
            current={ruleSet.version === currentVersion}
            canManage={canManage}
          />
        ))
      )}
    </div>
  );
}
