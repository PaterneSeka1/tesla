'use client';

import { type PracticeActivity, stableShuffle } from '@tesla/shared';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { type PlayerProps } from './kit';

type Order = Extract<PracticeActivity, { kind: 'order' }>;

/** Mélange stable garantissant un ordre de départ différent de la solution. */
function initialOrder(activity: Order): number[] {
  const indexes = activity.steps.map((_, index) => index);
  const shuffled = stableShuffle(indexes, activity.id);
  return shuffled.every((value, index) => value === index) ? [...indexes].reverse() : shuffled;
}

/**
 * Remise en ordre (frise, procédure) : boutons « monter / descendre » utilisables au toucher et au
 * clavier, sans glisser-déposer. Après vérification, chaque ligne indique si elle est à sa place et
 * le repère (date, numéro) s'affiche ; on peut corriger puis revérifier.
 */
export function OrderPlayer({ activity, onDone }: PlayerProps<Order>) {
  const [order, setOrder] = useState(() => initialOrder(activity));
  const [checked, setChecked] = useState<number[] | null>(null);
  const [moved, setMoved] = useState<number | null>(null);
  const [firstAnswer, setFirstAnswer] = useState<number[] | null>(null);
  const allRight = checked !== null && order.every((value, index) => value === index);

  const move = (position: number, delta: -1 | 1) => {
    const target = position + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[position], next[target]] = [next[target]!, next[position]!];
    setOrder(next);
    setMoved(next[target]!);
    if (checked) setChecked(null);
  };

  const check = () => {
    feedback(order.every((value, index) => value === index) ? 'success' : 'error');
    setChecked([...order]);
    // Première vérification retenue pour la correction (on peut ensuite corriger librement).
    setFirstAnswer((current) => current ?? [...order]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Remettez dans le bon ordre.</p>
      <ol className="space-y-2" aria-label="Éléments à ordonner">
        {order.map((stepIndex, position) => {
          const step = activity.steps[stepIndex]!;
          const ok = checked ? checked[position] === position : null;
          return (
            <li
              key={stepIndex}
              className={cn(
                'flex items-center gap-2 rounded-xl border-2 bg-card py-1.5 pr-1.5 pl-3 transition-colors',
                moved === stepIndex && 'animate-pop',
                ok === true && 'border-emerald-600 bg-emerald-50',
                ok === false && 'border-destructive/60 bg-red-50',
              )}
            >
              <span className="w-5 text-sm text-muted-foreground tabular-nums">{position + 1}</span>
              <span className="min-w-0 flex-1 text-[0.95rem]">
                {step.label}
                {checked && step.marker && (
                  <span className="ml-2 text-xs font-medium text-tesla-rouge">{step.marker}</span>
                )}
              </span>
              {ok === true && <Check className="size-4 text-emerald-700" aria-label="À sa place" />}
              {ok === false && (
                <X className="size-4 text-destructive" aria-label="Pas à sa place" />
              )}
              <span className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={position === 0}
                  onClick={() => move(position, -1)}
                  aria-label={`Monter « ${step.label} »`}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={position === order.length - 1}
                  onClick={() => move(position, 1)}
                  aria-label={`Descendre « ${step.label} »`}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
      {checked && (
        <p role="status" className="text-sm font-medium">
          {allRight ? 'Tout est dans l’ordre !' : 'Certains éléments ne sont pas à leur place.'}
        </p>
      )}
      {allRight ? (
        <Button onClick={() => onDone(firstAnswer ?? order)} autoFocus>
          Terminer
        </Button>
      ) : (
        <Button onClick={check}>Vérifier</Button>
      )}
    </div>
  );
}
