'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  type AgeRuleSet,
  createAgeRuleSetInputSchema,
  type CreateAgeRuleSetInput,
  PROGRESSION_STAGES,
} from '@tesla/shared';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { FormField, fieldA11y } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import { ageRuleSetsQueryOptions, createAgeRuleSet } from '@/lib/api/pathway';

/** Saisie en texte (champs vides autorisés) ; conversion et validation au moment d'enregistrer. */
interface StageRow {
  stageCode: string;
  startYears: string;
  startMonths: string;
  endYears: string;
  endMonths: string;
  sourceReference: string;
}

interface Values {
  version: string;
  sourceReference: string;
  notes: string;
  branchExitAgeYears: string;
  catchUpDelayMonths: string;
  catchUpDelayDays: string;
  exitAlertMonths: string;
  stages: StageRow[];
}

const text = (value: number | null | undefined) => (value == null ? '' : String(value));
const count = (value: string) => (value.trim() === '' ? null : Number(value));

/** Valeurs de départ : copie d'un référentiel existant (à compléter), ou formulaire vide. */
function initialValues(base: AgeRuleSet | null): Values {
  return {
    version: '',
    sourceReference: base?.sourceReference ?? '',
    // Les notes décrivent une version précise : jamais recopiées dans la suivante.
    notes: '',
    branchExitAgeYears: text(base?.branchExitAgeYears),
    catchUpDelayMonths: text(base?.catchUpDelayMonths),
    catchUpDelayDays: text(base?.catchUpDelayDays),
    exitAlertMonths: text(base?.exitAlertMonths),
    stages:
      base?.stages.map((rule) => ({
        stageCode: rule.stageCode,
        startYears: text(rule.start.years),
        startMonths: text(rule.start.months),
        endYears: text(rule.end?.years),
        endMonths: text(rule.end?.months),
        sourceReference: rule.sourceReference,
      })) ?? [],
  };
}

function toInput(values: Values): CreateAgeRuleSetInput {
  return {
    version: values.version,
    sourceReference: values.sourceReference,
    notes: values.notes.trim() === '' ? null : values.notes,
    branchExitAgeYears: count(values.branchExitAgeYears),
    catchUpDelayMonths: count(values.catchUpDelayMonths),
    catchUpDelayDays: count(values.catchUpDelayDays),
    exitAlertMonths: count(values.exitAlertMonths),
    stages: values.stages.map((row) => ({
      stageCode: row.stageCode,
      start: { years: Number(row.startYears), months: Number(row.startMonths || 0) },
      end:
        row.endYears.trim() === '' && row.endMonths.trim() === ''
          ? null
          : { years: Number(row.endYears || 0), months: Number(row.endMonths || 0) },
      sourceReference: row.sourceReference,
    })),
  };
}

/** Champ du formulaire correspondant au chemin d'une erreur du schéma partagé. */
function fieldOf(path: PropertyKey[]): string {
  const [first, index, key, unit] = path.map(String);
  if (first !== 'stages' || index === undefined) return first ?? 'root';
  if (key === 'start' || key === 'end')
    return `stages.${index}.${key}${unit === 'months' ? 'Months' : 'Years'}`;
  return `stages.${index}.${key ?? 'stageCode'}`;
}

/**
 * Nouveau référentiel d'âge (brouillon) : seules les règles confirmées, chacune avec sa source ; un
 * champ laissé vide reste « non arbitré », jamais remplacé par une valeur par défaut (D173).
 * La mise en vigueur est une étape séparée, explicite et définitive.
 */
