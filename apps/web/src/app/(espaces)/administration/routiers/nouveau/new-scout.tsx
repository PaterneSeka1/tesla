'use client';

import { useRouter } from 'next/navigation';
import { RequirePermission } from '@/components/auth/require-permission';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { PageHeading } from '@/components/page-heading';
import { ScoutForm } from '../scout-form';

export function NewScout() {
  const router = useRouter();
  const user = useSessionUser();
  return (
    <>
      <BackLink href="/administration/routiers">Routiers</BackLink>
      <PageHeading
        title="Nouveau routier"
        description="Le routier est enregistré sans compte : un compte existant pourra être rattaché plus tard depuis sa fiche."
      />
      <RequirePermission user={user} permission="scout.create">
        <ScoutForm onSaved={(scout) => router.push(`/administration/routiers/${scout.id}`)} />
      </RequirePermission>
    </>
  );
}
