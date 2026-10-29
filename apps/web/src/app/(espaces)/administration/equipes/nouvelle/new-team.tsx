'use client';

import { useRouter } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { PageHeading } from '@/components/page-heading';
import { RequirePermission } from '@/components/auth/require-permission';
import { TeamForm } from '../team-form';

export function NewTeam() {
  const router = useRouter();
  const user = useSessionUser();
  return (
    <>
      <BackLink href="/administration/equipes">Équipes</BackLink>
      <PageHeading
        title="Nouvelle équipe"
        description="Le nom doit être unique dans la communauté."
      />
      <RequirePermission user={user} permission="team.manage">
        <TeamForm onSaved={(team) => router.push(`/administration/equipes/${team.id}`)} />
      </RequirePermission>
    </>
  );
}
