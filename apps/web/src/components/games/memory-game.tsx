'use client';

import { stableShuffle } from '@tesla/shared';
import { Brain } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { type BankEntry } from '@/lib/games';
import { cn } from '@/lib/utils';

interface MemoryCard {
  id: string;
  pair: number;
  label: string;
  side: 'left' | 'right';
}

/**
 * Jeu de mémoire (D198) : des paires pédagogiques (notion et définition, date et événement…) tirées
 * d'une activité d'associations publiée. Cartes retournées au toucher ou au clavier ; aucune
 * minuterie, aucun score enregistré. Chaque carte retournée est annoncée aux lecteurs d'écran.
 */
export function MemoryGame({
  entry,
  size,
  exitHref,
}: {
  entry: BankEntry;
  size: number;
  exitHref: string;
}) {
  const [round, setRound] = useState(0);
  const cards = useMemo(() => {
    if (entry.activity.kind !== 'match') return [];
    const pairs = entry.activity.pairs.slice(0, size);
    const all: MemoryCard[] = pairs.flatMap((pair, index) => [
      { id: `${index}-l`, pair: index, label: pair.left, side: 'left' as const },
      { id: `${index}-r`, pair: index, label: pair.right, side: 'right' as const },
    ]);
    return stableShuffle(all, `${entry.key}:${round}`);
  }, [entry, size, round]);
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [turns, setTurns] = useState(0);
  const pairs = cards.length / 2;
  const done = found.size === pairs && pairs > 0;

  const flip = (card: MemoryCard) => {
    if (found.has(card.pair) || open.includes(card.id) || open.length === 2) return;
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;
    setTurns(turns + 1);
    const [a, b] = next.map((id) => cards.find((c) => c.id === id)!);
    if (a!.pair === b!.pair) {
      setFound(new Set([...found, a!.pair]));
      setOpen([]);
      feedback('success');
    } else {
      setTimeout(() => setOpen([]), 900);
    }
  };

  if (done)
    return (
      <div className="animate-achieve space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Brain className="mx-auto size-8 text-tesla-rouge" aria-hidden />
        <p className="text-lg font-semibold text-tesla-bordeaux">Toutes les paires trouvées</p>
        <p className="text-sm text-muted-foreground">En {turns} essais.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={exitHref}>Autres défis</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFound(new Set());
              setTurns(0);
              setRound(round + 1);
            }}
          >
            Rejouer
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {found.size} paire{found.size > 1 ? 's' : ''} sur {pairs}
        {entry.activity.title ? ` · ${entry.activity.title}` : ''}
      </p>
      <ul className="grid grid-cols-4 gap-2">
        {cards.map((card) => {
          const visible = found.has(card.pair) || open.includes(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => flip(card)}
                aria-label={visible ? card.label : 'Carte cachée'}
                className="flip-card block aspect-[3/4] w-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                data-flipped={visible}
                disabled={found.has(card.pair)}
              >
                <span className="flip-card-inner h-full">
                  <span className="flip-card-face flex items-center justify-center rounded-xl border-2 border-tesla-bordeaux/20 bg-tesla-bordeaux text-tesla-or">
                    <Brain className="size-6 opacity-60" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      'flip-card-face flip-card-back flex items-center justify-center overflow-hidden rounded-xl border-2 p-1.5 text-center text-xs leading-tight sm:text-sm',
                      found.has(card.pair)
                        ? 'border-emerald-600 bg-emerald-50'
                        : card.side === 'left'
                          ? 'border-tesla-or bg-card font-semibold'
                          : 'border-tesla-or/60 bg-tesla-sable/40',
                    )}
                  >
                    {card.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
