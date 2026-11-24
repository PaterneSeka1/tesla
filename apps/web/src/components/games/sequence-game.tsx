'use client';

import { BookOpen, Flag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ActivityRunner } from '@/components/practice/activity-runner';
import { Button } from '@/components/ui/button';
import { type BankEntry } from '@/lib/games';

const KEY = 'tesla.games.position';

function savedIndex(storageKey: string, length: number): number {
  try {
    const saved = (JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number>)[
      storageKey
    ];
    return typeof saved === 'number' && saved >= 0 && saved < length ? saved : 0;
  } catch {
    return 0;
  }
}

function saveIndex(storageKey: string, index: number | null) {
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    if (index === null) delete all[storageKey];
    else all[storageKey] = index;
    // Seules les parties du jour sont utiles : on garde les dix dernières.
    window.localStorage.setItem(
      KEY,
      JSON.stringify(Object.fromEntries(Object.entries(all).slice(-10))),
    );
  } catch {
    // Stockage indisponible : la partie reprendra au début.
  }
}

/**
 * Enchaînement d'activités : une à la fois, reprise automatique à l'activité en cours (fermeture,
 * actualisation, coupure réseau), lien discret vers la leçon d'origine pour revoir la notion.
 */
export function SequenceGame({
  entries,
  storageKey,
  exitHref,
}: {
  entries: BankEntry[];
  storageKey: string;
  exitHref: string;
}) {
  const [index, setIndex] = useState(() => savedIndex(storageKey, entries.length));
  const [done, setDone] = useState(false);
  useEffect(() => saveIndex(storageKey, done ? null : index), [storageKey, index, done]);

  if (done)
    return (
      <div className="animate-achieve space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Flag className="mx-auto size-8 text-tesla-rouge" aria-hidden />
        <p className="text-lg font-semibold text-tesla-bordeaux">Défi terminé</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={exitHref}>Autres défis</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setDone(false);
            }}
          >
            Rejouer
          </Button>
        </div>
      </div>
    );

  const entry = entries[index]!;
  const last = index + 1 >= entries.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {entries.length > 1 && (
          <span className="tabular-nums">
            {index + 1} / {entries.length}
          </span>
        )}
        <Link
          href={`/modules/${entry.moduleSlug}/lecons/${entry.lessonId}`}
          className="ml-auto inline-flex min-w-0 items-center gap-1 underline-offset-4 hover:underline"
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{entry.lessonTitle}</span>
        </Link>
      </div>
      {entry.activity.title && (
        <p className="font-semibold text-tesla-bordeaux">{entry.activity.title}</p>
      )}
      <div key={`${index}`} className="animate-enter">
        <ActivityRunner
          item={entry}
          continueLabel={last ? 'Terminer' : 'Activité suivante'}
          onContinue={() => (last ? setDone(true) : setIndex(index + 1))}
        />
      </div>
    </div>
  );
}
