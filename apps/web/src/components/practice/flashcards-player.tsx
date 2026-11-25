'use client';

import { type PracticeActivity } from '@tesla/shared';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { type PlayerProps, StepProgress, useSaved } from './kit';

type Flashcards = Extract<PracticeActivity, { kind: 'flashcards' }>;

/**
 * Cartes de mémorisation : on se pose la question, on retourne la carte, on indique honnêtement si
 * on savait. Cette auto-évaluation règle seulement la prochaine révision (aucun jugement).
 */
export function FlashcardsPlayer(props: PlayerProps<Flashcards>) {
  const { activity, onDone } = props;
  const [index, setIndex] = useSaved(props, 'index', 0);
  const [flipped, setFlipped] = useSaved(props, 'flipped', false);
  const [answers, setAnswers] = useSaved<number[]>(props, 'answers', [], { variable: true });
  const card = activity.cards[index]!;

  const rate = (knew: boolean) => {
    const next = [...answers, knew ? 1 : 0];
    setAnswers(next);
    feedback(knew ? 'success' : 'error');
    if (index + 1 < activity.cards.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else onDone(next);
  };

  return (
    <div className="space-y-4">
      <StepProgress current={index + 1} total={activity.cards.length} />
      <div key={index} className="flip-card animate-enter" data-flipped={flipped}>
        <button
          type="button"
          onClick={() => setFlipped(!flipped)}
          aria-label={flipped ? 'Revoir la question' : 'Retourner la carte'}
          className="flip-card-inner min-h-52 w-full rounded-2xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            className="flip-card-face flex flex-col justify-between gap-4 rounded-2xl border-2 border-tesla-or/50 bg-card p-5 shadow-sm"
            aria-hidden={flipped}
          >
            <span className="text-lg leading-snug font-medium text-balance">{card.front}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCw className="size-3.5" aria-hidden />
              Toucher pour retourner
            </span>
          </span>
          <span
            className="flip-card-face flip-card-back flex flex-col gap-3 rounded-2xl border-2 border-tesla-rouge/40 bg-tesla-sable/40 p-5 shadow-sm"
            aria-hidden={!flipped}
          >
            <span className="text-xs font-semibold tracking-wide text-tesla-rouge uppercase">
              Réponse
            </span>
            <span className="leading-relaxed whitespace-pre-line">{card.back}</span>
          </span>
        </button>
      </div>
      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => rate(false)}>
            À revoir
          </Button>
          <Button onClick={() => rate(true)} autoFocus>
            Je savais
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setFlipped(true)}>
          Voir la réponse
        </Button>
      )}
    </div>
  );
}
