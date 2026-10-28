import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SPACES } from '@/lib/spaces';

export const metadata: Metadata = { title: SPACES.routier.title };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell space="routier">{children}</DashboardShell>;
}
