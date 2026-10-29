'use client';

import { useQuery } from '@tanstack/react-query';
import { type SessionUser } from '@tesla/shared';
import { CatchUpList } from '@/components/pathway/catch-up-list';
import { PathwaySummary } from '@/components/pathway/pathway-summary';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { scoutPathwayQueryOptions } from '@/lib/api/pathway';
import { userCan } from '@/lib/navigation';

/** Âge, étape théorique, étape officielle, échéances et rattrapages d'un routier (avec ou sans compte). */
export function PathwaySection({ scoutId, user }: { scoutId: string; user: SessionUser }) {
  const query = useQuery(scoutPathwayQueryOptions(scoutId));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Âge, parcours et rattrapages</CardTitle>
        <CardDescription>
          L’étape théorique découle de l’âge ; l’étape officielle, d’une décision du responsable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isPending && <TableSkeleton rows={3} />}
        {query.error && <QueryError error={query.error} onRetry={() => void query.refetch()} />}
        {query.data && (
          <>
            <PathwaySummary pathway={query.data} audience="encadrement" />
            <div className="space-y-2">
              <h3 className="font-semibold">Rattrapages</h3>
              <CatchUpList
                obligations={query.data.catchUps}
                deadlineUndetermined={query.data.catchUpDeadlineUndetermined}
                canDecide={userCan(user, 'catchUp.decide')}
                audience="encadrement"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
