'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ADULT_ADMIN_FIELDS,
  SCOUT_ADMIN_FIELD_LABELS,
  SCOUT_SEXES,
  type ScoutDetail,
  type ScoutSex,
} from '@tesla/shared';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { useSessionUser } from '@/components/auth/session-gate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import { OFFLINE_SAVED } from '@/components/progression/use-pedagogy-action';
import { ApiError } from '@/lib/api/client';
import { createAdult, updateScout } from '@/lib/api/scouts';
import { OfflineQueuedError } from '@/lib/offline/operations';
import { userCan } from '@/lib/navigation';

const formSchema = z.object({
  lastName: z.string().trim().min(1, { error: 'Le nom est requis.' }).max(100),
  firstName: z.string().trim().min(1, { error: 'Les prénoms sont requis.' }).max(100),
  sex: z.union([z.literal(''), z.enum(SCOUT_SEXES)]),
  reason: z.string().max(500, { error: '500 caractères au maximum.' }),
  confirmCorrection: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Fiche d'un apprenant adulte (D185) : nom, prénoms et sexe seulement. Aucune date, aucune étape,
 * aucune équipe. En modification, changer une valeur déjà renseignée est une correction motivée et
 * journalisée (D173).
 */
export function AdultForm({
  adult,
  onSaved,
}: {
  adult?: ScoutDetail;
  onSaved: (adult: ScoutDetail) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [duplicate, setDuplicate] = useState<FormValues | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lastName: adult?.lastName ?? '',
      firstName: adult?.firstName ?? '',
      sex: adult?.sex ?? '',
      reason: '',
      confirmCorrection: false,
    },
  });
  // Responsable plein en fonction (D188) : correction directe, sans motif ni confirmation.
  const direct = userCan(useSessionUser(), 'scout.correctDirectly');
  const watched = useWatch({ control, name: ADULT_ADMIN_FIELDS });
  const corrections = adult
    ? ADULT_ADMIN_FIELDS.filter((field, index) => {
        const previous = adult[field];
        const next = (watched[index] ?? '').trim();
        return previous !== null && next !== previous;
      })
    : [];

  const save = async (values: FormValues, confirmDuplicate = false) => {
    if (!values.sex && (!adult || adult.sex)) {
      return setError('sex', { message: 'Indiquez le sexe (homme ou femme).' });
    }
    if (corrections.length > 0 && !direct) {
      if (values.reason.trim().length < 5) {
        return setError('reason', {
          message: 'Indiquez le motif de la correction (5 caractères au minimum).',
        });
      }
      if (!values.confirmCorrection) {
        return setError('confirmCorrection', { message: 'Confirmez la correction.' });
      }
    }
    try {
      const saved = adult
        ? await updateScout(
            adult.id,
            {
              lastName: values.lastName,
              firstName: values.firstName,
              sex: values.sex || undefined,
              ...(corrections.length > 0 &&
                !direct && {
                  reason: values.reason.trim(),
                  confirmCorrection: true as const,
                }),
              expectedUpdatedAt: adult.updatedAt,
            },
            `${adult.firstName} ${adult.lastName}`,
          )
        : await createAdult({
            lastName: values.lastName,
            firstName: values.firstName,
            // Présence vérifiée ci-dessus.
            sex: values.sex as ScoutSex,
            confirmDuplicate: confirmDuplicate || undefined,
          });
      setDuplicate(null);
      await queryClient.invalidateQueries({ queryKey: ['scouts'] });
      toast.success(
        adult ? 'Fiche modifiée' : 'Adulte enregistré',
        `${saved.firstName} ${saved.lastName}`,
      );
      onSaved(saved);
    } catch (error) {
      if (error instanceof OfflineQueuedError && adult) {
        await queryClient.invalidateQueries({ queryKey: ['scouts'] });
        toast.success(OFFLINE_SAVED.title, OFFLINE_SAVED.detail);
        onSaved(adult);
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === 'POSSIBLE_DUPLICATE') return setDuplicate(values);
        if (error.status === 403) {
          return toast.error('Vous n’êtes pas autorisé à effectuer cette opération.');
        }
      }
      toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => save(values))}
      noValidate
      className="max-w-2xl space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="lastName" label="Nom" required error={errors.lastName?.message}>
          <Input
            autoComplete="off"
            {...fieldA11y('lastName', errors.lastName?.message)}
            {...register('lastName')}
          />
        </FormField>
        <FormField id="firstName" label="Prénoms" required error={errors.firstName?.message}>
          <Input
            autoComplete="off"
            {...fieldA11y('firstName', errors.firstName?.message)}
            {...register('firstName')}
          />
        </FormField>
        <FormField
          id="sex"
          label="Sexe"
          required={!adult || adult.sex !== null}
          error={errors.sex?.message}
        >
          <NativeSelect {...fieldA11y('sex', errors.sex?.message)} {...register('sex')}>
            {!adult?.sex && <option value="">{adult ? 'Non renseigné' : 'Choisir…'}</option>}
            {SCOUT_SEXES.map((sex) => (
              <option key={sex} value={sex}>
                {adultSexLabel(sex)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      {corrections.length > 0 && (
        <Alert variant="info" aria-live="polite">
          <TriangleAlert aria-hidden />
          <AlertTitle>Correction d’informations déjà renseignées</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {corrections.map((field) => SCOUT_ADMIN_FIELD_LABELS[field]).join(', ')} : l’ancienne
              et la nouvelle valeur seront conservées au journal
              {direct ? '.' : ' avec votre motif.'}
            </p>
            {!direct && (
              <>
                <FormField
                  id="reason"
                  label="Motif de la correction"
                  required
                  error={errors.reason?.message}
                >
                  <Textarea
                    rows={2}
                    className="w-full"
                    {...fieldA11y('reason', errors.reason?.message)}
                    {...register('reason')}
                  />
                </FormField>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-tesla-rouge"
                    aria-invalid={errors.confirmCorrection ? true : undefined}
                    {...register('confirmCorrection')}
                  />
                  <span>
                    Je confirme cette correction.
                    {errors.confirmCorrection && (
                      <span className="block text-destructive">
                        {errors.confirmCorrection.message}
                      </span>
                    )}
                  </span>
                </label>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {duplicate && (
        <Alert variant="info" aria-live="polite">
          <TriangleAlert aria-hidden />
          <AlertTitle>Homonyme déjà enregistré</AlertTitle>
          <AlertDescription>
            <p>Mêmes nom et prénoms. Confirmez seulement s’il s’agit d’une autre personne.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={() => void save(duplicate, true)}
              >
                Confirmer l’inscription
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDuplicate(null)}>
                Annuler
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : adult ? 'Enregistrer' : 'Enregistrer l’adulte'}
      </Button>
    </form>
  );
}

/**
 * Libellé du sexe d'un adulte : « Homme » / « Femme ». Les valeurs restent celles de D183
 * (`GARCON`, `FILLE`) ; seul le libellé change.
 */
export function adultSexLabel(sex: ScoutSex): string {
  return sex === 'GARCON' ? 'Homme' : 'Femme';
}
