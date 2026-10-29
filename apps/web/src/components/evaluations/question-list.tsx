import {
  type EditorQuestion,
  isObjectiveQuestion,
  QUESTION_TYPE_LABELS,
  SCORING_POLICY_LABELS,
} from '@tesla/shared';
import { Check, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPoints } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Questions d'une version. `showKey` : bonnes réponses, barèmes et critères (chefs, responsable) ;
 * sinon, présentation telle que le routier la verra (aperçu).
 */
export function QuestionList({
  questions,
  showKey,
  actions,
}: {
  questions: EditorQuestion[];
  showKey: boolean;
  actions?: (question: EditorQuestion, index: number) => React.ReactNode;
}) {
  return (
    <ol className="space-y-3">
      {questions.map((question, index) => (
        <li key={question.id} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-tesla-bordeaux">Question {index + 1}</span>
              <Badge variant="secondary">{QUESTION_TYPE_LABELS[question.type]}</Badge>
              {showKey && <Badge variant="outline">{formatPoints(question.points)}</Badge>}
              {showKey && question.type === 'CHOIX_MULTIPLE' && (
                <Badge variant="outline">{SCORING_POLICY_LABELS[question.scoringPolicy]}</Badge>
              )}
            </div>
            {actions?.(question, index)}
          </div>
          <p className="whitespace-pre-line">{question.prompt}</p>
          {isObjectiveQuestion(question.type) ? (
            <ul className="space-y-1.5">
              {question.options.map((option) => {
                const correct = showKey && option.isCorrect;
                return (
                  <li
                    key={option.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                      correct && 'border-tesla-or bg-tesla-sable/40 font-medium',
                    )}
                  >
                    {correct ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
                    ) : (
                      <Square
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span>
                      {option.label}
                      {correct && <span className="sr-only"> (bonne réponse)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {question.type === 'REPONSE_COURTE'
                ? 'Réponse courte rédigée'
                : 'Réponse développée rédigée'}
            </p>
          )}
          {showKey && (question.expectedAnswer || question.guidance) && (
            <dl className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
              {question.expectedAnswer && (
                <div>
                  <dt className="font-medium">Réponse attendue</dt>
                  <dd className="whitespace-pre-line text-muted-foreground">
                    {question.expectedAnswer}
                  </dd>
                </div>
              )}
              {question.guidance && (
                <div>
                  <dt className="font-medium">Critères de correction</dt>
                  <dd className="whitespace-pre-line text-muted-foreground">{question.guidance}</dd>
                </div>
              )}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}
