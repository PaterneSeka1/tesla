import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { ModuleEditor } from './module-editor';

export const metadata: Metadata = { title: 'Modifier un module' };

export default function EditModulePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <ModuleEditor />
    </Suspense>
  );
}
