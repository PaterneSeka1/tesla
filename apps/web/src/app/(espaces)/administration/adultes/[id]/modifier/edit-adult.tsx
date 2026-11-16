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
import { AdultForm } from '../../adult-form';

export function EditAdult() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useSessionUser();
  const { data: adult, error, isPending, refetch } = useQuery(scoutQueryOptions(id));

  return (
    <>
      <BackLink href={`/administration/adultes/${id}`}>Fiche de l’adulte</BackLink>
      {isPending ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <PageHeading title={`Modifier — ${fullName(adult)}`} />
          <RequirePermission user={user} permission="scout.update">
            <AdultForm adult={adult} onSaved={() => router.push(`/administration/adultes/${id}`)} />
          </RequirePermission>
        </>
      )}
    </>
  );
}
