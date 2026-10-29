'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { RequirePermission } from '@/components/auth/require-permission';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { scoutQueryOptions } from '@/lib/api/scouts';
import { fullName } from '@/lib/format';
import { ScoutForm } from '../../scout-form';

export function EditScout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSessionUser();
  const { data: scout, error, isPending, refetch } = useQuery(scoutQueryOptions(id));

  return (
    <>
      <BackLink href={`/administration/routiers/${id}`}>Fiche du routier</BackLink>
      {isPending ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <PageHeading
            title={`Modifier — ${fullName(scout)}`}
            description="Les modifications sont journalisées."
          />
          <RequirePermission user={user} permission="scout.update">
            <ScoutForm
              scout={scout}
              onSaved={() => router.push(`/administration/routiers/${id}`)}
            />
          </RequirePermission>
        </>
      )}
    </>
  );
}
