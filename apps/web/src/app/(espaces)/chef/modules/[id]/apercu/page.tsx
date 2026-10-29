import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { ModulePreview } from './module-preview';

export const metadata: Metadata = { title: 'Aperçu du module' };

export default function ModulePreviewPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <ModulePreview />
    </Suspense>
  );
}
