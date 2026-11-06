'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { pathwayOverviewQueryOptions } from '@/lib/api/pathway';
import { formatCivilDate } from './pathway-summary';

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

/** Indicateurs de parcours de l'encadrement : effectifs, étapes théoriques, sorties, rattrapages. */
export function PathwayOverviewPanel() {
  const query = useQuery(pathwayOverviewQueryOptions());
  if (query.isPending) return <TableSkeleton rows={3} />;
  if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  return (
    <section className="space-y-3" aria-labelledby="parcours-communaute">
      <h2 id="parcours-communaute" className="text-lg font-semibold">
        Parcours de la communauté
      </h2>
      {/* L'effectif actif figure déjà dans « En chiffres » : seules les sorties sont ajoutées. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.exitedMembers > 0 && <Figure label="Sortis de la branche" value={d.exitedMembers} />}
        <Figure
          label="Rattrapages ouverts"
          value={d.catchUps.open}
          hint={`${d.catchUps.overdue} en retard · ${d.catchUps.withoutDeadline} sans échéance validée`}
        />
        <Figure label="Rattrapages à valider" value={d.catchUps.awaitingValidation} />
        <Figure
          label="Dates de naissance manquantes"
          value={d.missingBirthDate}
          hint="Empêchent le calcul de l’étape et de la sortie."
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Étapes (calculées selon l’âge)</CardTitle>
            <CardDescription>
              {d.ruleSetVersion
                ? `Référentiel ${d.ruleSetVersion}`
                : 'Aucun référentiel d’âge en vigueur'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {d.byStage.map((row) => (
                <li key={row.stage?.id ?? 'none'} className="flex justify-between gap-2">
                  <span>{row.stage?.name ?? 'Non déterminée'}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines sorties de la branche</CardTitle>
          </CardHeader>
          <CardContent>
            {d.upcomingExits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune date de sortie calculable.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.upcomingExits.map((row) => (
                  <li key={row.scout.id} className="flex flex-wrap justify-between gap-2">
                    <Link
                      href={`/administration/routiers/${row.scout.id}`}
                      className="text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {row.scout.firstName} {row.scout.lastName}
                    </Link>
                    <span>
                      {formatCivilDate(row.branchExitOn)} ({row.daysUntilExit} j)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
