'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DeviceUnlock } from '@/components/offline/device-unlock';
import { login, meQueryOptions } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { vaultExists } from '@/lib/offline/vault';
import { resolvePostLoginPath } from '@/lib/navigation';

const loginSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Connexion : la session est posée par l'API dans un cookie httpOnly (jamais lisible en JS).
 * Un utilisateur déjà connecté est orienté directement vers son tableau de bord (ou la page
 * demandée, si son rôle y a accès) ; une session expirée ou une API injoignable affiche le formulaire.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  // Chaque échec rejoue la secousse de l'alerte (clé React).
  const [failures, setFailures] = useState(0);
  const session = useQuery(meQueryOptions);
  const requested = searchParams.get('suivant');

  useEffect(() => {
    if (session.data) router.replace(resolvePostLoginPath(session.data.user, requested));
  }, [session.data, requested, router]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const me = await login(values);
      queryClient.clear();
      queryClient.setQueryData(meQueryOptions.queryKey, me);
      router.replace(resolvePostLoginPath(me.user, requested));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Connexion impossible.');
      setFailures((count) => count + 1);
    }
  };

  if (session.isPending || session.data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Vérification de la session">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-9" />
      </div>
    );
  }

  const offline = session.error instanceof ApiError && session.error.status === 0;
  return (
    <>
      {offline && <OfflineUnlock />}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            {...fieldA11y('email', errors.email?.message)}
            {...register('email')}
          />
        </FormField>
        <FormField id="password" label="Mot de passe" error={errors.password?.message}>
          <PasswordInput
            autoComplete="current-password"
            {...fieldA11y('password', errors.password?.message)}
            {...register('password')}
          />
        </FormField>
        {serverError && (
          <Alert
            key={failures}
            variant="destructive"
            aria-live="assertive"
            className="animate-shake"
          >
            <CircleAlert aria-hidden />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full transition-transform active:scale-[0.97]"
          disabled={isSubmitting}
        >
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </>
  );
}

/** Sans réseau : ouverture de l'application avec les données déjà préparées sur cet appareil. */
function OfflineUnlock() {
  const [exists, setExists] = useState(false);
  useEffect(() => {
    vaultExists()
      .then(setExists)
      .catch(() => setExists(false));
  }, []);
  if (!exists) return null;
  return (
    <section className="mb-6 space-y-2 rounded-lg border p-4" aria-labelledby="offline-unlock">
      <h2 id="offline-unlock" className="font-semibold">
        Hors connexion
      </h2>
      <DeviceUnlock />
    </section>
  );
}
