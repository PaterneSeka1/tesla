import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { ModulesOverview } from './modules-overview';

export const metadata: Metadata = { title: 'Tous les modules' };

export default function AdminModulesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ModulesOverview />
    </Suspense>
  );
}
