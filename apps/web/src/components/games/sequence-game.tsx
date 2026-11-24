'use client';

import { BookOpen, Flag } from 'lucide-react';
import Link from 'next/link';
import { ActivityRunner } from '@/components/practice/activity-runner';
import { Button } from '@/components/ui/button';
import { type GameSession } from '@/lib/game-session';
import { type BankEntry, entryId } from '@/lib/games';

export interface SequenceData {
  /** Activités choisies à l'ouverture, avec la version de leur contenu. */
  picked: { id: string; fingerprint: string }[];
  index: number;
  done: boolean;
}

/** Une partie enregistrée n'est reprise que si toutes ses activités sont inchangées. */
export function sequenceStillValid(data: SequenceData, entries: readonly BankEntry[]) {
  const byId = new Map(entries.map((entry) => [entryId(entry), entry.fingerprint]));
  return (
    data.picked.length > 0 &&
    data.index >= 0 &&
    data.index < data.picked.length &&
    data.picked.every((item) => byId.get(item.id) === item.fingerprint)
  );
}

/**
 * Enchaînement d'activités : une à la fois, reprise à l'activité en cours (fermeture, changement
 * de jour, coupure réseau), lien discret vers la leçon d'origine pour revoir la notion.
 */
export function SequenceGame({
  session,
  entries,
  exitHref,
  onUpdate,
  onRestart,
  onFinish,
}: {
  session: GameSession<SequenceData>;
  entries: readonly BankEntry[];
  exitHref: string;
  onUpdate: (data: SequenceData) => void;
  onRestart: () => void;
  onFinish: () => void;
}) {
  const byId = new Map(entries.map((entry) => [entryId(entry), entry]));
  const picked = session.data.picked.map((item) => byId.get(item.id)!).filter(Boolean);
  const { index, done } = session.data;

  if (done)
    return (
      <div className="animate-achieve space-y-4 rounded-2xl border bg-card p-5 text-center">
        <Flag className="mx-auto size-8 text-tesla-rouge" aria-hidden />
        <p className="text-lg font-semibold text-tesla-bordeaux">Défi terminé</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={exitHref}>Autres défis</Link>
          </Button>
          <Button variant="outline" onClick={onRestart}>
            Nouvelle partie
          </Button>
        </div>
      </div>
    );

  const entry = picked[index]!;
  const last = index + 1 >= picked.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {picked.length > 1 && (
          <span className="tabular-nums">
            {index + 1} / {picked.length}
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
      <div key={`${session.id}:${index}`} className="animate-enter">
        <ActivityRunner
          item={entry}
          continueLabel={last ? 'Terminer' : 'Activité suivante'}
          onContinue={() => {
            if (last) {
              onUpdate({ ...session.data, done: true });
              onFinish();
            } else onUpdate({ ...session.data, index: index + 1 });
          }}
        />
      </div>
    </div>
  );
}