export function AgeRuleSetForm({ base, onDone }: { base: AgeRuleSet | null; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: initialValues(base) });
  const stages = useFieldArray({ control, name: 'stages' });
  const used = new Set(stages.fields.map((field) => field.stageCode));

  const onSubmit = async (values: Values) => {
    const parsed = createAgeRuleSetInputSchema.safeParse(toInput(values));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // Messages du schéma partagé en français ; type ou bornes numériques : message générique.
        const message =
          issue.code === 'custom' ||
          issue.path.includes('sourceReference') ||
          issue.path[0] === 'version'
            ? issue.message
            : 'Valeur invalide.';
        setError(fieldOf(issue.path) as keyof Values, { message });
      }
      return;
    }
    try {
      await createAgeRuleSet(parsed.data);
      await queryClient.invalidateQueries({ queryKey: ageRuleSetsQueryOptions.queryKey });
      toast.success('Brouillon enregistré', 'Il ne s’applique qu’après sa mise en vigueur.');
      onDone();
    } catch (error) {
      toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
    }
  };

  // Erreur d'un champ de période (chemins dynamiques non typés par React Hook Form).
  const stageError = (index: number, key: keyof StageRow) => errors.stages?.[index]?.[key]?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Nouveau référentiel</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="rules-version" label="Version" error={errors.version?.message} required>
              <Input
                placeholder="2026.2"
                autoComplete="off"
                {...fieldA11y('rules-version', errors.version?.message)}
                {...register('version')}
              />
            </FormField>
            <FormField
              id="rules-source"
              label="Source"
              error={errors.sourceReference?.message}
              required
            >
              <Input
                autoComplete="off"
                {...fieldA11y('rules-source', errors.sourceReference?.message)}
                {...register('sourceReference')}
              />
            </FormField>
          </div>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-tesla-bordeaux">Seuils</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id="rules-exit"
                label="Sortie de la branche (âge)"
                error={errors.branchExitAgeYears?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...fieldA11y('rules-exit', errors.branchExitAgeYears?.message)}
                  {...register('branchExitAgeYears')}
                />
              </FormField>
              <FormField
                id="rules-catchup"
                label="Délai de rattrapage (mois)"
                error={errors.catchUpDelayMonths?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...fieldA11y('rules-catchup', errors.catchUpDelayMonths?.message)}
                  {...register('catchUpDelayMonths')}
                />
              </FormField>
              <FormField
                id="rules-catchup-days"
                label="Délai par étape à rattraper (jours)"
                error={errors.catchUpDelayDays?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...fieldA11y('rules-catchup-days', errors.catchUpDelayDays?.message)}
                  {...register('catchUpDelayDays')}
                />
              </FormField>
              <FormField
                id="rules-alert"
                label="Alerte avant la sortie (mois)"
                error={errors.exitAlertMonths?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...fieldA11y('rules-alert', errors.exitAlertMonths?.message)}
                  {...register('exitAlertMonths')}
                />
              </FormField>
            </div>
            <p className="text-xs text-muted-foreground">Un champ vide reste « non arbitré ».</p>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-tesla-bordeaux">Périodes d’étape</legend>
            <ul className="space-y-3 empty:hidden">
              {stages.fields.map((field, index) => {
                const id = (key: string) => `rules-stage-${index}-${key}`;
                const name = PROGRESSION_STAGES.find(
                  (stage) => stage.code === field.stageCode,
                )?.name;
                return (
                  <li key={field.id} className="space-y-3 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <FormField
                          id={id('stage')}
                          label="Étape"
                          error={stageError(index, 'stageCode')}
                          required
                        >
                          <NativeSelect
                            {...fieldA11y(id('stage'), stageError(index, 'stageCode'))}
                            {...register(`stages.${index}.stageCode`)}
                          >
                            {PROGRESSION_STAGES.map((stage) => (
                              <option key={stage.code} value={stage.code}>
                                {stage.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </FormField>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-6"
                        onClick={() => stages.remove(index)}
                        aria-label={`Retirer la période ${name ?? index + 1}`}
                      >
                        <X aria-hidden />
                        Retirer
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FormField
                        id={id('start-years')}
                        label="Début (ans)"
                        error={stageError(index, 'startYears')}
                        required
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          {...fieldA11y(id('start-years'), stageError(index, 'startYears'))}
                          {...register(`stages.${index}.startYears`)}
                        />
                      </FormField>
                      <FormField
                        id={id('start-months')}
                        label="et (mois)"
                        error={stageError(index, 'startMonths')}
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={11}
                          {...fieldA11y(id('start-months'), stageError(index, 'startMonths'))}
                          {...register(`stages.${index}.startMonths`)}
                        />
                      </FormField>
                      <FormField
                        id={id('end-years')}
                        label="Fin (ans)"
                        error={stageError(index, 'endYears')}
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          {...fieldA11y(id('end-years'), stageError(index, 'endYears'))}
                          {...register(`stages.${index}.endYears`)}
                        />
                      </FormField>
                      <FormField
                        id={id('end-months')}
                        label="et (mois)"
                        error={stageError(index, 'endMonths')}
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={11}
                          {...fieldA11y(id('end-months'), stageError(index, 'endMonths'))}
                          {...register(`stages.${index}.endMonths`)}
                        />
                      </FormField>
                    </div>
                    <FormField
                      id={id('source')}
                      label="Source de la période"
                      error={stageError(index, 'sourceReference')}
                      required
                    >
                      <Input
                        autoComplete="off"
                        {...fieldA11y(id('source'), stageError(index, 'sourceReference'))}
                        {...register(`stages.${index}.sourceReference`)}
                      />
                    </FormField>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Fin exclue ; sans fin, la période dure jusqu’à la sortie.
            </p>
            {stages.fields.length < PROGRESSION_STAGES.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  stages.append({
                    stageCode:
                      PROGRESSION_STAGES.find((stage) => !used.has(stage.code))?.code ??
                      PROGRESSION_STAGES[0].code,
                    startYears: '',
                    startMonths: '',
                    endYears: '',
                    endMonths: '',
                    sourceReference: '',
                  })
                }
              >
                <Plus aria-hidden />
                Ajouter une période
              </Button>
            )}
          </fieldset>

          <FormField id="rules-notes" label="Notes (facultatif)">
            <Textarea rows={2} maxLength={3000} id="rules-notes" {...register('notes')} />
          </FormField>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Enregistrer le brouillon
            </Button>
            <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
