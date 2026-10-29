'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { type EditorEvaluationDetail } from '@tesla/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { moduleOptionsQueryOptions } from '@/lib/api/evaluations';
import { stagesQueryOptions } from '@/lib/api/scouts';

const optionalInteger = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && +value >= min && +value <= max), {
      message,
    });

/** Mêmes limites que les schémas de @tesla/shared ; l'API revalide. */
const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { error: '3 caractères au minimum.' })
    .max(150, { error: '150 caractères au maximum.' }),
  instructions: z.string().trim().max(3000, { error: '3 000 caractères au maximum.' }),
  stageId: z.string().min(1, { error: 'Choisissez l’étape concernée.' }),
  moduleId: z.string(),
  durationMinutes: optionalInteger(1, 600, 'Nombre de minutes entre 1 et 600.'),
  maxAttempts: optionalInteger(1, 20, 'Nombre entre 1 et 20.'),
});

type FormValues = z.infer<typeof formSchema>;

export interface EvaluationSettings {
  title: string;
  instructions: string;
  stageId: string;
  moduleId: string | null;
  durationMinutes: number | null;
  maxAttempts: number | null;
}

/**
 * Informations du questionnaire. L'étape (éligibilité) et le module sont figés après la première
 * publication (`settingsLocked`). Aucun seuil de réussite : non arbitré par le responsable.
 */
export function EvaluationSettingsForm({
  evaluation,
  disabled = false,
  submitLabel,
  onSubmit,
}: {
  evaluation?: EditorEvaluationDetail;
  disabled?: boolean;
  submitLabel: string;
  onSubmit: (values: EvaluationSettings) => Promise<void>;
}) {
  const stages = useQuery(stagesQueryOptions);
  const modules = useQuery(moduleOptionsQueryOptions);
  const settingsLocked = evaluation ? !evaluation.settingsEditable : false;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      title: evaluation?.current.title ?? '',
      instructions: evaluation?.current.instructions ?? '',
      stageId: evaluation?.stage.id ?? '',
      moduleId: evaluation?.module?.id ?? '',
      durationMinutes: evaluation?.current.durationMinutes
        ? String(evaluation.current.durationMinutes)
        : '',
      maxAttempts: evaluation?.current.maxAttempts ? String(evaluation.current.maxAttempts) : '',
    },
  });

  const submit = (values: FormValues) =>
    onSubmit({
      title: values.title,
      instructions: values.instructions,
      stageId: values.stageId,
      moduleId: values.moduleId || null,
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
      maxAttempts: values.maxAttempts ? Number(values.maxAttempts) : null,
    });

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
      <fieldset disabled={disabled || isSubmitting} className="space-y-4">
        <FormField id="evaluation-title" label="Titre" required error={errors.title?.message}>
          <Input {...fieldA11y('evaluation-title', errors.title?.message)} {...register('title')} />
        </FormField>
        <FormField
          id="evaluation-instructions"
          label="Consignes"
          hint="Affichées avant le questionnaire et imprimées sur la feuille papier."
          error={errors.instructions?.message}
        >
          <Textarea
            {...fieldA11y('evaluation-instructions', errors.instructions?.message, 'hint')}
            rows={3}
            {...register('instructions')}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="evaluation-stage"
            label="Étape concernée"
            required
            hint={
              settingsLocked
                ? 'Figée après la première publication.'
                : 'Détermine l’éligibilité des routiers.'
            }
            error={errors.stageId?.message}
          >
            <NativeSelect
              {...fieldA11y('evaluation-stage', errors.stageId?.message, 'hint')}
              disabled={settingsLocked}
              {...register('stageId')}
            >
              <option value="">Choisir…</option>
              {stages.data?.items.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="evaluation-module"
            label="Module évalué"
            hint={
              settingsLocked
                ? 'Figé après la première publication.'
                : 'Facultatif. Le module devra être publié avant l’évaluation.'
            }
          >
            <NativeSelect
              {...fieldA11y('evaluation-module', undefined, 'hint')}
              disabled={settingsLocked}
              {...register('moduleId')}
            >
              <option value="">Aucun</option>
              {modules.data?.items.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.code} — {module.title}
                  {module.published ? '' : ' (non publié)'}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="evaluation-duration"
            label="Durée indicative (minutes)"
            error={errors.durationMinutes?.message}
          >
            <Input
              {...fieldA11y('evaluation-duration', errors.durationMinutes?.message)}
              inputMode="numeric"
              {...register('durationMinutes')}
            />
          </FormField>
          <FormField
            id="evaluation-attempts"
            label="Tentatives maximum par routier"
            hint="Vide = sans limite. Les tentatives annulées ne comptent pas."
            error={errors.maxAttempts?.message}
          >
            <Input
              {...fieldA11y('evaluation-attempts', errors.maxAttempts?.message, 'hint')}
              inputMode="numeric"
              {...register('maxAttempts')}
            />
          </FormField>
        </div>
        <Button type="submit" disabled={disabled || isSubmitting || (!!evaluation && !isDirty)}>
          {isSubmitting ? 'Enregistrement…' : submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
