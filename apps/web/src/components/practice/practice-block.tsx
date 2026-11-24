'use client';

import {
  type PracticeActivity,
  PRACTICE_KIND_LABELS,
  practiceItemCount,
  practicePrintLines,
} from '@tesla/shared';
import { Play, Puzzle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActivityRunner } from './activity-runner';

/**
 * Activité intégrée à une leçon (D194) : repliée par défaut pour ne pas encombrer la lecture ;
 * « Commencer » l'ouvre sur place. À l'impression, l'exercice est imprimé sans réponse.
 */
export function PracticeBlock({
  activity,
  moduleSlug,
  onContinue,
}: {
  activity: PracticeActivity;
  moduleSlug?: string;
  /** Séquence dédiée (mode Découverte) : démarrage direct, « Continuer » en fin d'activité. */
  onContinue?: () => void;
}) {
  const [open, setOpen] = useState(!!onContinue);
  const count = practiceItemCount(activity);
  const printable = practicePrintLines(activity);
  return (
    <section
      aria-label={activity.title || PRACTICE_KIND_LABELS[activity.kind]}
      className="not-italic"
    >
      <div className="rounded-2xl border-2 border-tesla-or/50 bg-tesla-sable/20 p-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tesla-or/25 text-tesla-bordeaux">
            <Puzzle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-tesla-bordeaux">
              {activity.title || PRACTICE_KIND_LABELS[activity.kind]}
            </p>
            <p className="text-xs text-muted-foreground">
              {PRACTICE_KIND_LABELS[activity.kind]}
              {count > 1 && ` · ${count}`}
            </p>
          </div>
          {!open && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              <Play aria-hidden />
              Commencer
            </Button>
          )}
        </div>
        {open && (
          <div className="mt-4 border-t border-tesla-or/30 pt-4">
            <ActivityRunner
              compact
              item={{ moduleSlug: moduleSlug ?? '', key: activity.id, activity }}
              onContinue={onContinue}
            />
          </div>
        )}
      </div>
      <div className="hidden space-y-1 print:block">
        <p className="font-semibold">{printable.title}</p>
        {printable.lines.map((line, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
