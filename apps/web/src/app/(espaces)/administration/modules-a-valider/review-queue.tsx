'use client';

import { useQuery } from '@tanstack/react-query';
import { type SubmissionListQuery } from '@tesla/shared';
import { FileCheck2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { RequirePermission } from '@/components/auth/require-permission';
import { EmptyState } from '@/components/empty-state';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { submissionsQueryOptions } from '@/lib/api/modules';
import { authorName, formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = NonNullable<SubmissionListQuery['status']>;

const TABS: { value: Tab; label: string }[] = [
  { value: 'SOUMIS', label: 'À examiner' },
  { value: 'APPROUVE', label: 'Approuvés, à publier' },
];

/**
 * File de validation des modules. Distincte de la future file de validation des évaluations
 * (phase ultérieure) : les deux files ne sont jamais fusionnées.
 */
export function ReviewQueue() {
  const user = useSessionUser();
  const [tab, setTab] = useState<Tab>('SOUMIS');
  const { data, error, isPending, refetch } = useQuery(submissionsQueryOptions({ status: tab }));

  return (
    <RequirePermission user={user} permission="module.review">
      <PageHeading title="Modules à approuver" />
      <div role="tablist" aria-label="File de validation" className="flex gap-2">
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
          <TableSkeleton />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title={tab === 'SOUMIS' ? 'Aucune soumission en attente' : 'Aucun module à publier'}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <li key={item.version.id} className={cn('space-y-3 rounded-lg border bg-card p-4')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {item.code} · version {item.version.version}
                    </p>
                    <h3 className="font-semibold text-tesla-bordeaux">{item.version.title}</h3>
                  </div>
                  <ModuleStatusBadge status={item.version.status} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Auteur</dt>
                  <dd>{authorName(item.createdBy)}</dd>
                  {item.collaborators.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Collaborateurs</dt>
                      <dd>{item.collaborators.map(fullName).join(', ')}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Étape</dt>
                  <dd>{item.version.stage?.name ?? 'Toutes'}</dd>
                  <dt className="text-muted-foreground">Leçons</dt>
                  <dd>{item.version.lessonCount}</dd>
                  <dt className="text-muted-foreground">Soumis</dt>
                  <dd>
                    {item.version.submittedAt ? formatDateTime(item.version.submittedAt) : '—'}
                    {item.submittedBy && ` par ${fullName(item.submittedBy)}`}
                  </dd>
                </dl>
                {item.submissionNote && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
                    {item.submissionNote}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {item.replacesPublished && (
                    <Badge variant="outline">Remplacera la version en ligne</Badge>
                  )}
                  <Button asChild size="sm" className="ml-auto">
                    <Link href={`/administration/modules/${item.moduleId}/revision`}>Examiner</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequirePermission>
  );
}
