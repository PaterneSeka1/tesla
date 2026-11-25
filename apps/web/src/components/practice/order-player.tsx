'use client';

import { type PracticeActivity, stableShuffle } from '@tesla/shared';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { type PlayerProps, useSaved } from './kit';

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
const TEMPORAL = /\b\d{3,4}\b|siècle|janv|févr|mars|avril|mai|juin|juil|août|sept|oct|nov|déc/i;

export function OrderPlayer(props: PlayerProps<Order>) {
  const { activity, onDone } = props;
  const [order, setOrder] = useSaved(props, 'order', () => initialOrder(activity));
  const [checked, setChecked] = useSaved<number[] | null>(props, 'checked', null);
  const [moved, setMoved] = useState<number | null>(null);
  const [firstAnswer, setFirstAnswer] = useSaved<number[] | null>(props, 'firstAnswer', null);
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
    if (firstAnswer === null) setFirstAnswer([...order]);
  };

  // Véritable chronologie (D206) : chaque étape porte un repère temporel (année, mois, siècle).
  // Un simple numéro reste une remise en ordre.
  const timeline = activity.steps.every((step) => !!step.marker && TEMPORAL.test(step.marker));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {timeline
          ? 'Replacez les événements du plus ancien au plus récent.'
          : 'Remettez dans le bon ordre.'}
      </p>
      <ol
        className={cn('space-y-2', timeline && 'relative pl-6')}
        aria-label={timeline ? 'Frise chronologique' : 'Éléments à ordonner'}
      >
        {timeline && (
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-2 w-1 rounded-full bg-gradient-to-b from-tesla-sable via-tesla-or to-tesla-rouge"
          />
        )}
        {order.map((stepIndex, position) => {
          const step = activity.steps[stepIndex]!;
          const ok = checked ? checked[position] === position : null;
          return (
            <li
              key={stepIndex}
              className={cn(
                'relative flex items-center gap-2 rounded-xl border-2 bg-card py-1.5 pr-1.5 pl-3 transition-colors',
                moved === stepIndex && 'animate-pop',
                ok === true && 'border-emerald-600 bg-emerald-50',
                ok === false && 'border-destructive/60 bg-red-50',
              )}
            >
              {timeline ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 -left-[1.4rem] size-3.5 -translate-y-1/2 rounded-full border-2 border-card',
                    ok === null ? 'bg-tesla-or' : ok ? 'bg-emerald-600' : 'bg-destructive',
                  )}
                />
              ) : (
                <span className="w-5 text-sm text-muted-foreground tabular-nums">
                  {position + 1}
                </span>
              )}
              <span className="min-w-0 flex-1 text-[0.95rem]">
                {/* Repère révélé à la vérification : il éclaire l'ordre sans le donner d'avance. */}
                {checked && step.marker && (
                  <span className="animate-enter mr-2 inline-block rounded bg-tesla-sable px-1.5 text-xs font-semibold text-tesla-rouge tabular-nums">
                    {step.marker}
                  </span>
                )}
                {step.label}
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
