'use client';

import { useQuery } from '@tanstack/react-query';
import { MODULE_VERSION_ACTION_LABELS } from '@tesla/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Tile } from '@/components/follow-up-overview';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { editorActivityQueryOptions, editorModulesQueryOptions } from '@/lib/api/modules';
import { authorName, formatDateTime } from '@/lib/format';

/** Tableau de bord éditorial du chef : compteurs réels et activité récente. */
export function EditorialOverview() {
  const count = (status: 'BROUILLON' | 'SOUMIS' | 'A_CORRIGER' | 'published') =>
    editorModulesQueryOptions({ status, pageSize: 1 });
  const drafts = useQuery(count('BROUILLON'));
  const submitted = useQuery(count('SOUMIS'));
  const toFix = useQuery(count('A_CORRIGER'));
  const published = useQuery(count('published'));
  const activity = useQuery(editorActivityQueryOptions);

  return (
    <>
      <section aria-labelledby="editorial-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="editorial-title" className="text-lg font-semibold">
            Mes modules
          </h3>
          <Button asChild size="sm">
            <Link href="/chef/modules/nouveau">
              <Plus aria-hidden />
              Nouveau module
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Brouillons" href="/chef/modules" query={drafts} />
          <Tile label="En attente d’approbation" href="/chef/soumissions" query={submitted} />
          <Tile label="À corriger" href="/chef/soumissions" query={toFix} />
          <Tile label="Publiés" href="/modules" query={published} />
        </div>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Activité éditoriale récente</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.isPending ? (
            <TableSkeleton rows={3} />
          ) : activity.error ? (
            <QueryError error={activity.error} onRetry={() => void activity.refetch()} />
          ) : activity.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activité pour l’instant.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.data.items.slice(0, 8).map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/chef/modules/${event.moduleId}/modifier`}
                    className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                  >
                    {event.title}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    · {MODULE_VERSION_ACTION_LABELS[event.action]} (v{event.version}) ·{' '}
                    {authorName(event.actor)} · {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
