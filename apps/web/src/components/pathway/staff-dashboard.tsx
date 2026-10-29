'use client';

import { useSessionUser } from '@/components/auth/session-gate';
import {
  ChefPedagogyDashboard,
  ResponsablePedagogyDashboard,
} from '@/components/progression/pedagogy-dashboard';
import { userCan } from '@/lib/navigation';
import { PathwayOverviewPanel } from './pathway-overview';

/**
 * Tableau de bord unique de l'encadrement : les décisions officielles (files d'approbation et
 * d'examen) n'apparaissent qu'aux personnes habilitées (plein en exercice ou délégation).
 */
export function StaffDashboard() {
  const user = useSessionUser();
  return (
    <>
      {userCan(user, 'dashboard.official') ? (
        <ResponsablePedagogyDashboard />
      ) : (
        <ChefPedagogyDashboard />
      )}
      <PathwayOverviewPanel />
    </>
  );
}
