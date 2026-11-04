import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorModuleList } from '@/components/modules/editor-module-list';
import { TableSkeleton } from '@/components/query-state';

export const metadata: Metadata = { title: 'Mes modules' };

export default function ChefModulesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <EditorModuleList />
    </Suspense>
  );
}
