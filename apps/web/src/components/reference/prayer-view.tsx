'use client';

import { blockPlainText, type LessonDocument } from '@tesla/shared';
import { Eye, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LessonContent } from '@/components/modules/lesson-content';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Mode = 'texte' | 'reveler' | 'completer' | 'ordonner';

const MODES: { value: Mode; label: string }[] = [
  { value: 'texte', label: 'Texte complet' },
  { value: 'reveler', label: 'Révéler ligne à ligne' },
  { value: 'completer', label: 'Compléter' },
  { value: 'ordonner', label: 'Remettre en ordre' },
];

/** Lignes du texte, dans l'ordre (paragraphes et éléments de liste). */
export function prayerLines(document: LessonDocument): string[] {
  const lines: string[] = [];
  for (const block of document.content) {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (const item of block.content) lines.push(item.content.map(blockPlainText).join(' '));
    } else if (block.type !== 'heading' && block.type !== 'image') {
      lines.push(blockPlainText(block));
    }
  }
  return lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Mot masqué d'une ligne : le plus long (4 lettres au moins), choix déterministe. */
export function hiddenWord(line: string): { before: string; word: string; after: string } | null {
  const words = [...line.matchAll(/[\p{L}’'-]{4,}/gu)];
  if (words.length === 0) return null;
  const longest = words.reduce((best, word) => (word[0].length > best[0].length ? word : best));
  const start = longest.index!;
  return {
    before: line.slice(0, start),
    word: longest[0],
    after: line.slice(start + longest[0].length),
  };
}

/** Ordre de départ mélangé, déterministe (jamais identique à l'ordre du texte s'il y a 2 lignes ou plus). */
export function shuffledOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  if (count < 2) return order;
  // Rotation puis inversion par paires : simple, reproductible, sans hasard à expliquer.
  const rotated = [...order.slice(Math.ceil(count / 2)), ...order.slice(0, Math.ceil(count / 2))];
  for (let i = 0; i + 1 < rotated.length; i += 2) {
    [rotated[i], rotated[i + 1]] = [rotated[i + 1]!, rotated[i]!];
  }
  return rotated.every((value, index) => value === index) ? order.reverse() : rotated;
}

/**
 * Prière (D220) : texte intégral dans une lecture calme, et, facultativement, une aide à la
 * mémorisation du texte. Aucun chronomètre, aucun classement, aucun score ni XP : apprendre un
 * texte par cœur n'est pas mesurer une pratique spirituelle.
 */
export function PrayerView({ document }: { document: LessonDocument }) {
  const [mode, setMode] = useState<Mode>('texte');
  const lines = useMemo(() => prayerLines(document), [document]);
  return (
    <div className="space-y-5">
      {mode === 'texte' ? (
        <div className="font-serif text-[1.15em] leading-loose [&_p]:text-center">
          <LessonContent document={document} />
        </div>
      ) : mode === 'reveler' ? (
        <Reveal lines={lines} />
      ) : mode === 'completer' ? (
        <Complete lines={lines} />
      ) : (
        <Order lines={lines} />
      )}
      <details
        className="rounded-lg border border-dashed px-3 py-2 text-sm"
        open={mode !== 'texte'}
      >
        <summary className="cursor-pointer text-muted-foreground">Apprendre par cœur</summary>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Aide à la mémorisation">
          {MODES.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={mode === item.value ? 'default' : 'outline'}
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </details>
    </div>
  );
}

function Reveal({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(1);
  return (
    <div className="space-y-3 text-center font-serif text-[1.15em] leading-loose">
      {lines.map((line, index) => (
        <p
          key={index}
          className={cn(
            index >= shown && 'select-none text-transparent [text-shadow:0_0_10px_rgb(0_0_0/0.25)]',
          )}
          aria-hidden={index >= shown}
        >
          {line}
        </p>
      ))}
      <div className="flex justify-center gap-2 font-sans text-base">
        <Button type="button" variant="outline" onClick={() => setShown(1)} disabled={shown <= 1}>
          <RotateCcw aria-hidden />
          Recommencer
        </Button>
        <Button type="button" onClick={() => setShown(shown + 1)} disabled={shown >= lines.length}>
          <Eye aria-hidden />
          Ligne suivante
        </Button>
      </div>
    </div>
  );
}

function Complete({ lines }: { lines: string[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  return (
    <div className="space-y-3 text-center font-serif text-[1.15em] leading-loose">
      <p className="font-sans text-sm text-muted-foreground">
        Dites le mot manquant, puis touchez l’espace pour vérifier.
      </p>
      {lines.map((line, index) => {
        const gap = hiddenWord(line);
        if (!gap) return <p key={index}>{line}</p>;
        const open = revealed.has(index);
        return (
          <p key={index}>
            {gap.before}
            <button
              type="button"
              onClick={() => setRevealed(new Set(revealed).add(index))}
              className={cn(
                'rounded px-1 underline decoration-dotted underline-offset-4',
                open ? 'text-tesla-bordeaux' : 'bg-tesla-sable/60 text-transparent',
              )}
              aria-label={open ? gap.word : 'Afficher le mot manquant'}
            >
              {gap.word}
            </button>
            {gap.after}
          </p>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="font-sans"
        onClick={() => setRevealed(new Set())}
      >
        <RotateCcw aria-hidden />
        Recommencer
      </Button>
    </div>
  );
}

function Order({ lines }: { lines: string[] }) {
  const start = useMemo(() => shuffledOrder(lines.length), [lines.length]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [hint, setHint] = useState<number | null>(null);
  const remaining = start.filter((index) => !placed.includes(index));
  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-center font-serif text-[1.1em] leading-relaxed">
        {placed.map((index) => (
          <li key={index}>{lines[index]}</li>
        ))}
      </ol>
      {remaining.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Touchez la ligne qui vient ensuite.</p>
          {remaining.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (index === placed.length) {
                  setPlaced([...placed, index]);
                  setHint(null);
                } else setHint(index);
              }}
              className={cn(
                'block w-full rounded-lg border bg-white px-3 py-2 text-left transition-colors',
                hint === index && 'border-tesla-or bg-tesla-sable/30',
              )}
            >
              {lines[index]}
            </button>
          ))}
          {hint !== null && (
            <p className="text-sm text-muted-foreground" role="status">
              {placed.length === 0
                ? 'Pas encore : cherchez la première ligne.'
                : `Pas encore : cherchez la ligne qui suit « ${lines[placed.length - 1]} ».`}
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground" role="status">
          Texte remis dans l’ordre.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => setPlaced([])}
        disabled={placed.length === 0}
      >
        <RotateCcw aria-hidden />
        Recommencer
      </Button>
    </div>
  );
}
