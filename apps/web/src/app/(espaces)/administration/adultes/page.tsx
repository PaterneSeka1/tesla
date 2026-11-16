import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { AdultList } from './adult-list';

export const metadata: Metadata = { title: 'Adultes' };

export default function AdultsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AdultList />
    </Suspense>
  );
}
