'use client';

import { stableShuffle } from '@tesla/shared';
import { Brain, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { type GameSession } from '@/lib/game-session';
import { type BankEntry, entryId } from '@/lib/games';
import { cn } from '@/lib/utils';

interface MemoryCard {
  id: string;
  pair: number;
  label: string;
  side: 'left' | 'right';
}

export interface MemoryData {
  entry: { id: string; fingerprint: string };
  /** Paires trouvées (rang dans l'activité). */
  found: number[];
  turns: number;
  /** Identifiant de la tentative envoyée à la fin (une seule fois). */
  attemptId: string;
  done: boolean;
}

export const memoryStart = (entry: BankEntry): MemoryData => ({
  entry: { id: entryId(entry), fingerprint: entry.fingerprint },
  found: [],
  turns: 0,
  attemptId: crypto.randomUUID(),
  done: false,
});

export function memoryStillValid(data: MemoryData, entries: readonly BankEntry[]) {
  return entries.some(
    (entry) => entryId(entry) === data.entry.id && entry.fingerprint === data.entry.fingerprint,
  );
}

/** Dos de carte : motif de dunes et de vagues (District Requin de Sable), en SVG du thème. */
function CardBack() {
  return (
    <svg viewBox="0 0 60 80" className="h-full w-full" aria-hidden>
      <rect width="60" height="80" rx="9" fill="var(--tesla-bordeaux)" />
      <rect
        x="4"
        y="4"
        width="52"
        height="72"
        rx="6"
        fill="none"
        stroke="var(--tesla-or)"
        strokeOpacity="0.5"
      />
      {[22, 34, 46, 58].map((y, index) => (
        <path
          key={y}
          d={`M8 ${y} q 7 -${5 + index} 14 0 t 14 0 t 14 0`}
          fill="none"
          stroke="var(--tesla-or)"
          strokeOpacity={0.35 + index * 0.12}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
      <circle cx="30" cy="13" r="3.2" fill="var(--tesla-or)" opacity="0.8" />
    </svg>
  );
}

/**
 * Jeu de mémoire (D198) : des paires pédagogiques tirées d'une activité d'associations publiée.
 * Cartes retournées au toucher ou au clavier, sans minuterie ; chaque carte retournée est annoncée
 * aux lecteurs d'écran. La partie (paires trouvées, essais) reprend après une fermeture ; la fin
 * est enregistrée une fois (mode `memory`, sans note : trouver les paires est toujours possible).
 */
export function MemoryGame({
  session,
  entry,
  size,
  exitHref,
  onUpdate,
  onRestart,
  onComplete,
}: {
  session: GameSession<MemoryData>;
  entry: BankEntry;
  size: number;
  exitHref: string;
  onUpdate: (data: MemoryData) => void;
  onRestart: () => void;
  onComplete: (data: MemoryData) => void;
}) {
  const state = session.data;
  const cards = useMemo(() => {
    if (entry.activity.kind !== 'match') return [];
    const all: MemoryCard[] = entry.activity.pairs.slice(0, size).flatMap((pair, index) => [
      { id: `${index}-l`, pair: index, label: pair.left, side: 'left' as const },
      { id: `${index}-r`, pair: index, label: pair.right, side: 'right' as const },
    ]);
    // Disposition propre à la partie, identique à la reprise.
    return stableShuffle(all, `${entry.key}:${session.id}`);
  }, [entry, size, session.id]);
  const [open, setOpen] = useState<string[]>([]);
  const found = new Set(state.found);
  const pairs = cards.length / 2;
  // Textes longs (définitions) : cartes plus larges, jamais de contenu coupé à 320 px.
  const long = cards.some((card) => card.label.length > 48);
  const last = state.found.at(-1);
  const lastPair =
    last !== undefined && entry.activity.kind === 'match' ? entry.activity.pairs[last] : undefined;

  useEffect(() => {
    if (open.length !== 2) return;
    const timer = setTimeout(() => setOpen([]), 900);
    return () => clearTimeout(timer);
  }, [open]);

  const flip = (card: MemoryCard) => {
    if (state.done || found.has(card.pair) || open.includes(card.id) || open.length === 2) return;
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => cards.find((c) => c.id === id)!);
    const turns = state.turns + 1;
    if (a!.pair === b!.pair) {
      setOpen([]);
      const nowFound = [...state.found, a!.pair];
      const done = nowFound.length === pairs;
      const data = { ...state, found: nowFound, turns, done };
      onUpdate(data);
      feedback(done ? 'reward' : 'success');
      if (done) onComplete(data);
    } else onUpdate({ ...state, turns });
  };

  if (state.done)
    return (
      <div className="animate-achieve space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Brain className="mx-auto size-8 text-tesla-rouge" aria-hidden />
        <p className="text-lg font-semibold text-tesla-bordeaux">Toutes les paires trouvées</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRestart} autoFocus>
            <RotateCcw aria-hidden />
            Nouvelle partie
          </Button>
          <Button asChild variant="outline">
            <Link href={exitHref}>Autres défis</Link>
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
      <ul
        className={cn(
          'grid gap-2.5',
          long ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4',
        )}
      >
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
                  <span className="flip-card-face overflow-hidden rounded-xl shadow-sm">
                    <CardBack />
                  </span>
                  <span
                    className={cn(
                      'flip-card-face flip-card-back flex items-center justify-center overflow-hidden rounded-xl border-2 p-1.5 text-center text-xs leading-tight shadow-sm sm:text-sm',
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
      {lastPair && (
        <p
          key={last}
          className="animate-enter rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
          role="status"
        >
          <span className="font-semibold">{lastPair.left}</span> — {lastPair.right}
        </p>
      )}
    </div>
  );
}
