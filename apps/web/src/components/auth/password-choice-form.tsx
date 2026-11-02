'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { newPasswordSchema, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@tesla/shared';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const formSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    message: 'Les deux saisies ne correspondent pas.',
    path: ['confirmation'],
  });

type FormValues = z.infer<typeof formSchema>;

/**
 * Choix d'un mot de passe par son titulaire, commun à l'activation et à la récupération (D162,
 * D166). Phrases de passe, Unicode, sans règle de composition ; aucune troncature (le champ ne
 * limite pas la saisie, le schéma signale un dépassement). Le mot de passe ne quitte le formulaire
 * que vers l'API.
 */
export function PasswordChoiceForm({
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const hint = `${PASSWORD_MIN_LENGTH} à ${PASSWORD_MAX_LENGTH} caractères. Une phrase facile à retenir convient, espaces et accents compris.`;
  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.password))}
      noValidate
      className="space-y-4"
    >
      <FormField
        id="password"
        label="Nouveau mot de passe"
        hint={hint}
        error={errors.password?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          {...fieldA11y('password', errors.password?.message, hint)}
          {...register('password')}
        />
      </FormField>
      <FormField
        id="confirmation"
        label="Confirmer le mot de passe"
        error={errors.confirmation?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          {...fieldA11y('confirmation', errors.confirmation?.message)}
          {...register('confirmation')}
        />
      </FormField>
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden />}
        {submitLabel}
      </Button>
    </form>
  );
}
