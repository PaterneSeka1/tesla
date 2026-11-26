import { DashboardShell } from '@/components/layout/dashboard-shell';

/**
 * Le contenu n'est affiché qu'après vérification de la session côté client (`SessionGate`) :
 * ces pages ne peuvent pas être « instantanées » au sens de Next. On les exclut de la validation
 * (développement uniquement) ; le prérendu et le streaming sont inchangés.
 */
export const instant = false;

/** Cadre commun à toutes les pages connectées : monté une seule fois, quelle que soit la section. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
