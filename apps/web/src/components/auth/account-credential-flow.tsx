'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  type AccountCredential,
  type AccountTokenInfo,
  type AccountTokenPurpose,
  activationCodeSchema,
} from '@tesla/shared';
import { CircleAlert, CircleCheck, KeyRound, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ACCOUNT_LINK_PAGES,
  completeAccountCredential,
  verifyAccountCredential,
} from '@/lib/api/accounts';
import { formatDateTime } from '@/lib/format';
import { PasswordChoiceForm } from './password-choice-form';

const TEXTS: Record<
  AccountTokenPurpose,
  { title: string; intro: string; submit: string; done: string; codeLabel: string }
> = {
  ACTIVATION: {
    title: 'Activer mon compte',
    intro:
      'L’accès à Nikola Tesla Académie est réservé aux membres préalablement enregistrés. Utilisez le lien ou le code d’activation transmis par votre responsable.',
    submit: 'Activer mon compte',
    done: 'Compte activé',
    codeLabel: 'Code d’activation',
  },
  REINITIALISATION: {
    title: 'Nouveau mot de passe',
    intro:
      'Utilisez le lien ou le code de récupération reçu. Il ne fonctionne qu’une fois et pendant une durée limitée.',
    submit: 'Enregistrer le mot de passe',
    done: 'Mot de passe modifié',
    codeLabel: 'Code de récupération',
  },
};

const codeFormSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }).max(254),
  code: activationCodeSchema,
});

type CodeForm = z.input<typeof codeFormSchema>;

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

/**
 * Parcours en deux étapes (D162, D166). Étape 1 : vérification du lien (automatique) ou de
 * l'e-mail et du code, sans rien consommer. Étape 2 : le titulaire choisit son mot de passe ; la
 * preuve est revérifiée et consommée par le serveur. L'étape 2 n'existe qu'après une vérification
 * réussie ; aucune fiche n'est créée ni demandée.
 */
export function AccountCredentialFlow({ purpose }: { purpose: AccountTokenPurpose }) {
  const texts = TEXTS[purpose];
  const token = useLinkToken();
  const [credential, setCredential] = useState<AccountCredential | null>(null);
  const verify = useMutation({
    mutationFn: (input: AccountCredential) => verifyAccountCredential(purpose, input),
    onSuccess: (_info, input) => setCredential(input),
  });
  const complete = useMutation({
    mutationFn: (password: string) =>
      completeAccountCredential(purpose, { ...credential!, password }),
    onSuccess: () => {
      // Preuve consommée : elle ne reste ni dans l'adresse ni dans l'historique du navigateur.
      window.history.replaceState(null, '', ACCOUNT_LINK_PAGES[purpose]);
      setCredential(null);
    },
  });

  const { mutate: verifyToken } = verify;
  useEffect(() => {
    if (token) verifyToken({ token });
  }, [token, verifyToken]);

  if (token === undefined || (token && verify.isPending)) {
    return <Skeleton className="h-48" aria-label="Vérification en cours" />;
  }
  if (complete.isSuccess) {
    return (
      <div className="space-y-4">
        <Alert>
          <CircleCheck aria-hidden />
          <AlertTitle>{texts.done}</AlertTitle>
          <AlertDescription>
            Connectez-vous avec votre adresse e-mail et le mot de passe que vous venez de choisir.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }
  if (credential && verify.data) {
    return (
      <PasswordStep
        info={verify.data}
        texts={texts}
        pending={complete.isPending}
        error={complete.error?.message ?? null}
        onSubmit={(password) => complete.mutate(password)}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-tesla-bordeaux">{texts.title}</h1>
        <p className="text-sm text-muted-foreground">{texts.intro}</p>
      </div>
      {token && verify.isError && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertTitle>Lien inutilisable</AlertTitle>
          <AlertDescription>
            {verify.error.message} Vous pouvez aussi saisir le code reçu ci-dessous.
          </AlertDescription>
        </Alert>
      )}
      <CodeStep
        label={texts.codeLabel}
        pending={verify.isPending}
        error={!token && verify.isError ? verify.error.message : null}
        onSubmit={(values) => verify.mutate(values)}
      />
    </div>
  );
}

function CodeStep({
  label,
  pending,
  error,
  onSubmit,
}: {
  label: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: { email: string; code: string }) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeForm, unknown, z.output<typeof codeFormSchema>>({
    resolver: zodResolver(codeFormSchema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          {...fieldA11y('email', errors.email?.message)}
          {...register('email')}
        />
      </FormField>
      <FormField
        id="code"
        label={label}
        hint="10 caractères, par exemple ABCDE-12345."
        error={errors.code?.message}
      >
        <Input
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
          {...fieldA11y('code', errors.code?.message, 'hint')}
          {...register('code')}
        />
      </FormField>
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
        Vérifier le code
      </Button>
    </form>
  );
}

function PasswordStep({
  info,
  texts,
  pending,
  error,
  onSubmit,
}: {
  info: AccountTokenInfo;
  texts: (typeof TEXTS)[AccountTokenPurpose];
  pending: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-tesla-bordeaux">{texts.title}</h1>
        <p className="text-sm text-muted-foreground">
          Bonjour {info.firstName}. Choisissez votre mot de passe : personne d’autre ne le
          connaîtra. Valable jusqu’au {formatDateTime(info.expiresAt)}.
        </p>
      </div>
      <PasswordChoiceForm
        submitLabel={texts.submit}
        pending={pending}
        error={error}
        onSubmit={onSubmit}
      />
    </div>
  );
}
