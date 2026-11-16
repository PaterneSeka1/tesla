'use client';

import { useRouter } from 'next/navigation';
import { RequirePermission } from '@/components/auth/require-permission';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { PageHeading } from '@/components/page-heading';
import { AdultForm } from '../adult-form';

export function NewAdult() {
  const router = useRouter();
  const user = useSessionUser();
  return (
    <>
      <BackLink href="/administration/adultes">Adultes</BackLink>
      <PageHeading title="Nouvel adulte" />
      <RequirePermission user={user} permission="scout.create">
        <AdultForm onSaved={(adult) => router.push(`/administration/adultes/${adult.id}`)} />
      </RequirePermission>
    </>
  );
}
