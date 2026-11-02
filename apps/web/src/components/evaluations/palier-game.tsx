'use client';

import { type AttemptSession } from '@tesla/shared';
import { Flag, Mountain, Send, SkipForward, Trophy } from 'lucide-react';
import Link from 'next/link';
import { AnswerFields } from '@/components/evaluations/answer-fields';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Un palier toutes les trois questions (présentation uniquement, sans effet sur la notation). */
export const PALIER_SIZE = 3;

/** Jokers « passer » : la question est reportée, jamais retirée ni révélée (D140). */
export const PALIER_SKIPS = 2;

type Answer = { optionIds: string[]; text: string };

export const isAnsweredValue = (answer: Answer | undefined) =>
  !!answer && (answer.optionIds.length > 0 || answer.text.trim() !== '');

/** Paliers franchis : nombre de groupes de questions entièrement répondus, dans l'ordre de l'auteur. */
export function reachedPaliers(answered: readonly boolean[]): number {
  let paliers = 0;
  for (let start = 0; start < answered.length; start += PALIER_SIZE) {
    if (!answered.slice(start, start + PALIER_SIZE).every(Boolean)) break;
    paliers++;
  }
  return paliers;
}

/** Prochaine question sans réponse après `from` (en boucle), ou null si tout est répondu. */
export function nextUnanswered(answered: readonly boolean[], from: number): number | null {
  for (let step = 1; step <= answered.length; step++) {
    const index = (from + step) % answered.length;
    if (!answered[index]) return index;
  }
  return null;
}

/**
 * Mode jeu à paliers (D140) : même tentative, mêmes questions dans l'ordre de l'auteur (difficulté
 * croissante choisie à la rédaction), même sauvegarde, même remise et même correction que le mode
 * classique. Aucun corrigé n'est connu de l'appareil : la progression récompense les réponses
 * données, le score est communiqué selon la règle habituelle (après examen).
 */
export function PalierGame({
  session,
  index,
  answers,
  skipsLeft,
  saving,
  onAnswer,
  onValidate,
  onSkip,
  onGoTo,
  onSubmit,
}: {
  session: AttemptSession;
  index: number;
  answers: Record<string, Answer>;
  skipsLeft: number;
  saving: boolean;
  onAnswer: (value: Partial<Answer>) => void;
  onValidate: () => void;
  onSkip: () => void;
  onGoTo: (index: number) => void;
  onSubmit: () => Promise<boolean>;
}) {
  const questions = session.questions;
  const question = questions[index]!;
  const answer = answers[question.id] ?? { optionIds: [], text: '' };
  const answered = questions.map((q) => isAnsweredValue(answers[q.id]));
  const answeredCount = answered.filter(Boolean).length;
  const paliers = Math.ceil(questions.length / PALIER_SIZE);
  const reached = reachedPaliers(answered);
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-tesla-bordeaux p-3 text-white">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Mountain className="size-5 text-tesla-or" aria-hidden />
            Palier {Math.min(reached + 1, paliers)} / {paliers}
          </span>
          <span className="text-sm text-tesla-sable">
            Question {index + 1} / {questions.length}
          </span>
        </div>

        <section
          key={question.id}
          className="animate-pop space-y-4 rounded-lg border bg-card p-4 sm:p-6"
        >
          <AnswerFields question={question} answer={answer} onChange={onAnswer} />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {allAnswered ? (
            <ConfirmDialog
              trigger={
                <Button size="lg" disabled={saving}>
                  <Send aria-hidden />
                  Terminer la partie
                </Button>
              }
              title="Terminer et remettre vos réponses ?"
              description="Toutes les questions ont une réponse. Après la remise, elles ne seront plus modifiables."
              confirmLabel="Remettre définitivement"
              onConfirm={onSubmit}
            />
          ) : (
            <Button size="lg" disabled={saving || !isAnsweredValue(answer)} onClick={onValidate}>
              <Flag aria-hidden />
              Valider et continuer
            </Button>
          )}
          {!allAnswered && (
            <Button
              variant="outline"
              disabled={saving || skipsLeft === 0 || answeredCount >= questions.length - 1}
              onClick={onSkip}
            >
              <SkipForward aria-hidden />
              Passer pour plus tard ({skipsLeft})
            </Button>
          )}
        </div>
      </div>

      <nav aria-label="Échelle des questions">
        <ol className="flex flex-col-reverse gap-1">
          {questions.map((q, position) => {
            const milestone =
              (position + 1) % PALIER_SIZE === 0 || position === questions.length - 1;
            return (
              <li
                key={q.id}
                className="animate-rise"
                style={{ '--stagger': position } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => onGoTo(position)}
                  aria-current={position === index ? 'step' : undefined}
                  aria-label={`Question ${position + 1}${answered[position] ? ', répondue' : ''}`}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    position === index
                      ? 'bg-tesla-or font-semibold text-tesla-bordeaux'
                      : answered[position]
                        ? 'bg-tesla-sable/60 text-tesla-bordeaux'
                        : 'text-muted-foreground hover:bg-muted',
                    milestone && 'border border-tesla-or/70',
                  )}
                >
                  <span>Question {position + 1}</span>
                  {milestone && <Trophy className="size-4" aria-label="Palier" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/** Écran final : paliers franchis et rappel honnête de la règle de communication du score. */
export function PalierFinish({ answered }: { answered: readonly boolean[] }) {
  const paliers = Math.ceil(answered.length / PALIER_SIZE);
  const reached = reachedPaliers(answered);
  const count = answered.filter(Boolean).length;
  return (
    <section className="animate-pop space-y-4 rounded-lg border bg-tesla-bordeaux p-6 text-center text-white">
      <Trophy className="mx-auto size-12 text-tesla-or" aria-hidden />
      <h2 className="text-2xl font-semibold">Partie terminée !</h2>
      <p className="text-tesla-sable">
        {reached} palier{reached > 1 ? 's' : ''} franchi{reached > 1 ? 's' : ''} sur {paliers} ·{' '}
        {count} réponse{count > 1 ? 's' : ''} sur {answered.length}
      </p>
      <p className="text-sm text-tesla-sable">
        Vos réponses sont corrigées comme pour le mode classique. Votre score apparaîtra dans « Mes
        résultats » dès qu’il vous sera communiqué.
      </p>
      <Button asChild variant="secondary">
        <Link href="/mes-resultats">Mes résultats</Link>
      </Button>
    </section>
  );
}
