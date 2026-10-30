'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { newPasswordSchema, PASSWORD_MIN_LENGTH } from '@tesla/shared';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { completeAccountLink, inspectAccountLink } from '@/lib/api/accounts';

const formSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    message: 'Les deux saisies ne correspondent pas.',
    path: ['confirmation'],
  });

type FormValues = z.infer<typeof formSchema>;

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/**
 * Jeton lu dans le fragment de l'adresse (jamais envoyé au serveur web ni journalisé).
 * `undefined` pendant le rendu serveur, `null` si absent.
 */
function useLinkToken(): string | null | undefined {
  return useSyncExternalStore(
    subscribeToHash,
    () => {
      try {
        return decodeURIComponent(window.location.hash.slice(1)) || null;
      } catch {
        return null;
      }
    },
    () => undefined,
  );
}

export function ActivationForm() {
  const token = useLinkToken();
  const info = useQuery({
    queryKey: ['account-link', token],
    queryFn: () => inspectAccountLink(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
  const complete = useMutation({
    mutationFn: (password: string) => completeAccountLink({ token: token!, password }),
    onSuccess: () => {
      // Le jeton est consommé : il ne reste pas dans l'historique du navigateur.
      window.history.replaceState(null, '', '/activation');
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (token === undefined || (token && info.isPending)) {
    return <Skeleton className="h-48" aria-label="Vérification du lien" />;
  }
  if (complete.isSuccess) {
    return (
      <div className="space-y-4">
        <Alert>
          <CircleCheck aria-hidden />
          <AlertTitle>Mot de passe enregistré</AlertTitle>
          <AlertDescription>Vous pouvez maintenant vous connecter.</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }
  if (!token || info.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>Lien inutilisable</AlertTitle>
        <AlertDescription>
          {info.error?.message ??
            'Ce lien est incomplet. Demandez un nouveau lien à la personne qui gère votre compte.'}
        </AlertDescription>
      </Alert>
    );
  }

  const activation = info.data?.purpose === 'ACTIVATION';
  return (
    <form
      onSubmit={handleSubmit((values) => complete.mutate(values.password))}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-tesla-bordeaux">
          {activation ? 'Activer votre compte' : 'Nouveau mot de passe'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Bonjour {info.data?.firstName}. Ce lien ne fonctionne qu’une fois.
        </p>
      </div>
      <FormField
        id="password"
        label="Mot de passe"
        hint={`${PASSWORD_MIN_LENGTH} caractères au minimum. Une phrase facile à retenir convient.`}
        error={errors.password?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          {...fieldA11y(
            'password',
            errors.password?.message,
            `${PASSWORD_MIN_LENGTH} caractères au minimum`,
          )}
          {...register('password')}
        />
      </FormField>
      <FormField id="confirmation" label="Confirmation" error={errors.confirmation?.message}>
        <PasswordInput
          autoComplete="new-password"
          {...fieldA11y('confirmation', errors.confirmation?.message)}
          {...register('confirmation')}
        />
      </FormField>
      {complete.isError && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertDescription>{complete.error.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={complete.isPending}>
        {complete.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
