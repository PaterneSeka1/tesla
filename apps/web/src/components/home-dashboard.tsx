'use client';

import { useQuery } from '@tanstack/react-query';
import { KeyRound, Network } from 'lucide-react';
import Link from 'next/link';
import { useSessionUser } from '@/components/auth/session-gate';
import { TeamCard } from '@/components/leadership/community-leadership';
import { MyPathwayOverview } from '@/components/pathway/my-pathway';
import { StaffDashboard } from '@/components/pathway/staff-dashboard';
import { RoutierPedagogyDashboard } from '@/components/progression/pedagogy-dashboard';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { leadershipTeamQueryOptions } from '@/lib/api/leadership';
import { userCan } from '@/lib/navigation';

/**
 * Accueil unique (D132) : les blocs affichés découlent des permissions et des données, jamais d'un
 * choix d'espace ni d'un rôle affiché. Parcours personnel pour qui en suit un ; suivi de
 * l'encadrement (enrichi des décisions officielles pour le responsable plein) ; à défaut,
 * l'administration de la plateforme.
 */
export function HomeDashboard() {
  const user = useSessionUser();
  const pathway = userCan(user, 'progression.readOwn');
  const staff = userCan(user, 'progression.read');
  return (
    <div className="space-y-6">
      {pathway && (
        <>
          <MyPathwayOverview />
          <RoutierPedagogyDashboard />
        </>
      )}
      {staff && <StaffDashboard />}
      {userCan(user, 'leadership.manage') && <AdministrationOverview />}
    </div>
  );
}

function AdministrationOverview() {
  const user = useSessionUser();
  const team = useQuery(leadershipTeamQueryOptions);
  return (
    <div className="space-y-4">
      {team.isPending ? (
        <TableSkeleton rows={3} />
      ) : team.error ? (
        <QueryError error={team.error} onRetry={() => void team.refetch()} />
      ) : (
        <TeamCard members={team.data.members} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/communaute">
            <Network aria-hidden />
            Gérer l’encadrement
          </Link>
        </Button>
        {userCan(user, 'account.read') && (
          <Button asChild variant="outline">
            <Link href="/administration/comptes">
              <KeyRound aria-hidden />
              Comptes
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
