'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
  MODULE_OBLIGATION_LABELS,
  MODULE_OBLIGATIONS,
  type ModuleCategory,
  type ModuleObligation,
  moduleTypologyError,
  type ModuleVersionDetail,
} from '@tesla/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { stagesQueryOptions } from '@/lib/api/scouts';

/** Mêmes limites que les schémas de @tesla/shared ; l'API revalide et normalise. */
const formSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { error: '3 caractères au minimum.' })
      .max(150, { error: '150 caractères au maximum.' }),
    summary: z.string().trim().max(2000, { error: '2 000 caractères au maximum.' }),
    stageId: z.string(),
    theme: z.string().trim().max(80, { error: '80 caractères au maximum.' }),
    durationMinutes: z
      .string()
      .trim()
      .refine((value) => value === '' || (/^\d+$/.test(value) && +value >= 1 && +value <= 6000), {
        message: 'Nombre de minutes entre 1 et 6 000.',
      }),
    prerequisites: z.string().trim().max(2000, { error: '2 000 caractères au maximum.' }),
    objectives: z
      .string()
      .refine((value) => lines(value).length <= 20, { message: '20 objectifs au maximum.' })
      .refine((value) => lines(value).every((line) => line.length <= 300), {
        message: '300 caractères au maximum par objectif.',
      }),
    category: z.enum(['', ...MODULE_CATEGORIES]),
    obligation: z.enum(['', ...MODULE_OBLIGATIONS]),
    officialSource: z.string().trim().max(500, { error: '500 caractères au maximum.' }),
  })
  .superRefine((values, context) => {
    const message = moduleTypologyError({
      category: values.category || null,
      obligation: values.obligation || null,
      stageId: values.stageId || null,
      officialSource: values.officialSource || null,
    });
    if (message) context.addIssue({ code: 'custom', message, path: ['obligation'] });
  });

type FormValues = z.infer<typeof formSchema>;

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Valeurs envoyées à l'API (création ou modification du brouillon). */
export interface ModuleMetadata {
  title: string;
  summary: string;
  objectives: string[];
  prerequisites: string | null;
  durationMinutes: number | null;
  stageId: string | null;
  theme: string | null;
  category: ModuleCategory | null;
  obligation: ModuleObligation | null;
  officialSource: string | null;
}

export function ModuleMetadataForm({
  version,
  disabled = false,
  submitLabel,
  onSubmit,
}: {
  version?: ModuleVersionDetail;
  disabled?: boolean;
  submitLabel: string;
  /** Renvoie un message d'erreur de champ éventuel (ex. titre). */
  onSubmit: (values: ModuleMetadata) => Promise<void>;
}) {
  const stages = useQuery(stagesQueryOptions);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      title: version?.title ?? '',
      summary: version?.summary ?? '',
      stageId: version?.stage?.id ?? '',
      theme: version?.theme ?? '',
      durationMinutes: version?.durationMinutes ? String(version.durationMinutes) : '',
      prerequisites: version?.prerequisites ?? '',
      objectives: version?.objectives.join('\n') ?? '',
      category: version?.category ?? '',
      obligation: version?.obligation ?? '',
      officialSource: version?.officialSource ?? '',
    },
  });

  const submit = (values: FormValues) =>
    onSubmit({
      title: values.title,
      summary: values.summary,
      objectives: lines(values.objectives),
      prerequisites: values.prerequisites || null,
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
      stageId: values.stageId || null,
      theme: values.theme || null,
      category: values.category || null,
      obligation: values.obligation || null,
      officialSource: values.officialSource || null,
    });

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField
            id="module-title"
            label="Titre du module"
            required
            error={errors.title?.message}
          >
            <Input
              maxLength={150}
              {...fieldA11y('module-title', errors.title?.message)}
              {...register('title')}
            />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField id="module-summary" label="Description" error={errors.summary?.message}>
            <Textarea
              rows={3}
              maxLength={2000}
              {...fieldA11y('module-summary', errors.summary?.message, 'hint')}
              {...register('summary')}
            />
          </FormField>
        </div>
        <FormField
          id="module-stage"
          label="Étape recommandée"
          hint="Indication de lecture : tous les routiers peuvent consulter le module."
        >
          <NativeSelect {...fieldA11y('module-stage', undefined, 'hint')} {...register('stageId')}>
            <option value="">Toutes les étapes</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="module-category"
          label="Catégorie"
          hint="Découverte (toutes étapes), parcours d’étape ou complémentaire."
        >
          <NativeSelect
            {...fieldA11y('module-category', undefined, 'hint')}
            {...register('category')}
          >
            <option value="">À classer</option>
            {MODULE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {MODULE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="module-obligation"
          label="Caractère obligatoire"
          hint="« Obligatoire » exige un module d’étape et une source officielle."
          error={errors.obligation?.message}
        >
          <NativeSelect
            {...fieldA11y('module-obligation', errors.obligation?.message, 'hint')}
            {...register('obligation')}
          >
            <option value="">Non précisé</option>
            {MODULE_OBLIGATIONS.map((obligation) => (
              <option key={obligation} value={obligation}>
                {MODULE_OBLIGATION_LABELS[obligation]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="md:col-span-2">
          <FormField
            id="module-source"
            label="Source officielle"
            hint="Document de référence (titre, édition, pages). Vide : contenu éditorial non homologué."
            error={errors.officialSource?.message}
          >
            <Input
              maxLength={500}
              {...fieldA11y('module-source', errors.officialSource?.message, 'hint')}
              {...register('officialSource')}
            />
          </FormField>
        </div>
        <FormField
          id="module-theme"
          label="Thème"
          hint="Libellé libre facultatif (ex. Vie en équipe)."
          error={errors.theme?.message}
        >
          <Input
            maxLength={80}
            {...fieldA11y('module-theme', errors.theme?.message, 'hint')}
            {...register('theme')}
          />
        </FormField>
        <FormField
          id="module-duration"
          label="Durée indicative (minutes)"
          error={errors.durationMinutes?.message}
        >
          <Input
            inputMode="numeric"
            {...fieldA11y('module-duration', errors.durationMinutes?.message)}
            {...register('durationMinutes')}
          />
        </FormField>
        <div className="md:col-span-2">
          <FormField
            id="module-objectives"
            label="Objectifs pédagogiques"
            hint="Un objectif par ligne (20 au maximum)."
            error={errors.objectives?.message}
          >
            <Textarea
              rows={4}
              {...fieldA11y('module-objectives', errors.objectives?.message, 'hint')}
              {...register('objectives')}
            />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField
            id="module-prerequisites"
            label="Prérequis"
            error={errors.prerequisites?.message}
          >
            <Textarea
              rows={2}
              maxLength={2000}
              {...fieldA11y('module-prerequisites', errors.prerequisites?.message)}
              {...register('prerequisites')}
            />
          </FormField>
        </div>
      </fieldset>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || (version && !isDirty)}>
            {isSubmitting ? 'Enregistrement…' : submitLabel}
          </Button>
          {version && isDirty && (
            <span className="text-sm text-tesla-rouge" role="status">
              Modifications non enregistrées
            </span>
          )}
        </div>
      )}
    </form>
  );
}
