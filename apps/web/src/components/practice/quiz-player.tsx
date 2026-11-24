'use client';

import { type PracticeActivity } from '@tesla/shared';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { AnswerFeedback, ChoiceButton, type PlayerProps, StepProgress } from './kit';

type Quiz = Extract<PracticeActivity, { kind: 'quiz' }>;
type TrueFalse = Extract<PracticeActivity, { kind: 'truefalse' }>;

/** Questions à choix et vrai ou faux : une question à la fois, retour immédiat, aucune minuterie. */
export function QuizPlayer({ activity, onDone }: PlayerProps<Quiz | TrueFalse>) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | boolean)[]>([]);
  const [hint, setHint] = useState(false);
  const items = activity.kind === 'quiz' ? activity.items : activity.items;
  const answer = answers[index];
  const answered = answer !== undefined;

  const question =
    activity.kind === 'quiz'
      ? {
          prompt: activity.items[index]!.prompt,
          options: activity.items[index]!.options.map((label, value) => ({ label, value })),
          expected: activity.items[index]!.answer as number | boolean,
          explanation: activity.items[index]!.explanation,
          hint: activity.items[index]!.hint,
        }
      : {
          prompt: activity.items[index]!.statement,
          options: [
            { label: 'Vrai', value: true },
            { label: 'Faux', value: false },
          ],
          expected: activity.items[index]!.answer as number | boolean,
          explanation: activity.items[index]!.explanation,
          hint: undefined,
        };

  const choose = (value: number | boolean) => {
    if (answered) return;
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
    feedback(value === question.expected ? 'success' : 'error');
  };

  const advance = () => {
    setHint(false);
    if (index + 1 < items.length) setIndex(index + 1);
    else onDone(answers);
  };

  return (
    <div className="space-y-4">
      <StepProgress current={index + 1} total={items.length} />
      <div key={index} className="animate-enter space-y-4">
        <p className="text-lg leading-snug font-medium text-balance">{question.prompt}</p>
        <div
          className={activity.kind === 'truefalse' ? 'grid grid-cols-2 gap-3' : 'grid gap-2.5'}
          role="group"
          aria-label="Propositions"
        >
          {question.options.map((option) => (
            <ChoiceButton
              key={String(option.value)}
              onClick={() => choose(option.value)}
              disabled={answered}
              className={activity.kind === 'truefalse' ? 'justify-center text-center' : undefined}
              state={
                !answered
                  ? 'idle'
                  : option.value === question.expected
                    ? 'correct'
                    : option.value === answer
                      ? 'wrong'
                      : 'muted'
              }
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
        {!answered && question.hint && (
          <div>
            {hint ? (
              <p className="animate-enter rounded-xl bg-tesla-sable/40 px-4 py-3 text-sm">
                {question.hint}
              </p>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setHint(true)}>
                <Lightbulb aria-hidden />
                Un indice
              </Button>
            )}
          </div>
        )}
        {answered && (
          <AnswerFeedback
            correct={answer === question.expected}
            explanation={question.explanation}
          />
        )}
      </div>
      {answered && (
        <Button className="w-full sm:w-auto" onClick={advance} autoFocus>
          {index + 1 < items.length ? 'Suivant' : 'Terminer'}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}
