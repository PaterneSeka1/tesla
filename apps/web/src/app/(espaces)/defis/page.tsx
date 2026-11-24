import { Suspense } from 'react';
import { GameRoom } from '@/components/games/game-room';
import { TableSkeleton } from '@/components/query-state';

export default function DefisPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <GameRoom />
    </Suspense>
  );
}
