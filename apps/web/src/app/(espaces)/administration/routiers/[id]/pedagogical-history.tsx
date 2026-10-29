'use client';

import { useQuery } from '@tanstack/react-query';
import { ATTEMPT_STATUS_LABELS } from '@tesla/shared';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { pedagogicalHistoryQueryOptions } from '@/lib/api/scouts';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

const MODE_LABELS = { EN_LIGNE: 'En ligne', HORS_LIGNE: 'Hors ligne', PAPIER: 'Papier' } as const;

/** Uniquement les données enregistrées : tentatives d'évaluation et changements d'étape journalisés. */
export function PedagogicalHistory({ scoutId }: { scoutId: string }) {
  const { data, error, isPending, refetch } = useQuery(pedagogicalHistoryQueryOptions(scoutId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique pédagogique</CardTitle>
        <CardDescription>
          Évaluations enregistrées et changements d’étape validés par le responsable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <TableSkeleton rows={2} />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.attempts.length === 0 && data.stageChanges.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Aucun élément enregistré"
            description="Les évaluations (papier ou en ligne) et les changements d’étape apparaîtront ici."
          />
        ) : (
          <>
            {data.stageChanges.length > 0 && (
              <section aria-label="Changements d’étape" className="space-y-2">
                <h4 className="text-sm font-semibold">Changements d’étape</h4>
                <ul className="space-y-2 text-sm">
                  {data.stageChanges.map((change) => (
                    <li key={change.at} className="rounded-md border p-3">
                      {change.from?.name ?? 'Non renseignée'} →{' '}
                      <strong>{change.to?.name ?? 'Non renseignée'}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(change.at)}
                        {change.by && ` · ${fullName(change.by)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.attempts.length > 0 && (
              <section aria-label="Évaluations" className="space-y-2">
                <h4 className="text-sm font-semibold">Évaluations</h4>
                <ul className="space-y-2 text-sm">
                  {data.attempts.map((attempt) => (
                    <li key={attempt.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{attempt.evaluationTitle}</span>
                        <Badge variant="outline">{MODE_LABELS[attempt.mode]}</Badge>
                        <Badge variant="secondary">{ATTEMPT_STATUS_LABELS[attempt.status]}</Badge>
                      </div>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {attempt.code} ·{' '}
                        {attempt.completedAt
                          ? `réalisée le ${formatDate(attempt.completedAt)}`
                          : `préparée le ${formatDate(attempt.createdAt)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
