'use client';

import { useRouter } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { PageHeading } from '@/components/page-heading';
import { ResponsableOnly } from '@/components/auth/responsable-only';
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
      <ResponsableOnly role={user.role}>
        <TeamForm onSaved={(team) => router.push(`/administration/equipes/${team.id}`)} />
      </ResponsableOnly>
    </>
  );
}
