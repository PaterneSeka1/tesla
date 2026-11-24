import { Suspense } from 'react';
import { GamePlay } from '@/components/games/game-play';
import { TableSkeleton } from '@/components/query-state';

/** Partie en mode concentration (cadre de l'application masqué). */
export default function GamePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <GamePlay />
    </Suspense>
  );
}
