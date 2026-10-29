'use client';

import { useQuery } from '@tanstack/react-query';
import { MODULE_VERSION_ACTION_LABELS, type ModuleVersionStatus } from '@tesla/shared';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { editorActivityQueryOptions, editorModulesQueryOptions } from '@/lib/api/modules';
import { formatDateTime, fullName } from '@/lib/format';

const FOLLOWED: ModuleVersionStatus[] = ['A_CORRIGER', 'SOUMIS', 'APPROUVE', 'REFUSE'];

/** Suivi des soumissions : versions en attente, à corriger, approuvées ou refusées, et retours du responsable. */
export function Submissions() {
  const modules = useQuery(editorModulesQueryOptions({ status: 'all', pageSize: 100 }));
  const activity = useQuery(editorActivityQueryOptions);

  const followed =
    modules.data?.items
      .map((module) => ({ module, version: module.working ?? module.latest }))
      .filter(({ version }) => FOLLOWED.includes(version.status))
      .sort((a, b) => FOLLOWED.indexOf(a.version.status) - FOLLOWED.indexOf(b.version.status)) ??
    [];
  const feedback =
    activity.data?.items.filter((event) =>
      ['CORRECTIONS_DEMANDEES', 'REFUSEE', 'APPROUVEE', 'PUBLIEE', 'ARCHIVEE'].includes(
        event.action,
      ),
    ) ?? [];

  return (
    <>
      <PageHeading
        title="Soumissions"
        description="Suivi de vos modules soumis à l’approbation du responsable et de ses retours."
      />
      <Card>
        <CardHeader>
          <CardTitle>Versions en cours de validation</CardTitle>
        </CardHeader>
        <CardContent>
          {modules.isPending ? (
            <TableSkeleton rows={3} />
          ) : modules.error ? (
            <QueryError error={modules.error} onRetry={() => void modules.refetch()} />
          ) : followed.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Aucune soumission en cours"
              description="Soumettez un brouillon depuis sa page d’édition lorsqu’il est prêt."
            />
          ) : (
            <ul className="divide-y">
              {followed.map(({ module, version }) => (
                <li key={module.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/chef/modules/${module.id}/modifier`}
                      className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {version.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {module.code} · version {version.version}
                      {version.submittedAt &&
                        ` · soumise le ${formatDateTime(version.submittedAt)}`}
                    </p>
                  </div>
                  <ModuleStatusBadge status={version.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Retours du responsable</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.isPending ? (
            <TableSkeleton rows={3} />
          ) : activity.error ? (
            <QueryError error={activity.error} onRetry={() => void activity.refetch()} />
          ) : feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune décision récente.</p>
          ) : (
            <ul className="space-y-3">
              {feedback.map((event) => (
                <li key={event.id} className="space-y-1 text-sm">
                  <p>
                    <Link
                      href={`/chef/modules/${event.moduleId}/modifier`}
                      className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {event.title}
                    </Link>{' '}
                    — {MODULE_VERSION_ACTION_LABELS[event.action]} (version {event.version}) par{' '}
                    {fullName(event.actor)}, {formatDateTime(event.createdAt)}
                  </p>
                  {event.comment && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 whitespace-pre-line">
                      {event.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
