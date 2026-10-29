'use client';
import { type AttemptSession, isObjectiveQuestion } from '@tesla/shared';
import { Textarea } from '@/components/ui/textarea';
export function AnswerFields({
  question,
  answer,
  onChange,
  disabled = false,
}: {
  question: AttemptSession['questions'][number];
  answer: { optionIds: string[]; text: string };
  onChange: (answer: { optionIds: string[]; text: string }) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 font-semibold whitespace-pre-line">{question.prompt}</legend>
      {isObjectiveQuestion(question.type) ? (
        <>
          <p className="text-sm text-muted-foreground">
            {question.type === 'CHOIX_MULTIPLE'
              ? 'Plusieurs réponses possibles.'
              : 'Une seule réponse.'}
          </p>
          {question.options.map((option) => (
            <label key={option.id} className="flex min-h-12 items-center gap-3 rounded border p-3">
              <input
                type={question.type === 'CHOIX_MULTIPLE' ? 'checkbox' : 'radio'}
                name={question.id}
                checked={answer.optionIds.includes(option.id)}
                onChange={(event) =>
                  onChange({
                    ...answer,
                    optionIds:
                      question.type !== 'CHOIX_MULTIPLE'
                        ? [option.id]
                        : event.target.checked
                          ? [...answer.optionIds, option.id]
                          : answer.optionIds.filter((id) => id !== option.id),
                  })
                }
              />
              {option.label}
            </label>
          ))}
        </>
      ) : (
        <>
          <label htmlFor={`answer-${question.id}`}>Votre réponse</label>
          <Textarea
            id={`answer-${question.id}`}
            maxLength={5000}
            rows={5}
            value={answer.text}
            onChange={(event) => onChange({ ...answer, text: event.target.value })}
          />
        </>
      )}
    </fieldset>
  );
}
