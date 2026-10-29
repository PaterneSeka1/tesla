import type { Metadata } from 'next';
import { ModulesOverview } from './modules-overview';

export const metadata: Metadata = { title: 'Tous les modules' };

export default function AdminModulesPage() {
  return <ModulesOverview />;
}
