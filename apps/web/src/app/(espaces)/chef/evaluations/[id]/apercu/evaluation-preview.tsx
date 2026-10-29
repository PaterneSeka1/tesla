'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { QuestionList } from '@/components/evaluations/question-list';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { editorEvaluationQueryOptions } from '@/lib/api/evaluations';
import { formatDuration } from '@/lib/format';

/** Aperçu de la version de travail : tel que le routier la verra, ou avec le corrigé. */
export function EvaluationPreview() {
  const { id } = useParams<{ id: string }>();
  const [showKey, setShowKey] = useState(false);
  const { data, error, isPending, refetch } = useQuery(editorEvaluationQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  const { current } = data;

  return (
    <>
      <BackLink href={`/chef/evaluations/${id}/modifier`}>Retour à la rédaction</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {data.code} · version {current.version} · {data.stage.name}
            {current.durationMinutes && ` · ${formatDuration(current.durationMinutes)}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {current.title}
          </h1>
          <ModuleStatusBadge status={current.status} />
        </div>
        <Button variant="outline" aria-pressed={showKey} onClick={() => setShowKey(!showKey)}>
          {showKey ? 'Masquer le corrigé' : 'Afficher le corrigé'}
        </Button>
      </div>
      {current.instructions && (
        <section className="rounded-lg border bg-tesla-sable/30 p-4">
          <h3 className="font-semibold">Consignes</h3>
          <p className="whitespace-pre-line text-sm">{current.instructions}</p>
        </section>
      )}
      <QuestionList questions={current.questions} showKey={showKey} />
    </>
  );
}
