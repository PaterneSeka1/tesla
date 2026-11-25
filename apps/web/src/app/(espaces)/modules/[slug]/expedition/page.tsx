import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Expedition } from '@/components/expeditions/expedition';

export const metadata: Metadata = { title: 'Expédition' };

export default function ExpeditionPage() {
  return (
    <Suspense>
      <Expedition />
    </Suspense>
  );
}
