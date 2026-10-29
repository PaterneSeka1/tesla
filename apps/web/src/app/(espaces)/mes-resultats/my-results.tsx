'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EVALUATION_MODE_LABELS } from '@tesla/shared';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { AttemptStatusBadge } from '@/components/evaluations/attempt-status-badge';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { myAttemptsQueryOptions } from '@/lib/api/evaluations';
import { formatDateTime, formatScore } from '@/lib/format';

/**
 * Historique personnel (en ligne et papier). Le détail n'apparaît qu'après l'examen du résultat par
 * le responsable, sans les bonnes réponses. Aucun classement entre routiers.
 */
export function MyResults() {
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery({
    ...myAttemptsQueryOptions({ page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeading
        title="Mes résultats"
        description="Vos évaluations en ligne et sur papier. Un résultat accompagne votre progression : il ne valide jamais seul une étape."
      />
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Aucune évaluation pour l’instant"
          description="Vos tentatives apparaîtront ici, y compris celles passées sur papier."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((attempt) => (
              <li key={attempt.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-tesla-bordeaux">
                      {attempt.evaluation.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{attempt.code}</span> · version {attempt.version}{' '}
                      · {EVALUATION_MODE_LABELS[attempt.mode]} ·{' '}
                      {formatDateTime(
                        attempt.submittedAt ?? attempt.completedAt ?? attempt.createdAt,
                      )}
                    </p>
                  </div>
                  <AttemptStatusBadge status={attempt.status} />
                </div>
                {attempt.result ? (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium">
                      Résultat : {formatScore(attempt.result.score, attempt.result.maxScore)}
                      <span className="ml-2 text-muted-foreground">(détail)</span>
                    </summary>
                    <div className="mt-3 space-y-2 text-sm">
                      {attempt.result.comment && (
                        <p className="rounded-md bg-tesla-sable/30 p-3">
                          Responsable pédagogique : {attempt.result.comment}
                        </p>
                      )}
                      <ol className="space-y-2">
                        {attempt.result.questions.map((question, index) => (
                          <li key={question.id} className="rounded-md border p-3">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">Question {index + 1}</span>
                              <span>{formatScore(question.awardedPoints, question.points)}</span>
                            </div>
                            <p className="text-muted-foreground">{question.prompt}</p>
                            {(question.appreciation || question.comment) && (
                              <p className="mt-1">
                                {[question.appreciation, question.comment]
                                  .filter(Boolean)
                                  .join(' — ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                ) : (
                  attempt.status !== 'ANNULEE' && (
                    <p className="text-sm text-muted-foreground">
                      Le résultat sera visible après la correction et l’examen du responsable.
                    </p>
                  )
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
