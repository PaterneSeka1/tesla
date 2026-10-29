import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/query-state';
import { NewProposal } from './new-proposal';

export const metadata: Metadata = { title: 'Proposer une validation' };

export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <NewProposal />
    </Suspense>
  );
}
