import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  key: string;
  label: string;
}

/**
 * Parcours en étapes ordonnées (affichage seul) : étapes franchies, étape courante, étapes à venir.
 * Horizontal à partir de `sm`, vertical sur mobile. `current` = -1 si aucune étape n'est renseignée.
 */
export function Stepper({
  label,
  steps,
  current,
}: {
  label: string;
  steps: readonly Step[];
  current: number;
}) {
  return (
    <ol aria-label={label} className="flex flex-col gap-3 sm:flex-row sm:gap-0">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'next';
        return (
          <li
            key={step.key}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
          >
            {/* Liaison avec l'étape précédente (horizontale à partir de sm). */}
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-0 left-4 hidden h-0.5 -translate-y-1/2 sm:top-4 sm:right-1/2 sm:left-[-50%] sm:block',
                  index <= current ? 'bg-tesla-rouge' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                state === 'done' && 'border-tesla-rouge bg-tesla-rouge text-white',
                state === 'current' && 'border-tesla-rouge bg-card text-tesla-rouge',
                state === 'next' && 'border-border bg-card text-muted-foreground',
              )}
            >
              {state === 'done' ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-sm',
                  state === 'current'
                    ? 'font-semibold text-tesla-bordeaux'
                    : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {state === 'done' ? ' (franchie)' : state === 'next' ? ' (à venir)' : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
