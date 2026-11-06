'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  matriculeSchema,
  normalizeMatricule,
  SCOUT_ADMIN_FIELD_LABELS,
  type ScoutAdminField,
  type ScoutDetail,
  THEORETICAL_STAGE_REASON_LABELS,
} from '@tesla/shared';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { OFFLINE_SAVED } from '@/components/progression/use-pedagogy-action';
import { useToast } from '@/components/ui/toaster';
import { OfflineQueuedError } from '@/lib/offline/operations';
import { ApiError } from '@/lib/api/client';
import { birthDateImpactQueryOptions, createScout, updateScout } from '@/lib/api/scouts';
import { activeTeamsQueryOptions } from '@/lib/api/teams';
import { formatDate } from '@/lib/format';

const optionalDate = z
  .string()
  .refine((value) => value === '' || z.iso.date().safeParse(value).success, {
    message: 'Date invalide.',
  });

const formSchema = z.object({
  lastName: z.string().trim().min(1, { error: 'Le nom est requis.' }).max(100),
  firstName: z.string().trim().min(1, { error: 'Les prénoms sont requis.' }).max(100),
  matricule: z.string().refine((value) => matriculeSchema.safeParse(value).success, {
    message: 'Matricule invalide : 7 chiffres suivis d’une lettre (ex. 0000001A).',
  }),
  birthDate: optionalDate,
  joinedAt: optionalDate,
  teamId: z.string(),
  reason: z.string().max(500, { error: '500 caractères au maximum.' }),
  confirmCorrection: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const ADMIN_FIELDS = ['lastName', 'firstName', 'matricule', 'birthDate', 'joinedAt'] as const;

/** Valeur saisie ramenée à la forme enregistrée par l'API (chaîne vide = non renseignée). */
function normalized(field: ScoutAdminField, value: string): string | null {
  if (field === 'matricule') return normalizeMatricule(value);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Champs corrigés : une valeur déjà renseignée remplacée ou retirée (D173). Renseigner une valeur
 * absente est une complétion, sans motif.
 */
function correctedFields(
  scout: ScoutDetail | undefined,
  values: Record<ScoutAdminField, string>,
): ScoutAdminField[] {
  if (!scout) return [];
  return ADMIN_FIELDS.filter((field) => {
    const previous = scout[field];
    return previous !== null && normalized(field, values[field]) !== previous;
  });
}

/** Conséquences d'une date de naissance corrigée, calculées par l'API (aucune écriture). */
function BirthDateImpact({ scoutId, birthDate }: { scoutId: string; birthDate: string }) {
  const impact = useQuery(birthDateImpactQueryOptions(scoutId, birthDate));
  if (!impact.data) return null;
  const { current, next, newCatchUps, catchUpsToReview } = impact.data;
  const stage = (snapshot: typeof current) =>
    snapshot.stage?.name ??
    `non déterminée (${THEORETICAL_STAGE_REASON_LABELS[snapshot.stageReason].toLowerCase()})`;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      <li>
        Étape : {stage(current)} → <strong>{stage(next)}</strong>
      </li>
      <li>
        Âge : {current.age ?? '—'} → <strong>{next.age ?? '—'}</strong>
      </li>
      <li>
        Sortie de la branche : {current.branchExitOn ? formatDate(current.branchExitOn) : '—'} →{' '}
        <strong>{next.branchExitOn ? formatDate(next.branchExitOn) : '—'}</strong>
      </li>
      {newCatchUps > 0 && <li>{newCatchUps} nouveau(x) module(s) à rattraper.</li>}
      {catchUpsToReview > 0 && (
        <li>
          {catchUpsToReview} rattrapage(s) à réexaminer : ils restent enregistrés et attendent une
          décision.
        </li>
      )}
    </ul>
  );
}

/**
 * Inscription (sans `scout`) ou gestion administrative d'une fiche routier (administrateur ou
 * responsable plein). Aucun champ e-mail ni mot de passe : l'inscription ne crée jamais de compte.
 * L'étape ne se saisit pas : elle est calculée par l'API selon l'âge (D173).
 */
export function ScoutForm({
  scout,
  onSaved,
}: {
  scout?: ScoutDetail;
  onSaved: (scout: ScoutDetail) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const teams = useQuery({ ...activeTeamsQueryOptions, enabled: !scout });
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
      lastName: scout?.lastName ?? '',
      firstName: scout?.firstName ?? '',
      matricule: scout?.matricule ?? '',
      birthDate: scout?.birthDate ?? '',
      // Jamais la date du jour par défaut : une date absente reste « non renseignée ».
      joinedAt: scout?.joinedAt ?? '',
      teamId: '',
      reason: '',
      confirmCorrection: false,
    },
  });
  const watched = useWatch({ control, name: ADMIN_FIELDS });
  const current = Object.fromEntries(
    ADMIN_FIELDS.map((field, index) => [field, watched[index] ?? '']),
  ) as Record<ScoutAdminField, string>;
  const corrections = correctedFields(scout, current);
  const birthDate = current.birthDate;
  const birthDateCorrected =
    corrections.includes('birthDate') && z.iso.date().safeParse(birthDate).success;

  const save = async (values: FormValues, confirmDuplicate = false) => {
    if (corrections.length > 0) {
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
      const saved = scout
        ? await updateScout(
            scout.id,
            {
              lastName: values.lastName,
              firstName: values.firstName,
              matricule: values.matricule,
              birthDate: values.birthDate || null,
              joinedAt: values.joinedAt || null,
              ...(corrections.length > 0 && {
                reason: values.reason.trim(),
                confirmCorrection: true as const,
              }),
              expectedUpdatedAt: scout.updatedAt,
            },
            `${scout.firstName} ${scout.lastName}`,
          )
        : await createScout({
            lastName: values.lastName,
            firstName: values.firstName,
            matricule: values.matricule || undefined,
            birthDate: values.birthDate || undefined,
            joinedAt: values.joinedAt || undefined,
            teamId: values.teamId || undefined,
            confirmDuplicate: confirmDuplicate || undefined,
          });
      setDuplicate(null);
      await queryClient.invalidateQueries({ queryKey: ['scouts'] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(
        scout ? 'Fiche modifiée' : 'Routier enregistré',
        `${saved.firstName} ${saved.lastName}`,
      );
      onSaved(saved);
    } catch (error) {
      if (error instanceof OfflineQueuedError) {
        await queryClient.invalidateQueries({ queryKey: ['scouts'] });
        toast.success(OFFLINE_SAVED.title, OFFLINE_SAVED.detail);
        // Création différée : la fiche n'existera qu'après confirmation du serveur.
        if (scout) onSaved(scout);
        else router.push('/administration/routiers');
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === 'POSSIBLE_DUPLICATE') return setDuplicate(values);
        if (error.code === 'MATRICULE_ALREADY_USED') {
          return setError('matricule', { message: error.message });
        }
        if (error.code === 'INVALID_DATE') return setError('joinedAt', { message: error.message });
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
          id="matricule"
          label="Matricule"
          hint="Facultatif. 7 chiffres suivis d’une lettre (ex. 0000001A)."
          error={errors.matricule?.message}
        >
          <Input
            className="font-mono uppercase"
            autoComplete="off"
            maxLength={12}
            {...fieldA11y('matricule', errors.matricule?.message, 'hint')}
            {...register('matricule')}
          />
        </FormField>
        <FormField
          id="birthDate"
          label="Date de naissance"
          hint="Détermine l’étape, calculée automatiquement selon l’âge."
          error={errors.birthDate?.message}
        >
          <Input
            type="date"
            {...fieldA11y('birthDate', errors.birthDate?.message, 'hint')}
            {...register('birthDate')}
          />
        </FormField>
        <FormField
          id="joinedAt"
          label="Date d’entrée à la Route"
          hint="Date réelle d’entrée. Facultative tant qu’elle n’est pas connue."
          error={errors.joinedAt?.message}
        >
          <Input
            type="date"
            {...fieldA11y('joinedAt', errors.joinedAt?.message, 'hint')}
            {...register('joinedAt')}
          />
        </FormField>
        {!scout && (
          <FormField id="teamId" label="Équipe" hint="Facultative.">
            <NativeSelect {...fieldA11y('teamId', undefined, 'hint')} {...register('teamId')}>
              <option value="">Sans équipe</option>
              {teams.data?.items.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      {corrections.length > 0 && (
        <Alert variant="info" aria-live="polite">
          <TriangleAlert aria-hidden />
          <AlertTitle>Correction d’informations déjà renseignées</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {corrections.map((field) => SCOUT_ADMIN_FIELD_LABELS[field]).join(', ')} : l’ancienne
              et la nouvelle valeur seront conservées au journal avec votre motif.
            </p>
            {birthDateCorrected && scout && (
              <BirthDateImpact scoutId={scout.id} birthDate={birthDate} />
            )}
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
                  <span className="block text-destructive">{errors.confirmCorrection.message}</span>
                )}
              </span>
            </label>
          </AlertDescription>
        </Alert>
      )}

      {duplicate && (
        <Alert variant="info" aria-live="polite">
          <TriangleAlert aria-hidden />
          <AlertTitle>Homonyme déjà enregistré</AlertTitle>
          <AlertDescription>
            <p>
              Un routier portant les mêmes nom et prénoms existe déjà. Vérifiez la liste des
              routiers avant de confirmer qu’il s’agit bien d’une autre personne.
            </p>
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
        {isSubmitting
          ? 'Enregistrement…'
          : scout
            ? 'Enregistrer les modifications'
            : 'Enregistrer le routier'}
      </Button>
    </form>
  );
}
