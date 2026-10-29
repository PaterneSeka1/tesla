'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { matriculeSchema, type ScoutDetail } from '@tesla/shared';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import { createScout, stagesQueryOptions, updateScout } from '@/lib/api/scouts';
import { activeTeamsQueryOptions } from '@/lib/api/teams';
import { todayIsoDate } from '@/lib/format';

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
  joinedAt: z.iso.date({ error: 'La date d’intégration est requise.' }),
  currentStageId: z.string(),
  teamId: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Inscription (sans `scout`) ou modification d'une fiche routier.
 * Aucun champ e-mail ni mot de passe : l'inscription ne crée jamais de compte.
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
  const stages = useQuery(stagesQueryOptions);
  const teams = useQuery({ ...activeTeamsQueryOptions, enabled: !scout });
  const [duplicate, setDuplicate] = useState<FormValues | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lastName: scout?.lastName ?? '',
      firstName: scout?.firstName ?? '',
      matricule: scout?.matricule ?? '',
      birthDate: scout?.birthDate ?? '',
      joinedAt: scout?.joinedAt ?? todayIsoDate(),
      currentStageId: scout?.stage?.id ?? '',
      teamId: '',
    },
  });

  const save = async (values: FormValues, confirmDuplicate = false) => {
    try {
      const saved = scout
        ? await updateScout(scout.id, {
            lastName: values.lastName,
            firstName: values.firstName,
            matricule: values.matricule,
            birthDate: values.birthDate || null,
            joinedAt: values.joinedAt,
            currentStageId: values.currentStageId || null,
          })
        : await createScout({
            lastName: values.lastName,
            firstName: values.firstName,
            matricule: values.matricule || undefined,
            birthDate: values.birthDate || undefined,
            joinedAt: values.joinedAt,
            currentStageId: values.currentStageId || undefined,
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
      if (error instanceof ApiError) {
        if (error.code === 'POSSIBLE_DUPLICATE') return setDuplicate(values);
        if (error.code === 'MATRICULE_ALREADY_USED') {
          return setError('matricule', { message: error.message });
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
          hint="Facultative."
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
          label="Date d’intégration"
          required
          error={errors.joinedAt?.message}
        >
          <Input
            type="date"
            {...fieldA11y('joinedAt', errors.joinedAt?.message)}
            {...register('joinedAt')}
          />
        </FormField>
        <FormField
          id="currentStageId"
          label="Étape de progression"
          hint={scout ? 'Un changement d’étape est un acte officiel, journalisé.' : 'Facultative.'}
        >
          <NativeSelect
            {...fieldA11y('currentStageId', undefined, 'hint')}
            {...register('currentStageId')}
          >
            <option value="">Non renseignée</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
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
