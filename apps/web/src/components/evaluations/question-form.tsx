'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type EditorQuestion,
  isObjectiveQuestion,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type QuestionFormInput,
  questionFormSchema,
  type QuestionType,
  SCORING_POLICIES,
  SCORING_POLICY_LABELS,
} from '@tesla/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { type z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

export type QuestionValues = z.output<typeof questionFormSchema>;

const TRUE_FALSE = [
  { label: 'Vrai', isCorrect: true },
  { label: 'Faux', isCorrect: false },
];

const emptyOptions = (type: QuestionType) =>
  type === 'VRAI_FAUX'
    ? TRUE_FALSE
    : isObjectiveQuestion(type)
      ? [
          { label: '', isCorrect: true },
          { label: '', isCorrect: false },
        ]
      : [];

/**
 * Création ou modification d'une question : énoncé, type, barème, propositions et bonnes réponses,
 * critères de correction. Mêmes règles que l'API (`questionFormSchema` de @tesla/shared).
 */
export function QuestionForm({
  question,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  question?: EditorQuestion;
  submitLabel: string;
  /** Renvoie `true` si l'enregistrement a réussi (le formulaire est alors réinitialisé). */
  onSubmit: (values: QuestionValues) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const id = useId();
  const defaults: QuestionFormInput = question
    ? {
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        scoringPolicy: question.scoringPolicy,
        options: question.options.map(({ label, isCorrect }) => ({ label, isCorrect })),
        guidance: question.guidance ?? '',
        expectedAnswer: question.expectedAnswer ?? '',
        acceptedAnswers: question.acceptedAnswers,
      }
    : {
        type: 'CHOIX_UNIQUE',
        prompt: '',
        points: 1,
        scoringPolicy: 'TOUT_OU_RIEN',
        options: emptyOptions('CHOIX_UNIQUE'),
        guidance: '',
        expectedAnswer: '',
        acceptedAnswers: [],
      };
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormInput, unknown, QuestionValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: defaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });
  const type = useWatch({ control, name: 'type' });
  const options = useWatch({ control, name: 'options' }) ?? [];
  const objective = isObjectiveQuestion(type);
  const singleAnswer = type === 'CHOIX_UNIQUE' || type === 'VRAI_FAUX';

  const markCorrect = (index: number, checked: boolean) => {
    options.forEach((_, other) => {
      if (singleAnswer) setValue(`options.${other}.isCorrect`, other === index);
      else if (other === index) setValue(`options.${other}.isCorrect`, checked);
    });
  };

  const submit = async (values: QuestionValues) => {
    if (await onSubmit(values)) reset(question ? undefined : defaults);
  };

  const optionsError = errors.options?.message ?? errors.options?.root?.message;

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField id={`${id}-type`} label="Type de question" required>
          <NativeSelect
            id={`${id}-type`}
            {...register('type', {
              // Les propositions dépendent du type : on repart d'une base cohérente.
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                setValue('options', emptyOptions(event.target.value as QuestionType));
                if (event.target.value !== 'REPONSE_COURTE') setValue('acceptedAnswers', []);
              },
            })}
          >
            {QUESTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {QUESTION_TYPE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id={`${id}-points`}
          label="Barème (points)"
          required
          error={errors.points?.message}
        >
          <Input
            {...fieldA11y(`${id}-points`, errors.points?.message)}
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            {...register('points', { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <FormField
        id={`${id}-prompt`}
        label={type === 'VRAI_FAUX' ? 'Affirmation' : 'Énoncé'}
        required
        error={errors.prompt?.message}
      >
        <Textarea
          {...fieldA11y(`${id}-prompt`, errors.prompt?.message)}
          rows={3}
          maxLength={2000}
          {...register('prompt')}
        />
      </FormField>

      {type === 'CHOIX_MULTIPLE' && (
        <FormField
          id={`${id}-policy`}
          label="Notation"
          hint="Crédit partiel : (bonnes cochées − mauvaises cochées) ÷ nombre de bonnes réponses, jamais négatif."
        >
          <NativeSelect
            {...fieldA11y(`${id}-policy`, undefined, 'hint')}
            {...register('scoringPolicy')}
          >
            {SCORING_POLICIES.map((value) => (
              <option key={value} value={value}>
                {SCORING_POLICY_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      )}

      {objective && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {type === 'VRAI_FAUX' ? 'Bonne réponse' : 'Propositions'}
            <span className="ml-1 font-normal text-muted-foreground">
              {singleAnswer ? '(cochez la bonne réponse)' : '(cochez toutes les bonnes réponses)'}
            </span>
          </legend>
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-center gap-2">
                <input
                  type={singleAnswer ? 'radio' : 'checkbox'}
                  name={`${id}-correct`}
                  className="size-4 accent-tesla-rouge"
                  checked={options[index]?.isCorrect ?? false}
                  onChange={(event) => markCorrect(index, event.target.checked)}
                  aria-label={`Proposition ${index + 1} correcte`}
                />
                {type === 'VRAI_FAUX' ? (
                  <span className="text-sm">{field.label}</span>
                ) : (
                  <>
                    <Input
                      aria-label={`Proposition ${index + 1}`}
                      aria-invalid={errors.options?.[index]?.label ? true : undefined}
                      maxLength={500}
                      {...register(`options.${index}.label`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 2}
                      aria-label={`Retirer la proposition ${index + 1}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {type !== 'VRAI_FAUX' && fields.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ label: '', isCorrect: false })}
            >
              <Plus aria-hidden />
              Ajouter une proposition
            </Button>
          )}
          {optionsError && (
            <p className="text-sm text-destructive" role="alert">
              {optionsError}
            </p>
          )}
        </fieldset>
      )}

      {type === 'REPONSE_COURTE' && (
        <Controller
          control={control}
          name="acceptedAnswers"
          render={({ field }) => {
            const message = errors.acceptedAnswers?.message ?? errors.acceptedAnswers?.[0]?.message;
            return (
              <FormField
                id={`${id}-accepted`}
                label="Variantes acceptées (une par ligne)"
                hint="Majuscules et espaces ignorés, accents conservés. Sans variante correspondante, un chef note la réponse."
                error={message}
              >
                <LinesTextarea
                  {...fieldA11y(`${id}-accepted`, message, 'hint')}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormField>
            );
          }}
        />
      )}

      {!objective && (
        <FormField
          id={`${id}-expected`}
          label="Réponse ou éléments de réponse attendus"
          hint="Jamais affichée au routier."
          error={errors.expectedAnswer?.message}
        >
          <Textarea
            {...fieldA11y(`${id}-expected`, errors.expectedAnswer?.message, 'hint')}
            rows={3}
            maxLength={2000}
            {...register('expectedAnswer')}
          />
        </FormField>
      )}

      <FormField
        id={`${id}-guidance`}
        label="Critères de correction"
        hint="Facultatif. Imprimés sur le corrigé, jamais sur la feuille du routier."
        error={errors.guidance?.message}
      >
        <Textarea
          {...fieldA11y(`${id}-guidance`, errors.guidance?.message, 'hint')}
          rows={2}
          maxLength={2000}
          {...register('guidance')}
        />
      </FormField>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Liste saisie ligne par ligne : le texte brut est conservé pendant la frappe (lignes vides comprises). */
function LinesTextarea({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
  value: readonly string[];
  onChange: (lines: string[]) => void;
}) {
  const [raw, setRaw] = useState(() => value.join('\n'));
  const [synced, setSynced] = useState(value);
  // Valeur remplacée de l'extérieur (réinitialisation, changement de type) : le texte la reprend.
  if (value !== synced) {
    setSynced(value);
    if (toLines(raw).join('\n') !== value.join('\n')) setRaw(value.join('\n'));
  }
  return (
    <Textarea
      {...props}
      rows={3}
      value={raw}
      onChange={(event) => {
        setRaw(event.target.value);
        onChange(toLines(event.target.value));
      }}
    />
  );
}
