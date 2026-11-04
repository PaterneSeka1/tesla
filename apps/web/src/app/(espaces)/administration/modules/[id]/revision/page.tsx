import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { ModuleRevision } from './module-revision';

export const metadata: Metadata = { title: 'Révision d’un module' };

export default function ModuleRevisionPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <ModuleRevision />
    </Suspense>
  );
}
