'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { teamHistoryQueryOptions } from '@/lib/api/scouts';
import { formatDate, fullName } from '@/lib/format';

export function TeamHistory({ scoutId }: { scoutId: string }) {
  const { data, error, isPending, refetch } = useQuery(teamHistoryQueryOptions(scoutId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des équipes</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <TableSkeleton rows={2} />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="Aucune affectation" />
        ) : (
          <ol className="space-y-3">
            {data.items.map((assignment) => (
              <li key={assignment.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{assignment.team.name}</span>
                  {assignment.endedAt === null && <Badge variant="success">En cours</Badge>}
                  {assignment.team.archived && <Badge variant="outline">Équipe archivée</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Du {formatDate(assignment.startedAt)}
                  {assignment.endedAt ? ` au ${formatDate(assignment.endedAt)}` : ' à aujourd’hui'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {assignment.assignedBy
                    ? `Affecté par ${fullName(assignment.assignedBy)}`
                    : 'Affectation système'}
                  {assignment.endedBy && ` · clôturé par ${fullName(assignment.endedBy)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
