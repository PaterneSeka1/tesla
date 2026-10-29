import { DashboardShell } from '@/components/layout/dashboard-shell';

/** Cadre commun à toutes les pages connectées : monté une seule fois, quelle que soit la section. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
