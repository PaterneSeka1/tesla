'use client';

import { useQuery } from '@tanstack/react-query';
import { type AgeRuleSet } from '@tesla/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { ageRuleSetsQueryOptions } from '@/lib/api/pathway';
import { formatCivilDate } from './pathway-summary';

const point = (p: { years: number; months: number }) =>
  `${p.years} ans${p.months ? ` et ${p.months} mois` : ''}`;

const undetermined = <span className="text-muted-foreground">Non arbitré</span>;

function RuleSetCard({ ruleSet, current }: { ruleSet: AgeRuleSet; current: boolean }) {
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

/** Référentiels d'âge versionnés : consultation (création et mise en vigueur par l'API). */
export function AgeRulesView() {
  const query = useQuery(ageRuleSetsQueryOptions);
  if (query.isPending) return <TableSkeleton rows={3} />;
  if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun référentiel : l’étape théorique et la sortie de la branche ne sont pas calculées.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {query.data.items.map((ruleSet) => (
        <RuleSetCard
          key={ruleSet.id}
          ruleSet={ruleSet}
          current={ruleSet.version === query.data.currentVersion}
        />
      ))}
    </div>
  );
}
