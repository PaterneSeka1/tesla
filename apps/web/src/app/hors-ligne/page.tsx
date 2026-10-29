import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { OfflineHub } from '@/components/offline-hub';
export const metadata: Metadata = { title: 'Hors ligne' };
export default function OfflinePage() {
  return (
    <DashboardShell space="routier" offline>
      <OfflineHub />
    </DashboardShell>
  );
}
