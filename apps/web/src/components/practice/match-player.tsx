'use client';

import { type PracticeActivity, stableShuffle } from '@tesla/shared';
import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { type ChoiceState, ChoiceButton, type PlayerProps, useSaved } from './kit';

type Match = Extract<PracticeActivity, { kind: 'match' }>;

/**
 * Associations : toucher un élément à gauche puis sa correspondance à droite (clavier : Tab et
 * Entrée). Aucun glisser-déposer requis. Une paire juste se fige ; une erreur se défait aussitôt.
 */
export function MatchPlayer(props: PlayerProps<Match>) {
  const { activity, onDone } = props;
  const rights = useMemo(
    () =>
      stableShuffle(
        activity.pairs.map((_, index) => index),
        activity.id,
      ),
    [activity],
  );
  const [selected, setSelected] = useSaved<number | null>(props, 'selected', null);
  const [matched, setMatched] = useSaved<Record<number, number>>(props, 'matched', {});
  const [firstTry, setFirstTry] = useSaved<Record<number, number>>(props, 'firstTry', {});
  const [wrong, setWrong] = useState<number | null>(null);
  const done = Object.keys(matched).length === activity.pairs.length;

  const pick = (right: number) => {
    if (selected === null) return;
    // Première proposition retenue pour la correction (l'élève peut ensuite corriger).
    if (!(selected in firstTry)) setFirstTry({ ...firstTry, [selected]: right });
    if (right === selected) {
      setMatched({ ...matched, [selected]: right });
      setSelected(null);
      feedback('success');
    } else {
      setWrong(right);
      feedback('error');
      setTimeout(() => setWrong(null), 450);
    }
  };

  const leftState = (index: number): ChoiceState =>
    index in matched ? 'correct' : selected === index ? 'selected' : 'idle';
  const rightState = (index: number): ChoiceState =>
    Object.values(matched).includes(index) ? 'correct' : wrong === index ? 'wrong' : 'idle';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {selected === null
          ? 'Choisissez un élément, puis sa correspondance.'
          : `« ${activity.pairs[selected]!.left} » : choisissez sa correspondance.`}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <ul className="space-y-2.5" aria-label="Éléments">
          {activity.pairs.map((pair, index) => (
            <li key={index}>
              <ChoiceButton
                state={leftState(index)}
                disabled={index in matched}
                onClick={() => setSelected(index)}
                className="text-sm"
              >
                {pair.left}
              </ChoiceButton>
            </li>
          ))}
        </ul>
        <ul className="space-y-2.5" aria-label="Correspondances">
          {rights.map((index) => (
            <li key={index}>
              <ChoiceButton
                state={rightState(index)}
                disabled={Object.values(matched).includes(index) || selected === null}
                onClick={() => pick(index)}
                className={cn('text-sm', selected === null && 'disabled:opacity-100')}
              >
                {activity.pairs[index]!.right}
              </ChoiceButton>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        {done ? (
          <Button
            onClick={() => onDone(activity.pairs.map((_, index) => firstTry[index] ?? -1))}
            autoFocus
          >
            Terminer
          </Button>
        ) : (
          Object.keys(matched).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMatched({});
                setFirstTry({});
                setSelected(null);
              }}
            >
              <RotateCcw aria-hidden />
              Recommencer
            </Button>
          )
        )}
      </div>
    </div>
  );
}
