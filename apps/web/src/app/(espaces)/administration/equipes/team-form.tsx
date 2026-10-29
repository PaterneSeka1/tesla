'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { type TeamDetail } from '@tesla/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import { createTeam, updateTeam } from '@/lib/api/teams';

/** Mêmes limites que `createTeamInputSchema` ; la normalisation (description vide → null) est faite par l'API. */
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Le nom est requis.' })
    .max(80, { error: '80 caractères au maximum.' }),
  description: z.string().trim().max(500, { error: '500 caractères au maximum.' }),
});

type FormValues = z.infer<typeof formSchema>;

/** Création (sans `team`) ou modification d'une équipe. */
export function TeamForm({
  team,
  onSaved,
  onCancel,
}: {
  team?: TeamDetail;
  onSaved: (team: TeamDetail) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: team?.name ?? '', description: team?.description ?? '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const saved = team ? await updateTeam(team.id, values) : await createTeam(values);
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(team ? 'Équipe modifiée' : 'Équipe créée', saved.name);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TEAM_NAME_TAKEN') {
        setError('name', { message: error.message });
        return;
      }
      toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl space-y-4">
      <FormField id="team-name" label="Nom" required error={errors.name?.message}>
        <Input
          maxLength={80}
          {...fieldA11y('team-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>
      <FormField
        id="team-description"
        label="Description"
        hint="Facultative, 500 caractères au maximum."
        error={errors.description?.message}
      >
        <Textarea
          maxLength={500}
          {...fieldA11y('team-description', errors.description?.message, 'hint')}
          {...register('description')}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : team ? 'Enregistrer' : 'Créer l’équipe'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
