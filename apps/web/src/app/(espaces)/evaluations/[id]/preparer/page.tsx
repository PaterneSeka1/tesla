import { Suspense } from 'react';
import { OfflineHub } from '@/components/offline-hub';
async function Prepare({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfflineHub prepareId={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <Prepare params={params} />
    </Suspense>
  );
}
