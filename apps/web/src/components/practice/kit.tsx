'use client';

import { Check, X } from 'lucide-react';
import { ProgressBar } from '@/components/progress-bar';
import { cn } from '@/lib/utils';

/**
 * Briques communes des activités (D194) : une proposition, un retour, une progression compacte.
 * L'état n'est jamais indiqué par la seule couleur (icône et texte pour les lecteurs d'écran).
 */
export type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted';

export function ChoiceButton({
  state = 'idle',
  onClick,
  disabled,
  children,
  className,
  ...rest
}: {
  state?: ChoiceState;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<'button'>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'selected' ? true : undefined}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 bg-card px-4 py-3 text-left text-[0.95rem] transition-[border-color,background-color,transform] duration-150 outline-none active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:active:scale-100',
        state === 'idle' && 'border-border hover:border-tesla-or/70 hover:bg-tesla-sable/30',
        state === 'selected' && 'border-tesla-rouge bg-tesla-sable/40',
        state === 'correct' && 'animate-pop border-emerald-600 bg-emerald-50',
        state === 'wrong' && 'animate-shake border-destructive/70 bg-red-50',
        state === 'muted' && 'border-border opacity-60',
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {state === 'correct' && (
        <Check className="size-5 shrink-0 text-emerald-700" aria-label="Bonne réponse" />
      )}
      {state === 'wrong' && (
        <X className="size-5 shrink-0 text-destructive" aria-label="Réponse incorrecte" />
      )}
    </button>
  );
}

/** Retour après une réponse : annoncé aux lecteurs d'écran, explication facultative. */
export function AnswerFeedback({
  correct,
  explanation,
  neutral,
}: {
  correct: boolean;
  explanation?: string;
  /** Retour sans jugement (mise en situation, texte de référence). */
  neutral?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        'animate-enter space-y-1 rounded-xl px-4 py-3 text-sm',
        neutral
          ? 'bg-muted'
          : correct
            ? 'bg-emerald-50 text-emerald-900'
            : 'bg-red-50 text-red-900',
      )}
    >
      {!neutral && <p className="font-semibold">{correct ? 'Bien vu !' : 'Pas tout à fait.'}</p>}
      {explanation && <p className="leading-relaxed">{explanation}</p>}
    </div>
  );
}

/** Progression compacte « 2 / 5 » : la seule information affichée pendant l'activité. */
export function StepProgress({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-3">
      <ProgressBar
        label="Progression dans l’activité"
        value={current}
        max={total}
        tone="or"
        className="h-1.5 flex-1"
        valueText={`${current} sur ${total}`}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}

export interface PlayerProps<A> {
  activity: A;
  /** Texte religieux ou officiel cité : mémorisation sans score ni jugement (§ 34). */
  reverent?: boolean;
  onDone: (answers: (number | boolean | string)[]) => void;
}
