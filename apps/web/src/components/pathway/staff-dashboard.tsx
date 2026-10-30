'use client';

import { useSessionUser } from '@/components/auth/session-gate';
import {
  ChefPedagogyDashboard,
  ResponsablePedagogyDashboard,
} from '@/components/progression/pedagogy-dashboard';
import { userCan } from '@/lib/navigation';
import { PathwayOverviewPanel } from './pathway-overview';

/**
 * Suivi de l'encadrement sur l'accueil : les décisions officielles (files d'approbation et
 * d'examen) n'apparaissent qu'au responsable plein en fonction.
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
