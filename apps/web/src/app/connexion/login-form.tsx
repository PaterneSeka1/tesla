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
import {
  confirmServerUser,
  type LoginVaultResult,
  lockVault,
  openVaultAfterLogin,
  vaultExists,
} from '@/lib/offline/vault';
import { resolvePostLoginPath } from '@/lib/navigation';

const loginSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
  /** Préparer cet appareil pour l'usage sans connexion (appareil personnel). */
  offline: z.boolean().optional(),
});

/** Situations du coffre local qui demandent une explication sur « Cet appareil ». */
const DEVICE_NOTICES: Partial<Record<LoginVaultResult, string>> = {
  created: '/appareil?preparer=1',
  legacy: '/appareil',
  revoked: '/appareil',
  unrecoverable: '/appareil',
};

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Connexion : la session est posée par l'API dans un cookie httpOnly (jamais lisible en JS).
 * Un utilisateur déjà connecté est orienté directement vers son tableau de bord (ou la page
 * demandée, si elle lui est accessible) ; une session expirée ou une API injoignable affiche le formulaire.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  // Chaque échec rejoue la secousse de l'alerte (clé React).
  const [failures, setFailures] = useState(0);
  const session = useQuery(meQueryOptions);
  const [offlineVault, setOfflineVault] = useState<boolean | null>(null);
  const sessionOffline = session.error instanceof ApiError && session.error.status === 0;
  useEffect(() => {
    if (!sessionOffline) return;
    let active = true;
    void vaultExists()
      .then((exists) => active && setOfflineVault(exists))
      .catch(() => active && setOfflineVault(false));
    return () => {
      active = false;
    };
  }, [sessionOffline]);
  const requested = searchParams.get('suivant');

  // Session confirmée seulement : une donnée ancienne conservée après un refus (401) ne compte pas.
  const signedIn = session.status === 'success' ? session.data : undefined;
  // Connexion faite depuis ce formulaire : la redirection est décidée par `onSubmit` (« Cet
  // appareil » le cas échéant), pas par cet effet.
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (signedIn && !submitted) router.replace(resolvePostLoginPath(signedIn.user, requested));
  }, [signedIn, submitted, requested, router]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const me = await login({ email: values.email, password: values.password });
      // Coffre d'un autre compte encore ouvert sur cet appareil : verrouillé avant toute lecture.
      await confirmServerUser(me.user).catch(() => lockVault());
      // Mot de passe unique (D180) : le mot de passe que le serveur vient de vérifier ouvre (ou
      // reprotège après un changement) les données de cet appareil ; il n'est conservé nulle part.
      // Un échec local n'empêche jamais la connexion.
      let target: string | undefined;
      try {
        const vault = await openVaultAfterLogin(me.user, values.password, {
          prepare: values.offline === true,
        });
        target = DEVICE_NOTICES[vault];
      } catch {
        // Préparation demandée mais impossible (stockage, limite d'appareils) : explication sur la page.
        if (values.offline) target = '/appareil';
      }
      setSubmitted(true);
      queryClient.clear();
      queryClient.setQueryData(meQueryOptions.queryKey, me);
      router.replace(target ?? resolvePostLoginPath(me.user, requested));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Connexion impossible.');
      setFailures((count) => count + 1);
    }
  };

  if (session.isPending || signedIn) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Vérification de la session">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-9" />
      </div>
    );
  }

  const offline = session.error instanceof ApiError && session.error.status === 0;
  // Sans réseau sur un appareil préparé : seul le déverrouillage local a un sens (un seul champ
  // « Mot de passe », jamais deux).
  if (offline && offlineVault === true) {
    return (
      <section className="space-y-4" aria-label="Hors connexion">
        <DeviceUnlock />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void session.refetch()}
          disabled={session.isFetching}
        >
          Réessayer la connexion à Internet
        </Button>
      </section>
    );
  }
  return (
    <>
      {offline && offlineVault === false && (
        <Alert className="mb-4">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Pas de connexion à Internet. Cet appareil n’a pas été préparé pour une utilisation sans
            connexion : connectez-vous dès que le réseau revient.
          </AlertDescription>
        </Alert>
      )}
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
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-tesla-rouge"
            {...register('offline')}
          />
          <span>
            Utiliser aussi cet appareil sans connexion
            <span className="block text-muted-foreground">
              Appareil personnel uniquement. Le même mot de passe ouvrira vos contenus hors ligne.
            </span>
          </span>
        </label>
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
