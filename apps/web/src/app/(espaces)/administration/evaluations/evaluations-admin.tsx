'use client';

import { useQuery } from '@tanstack/react-query';
import { type EvaluationSubmissionQuery } from '@tesla/shared';
import Link from 'next/link';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { ResponsableOnly } from '@/components/auth/responsable-only';
import { EvaluationList } from '@/components/evaluations/evaluation-list';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { evaluationSubmissionsQueryOptions } from '@/lib/api/evaluations';
import { formatDateTime, formatPoints, fullName } from '@/lib/format';

type Tab = NonNullable<EvaluationSubmissionQuery['status']>;

const TABS: { value: Tab; label: string }[] = [
  { value: 'SOUMIS', label: 'Questionnaires à examiner' },
  { value: 'APPROUVE', label: 'Approuvés, à publier' },
];

/**
 * Questionnaires : file d'approbation (distincte des modules et des résultats à examiner)
 * et vue d'ensemble de tous les questionnaires de la communauté.
 */
export function EvaluationsAdmin() {
  const user = useSessionUser();
  const [tab, setTab] = useState<Tab>('SOUMIS');
  const { data, error, isPending, refetch } = useQuery(
    evaluationSubmissionsQueryOptions({ status: tab }),
  );

  return (
    <ResponsableOnly role={user.role}>
      <section aria-labelledby="evaluation-queue" className="space-y-3">
        <h2
          id="evaluation-queue"
          className="text-2xl font-semibold tracking-tight text-tesla-bordeaux"
        >
          Questionnaires à approuver
        </h2>
        <div role="tablist" aria-label="File d’approbation" className="flex flex-wrap gap-2">
          {TABS.map(({ value, label }) => (
            <Button
              key={value}
              role="tab"
              aria-selected={tab === value}
              variant={tab === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div role="tabpanel">
          {isPending ? (
            <TableSkeleton rows={2} />
          ) : error ? (
            <QueryError error={error} onRetry={() => void refetch()} />
          ) : data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tab === 'SOUMIS'
                ? 'Aucun questionnaire en attente.'
                : 'Aucun questionnaire à publier.'}
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {data.items.map((item) => (
                <li key={item.version.id} className="space-y-2 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {item.code} · version {item.version.version} · {item.stage.name}
                      </p>
                      <h3 className="font-semibold text-tesla-bordeaux">{item.version.title}</h3>
                    </div>
                    <ModuleStatusBadge status={item.version.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.version.questionCount} questions ·{' '}
                    {formatPoints(item.version.totalPoints)}
                    {item.submittedBy && ` · soumis par ${fullName(item.submittedBy)}`}
                    {item.version.submittedAt && ` le ${formatDateTime(item.version.submittedAt)}`}
                    {item.replacesPublished && ' · remplace la version publiée'}
                  </p>
                  {item.submissionNote && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                      « {item.submissionNote} »
                    </p>
                  )}
                  <Button asChild size="sm">
                    <Link href={`/administration/evaluations/${item.evaluationId}`}>Examiner</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <EvaluationList review />
    </ResponsableOnly>
  );
}
