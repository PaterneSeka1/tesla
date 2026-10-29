import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { ScoutList } from './scout-list';

export const metadata: Metadata = { title: 'Routiers' };

export default function ScoutsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ScoutList />
    </Suspense>
  );
}
