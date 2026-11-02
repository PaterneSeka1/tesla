'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, MailCheck, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/lib/api/accounts';

const formSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }).max(254),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * « Mot de passe oublié » (D166). La réponse est la même que le compte existe ou non ; le canal
 * affiché dépend seulement de la configuration du serveur : on n'annonce jamais un e-mail qui ne
 * part pas.
 */
export function ForgotPasswordForm() {
  const request = useMutation({ mutationFn: requestPasswordReset });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (request.data) {
    const email = request.data.channel === 'EMAIL';
    return (
      <div className="space-y-4">
        <Alert>
          {email ? <MailCheck aria-hidden /> : <UserRoundCheck aria-hidden />}
          <AlertTitle>Demande reçue</AlertTitle>
          <AlertDescription>
            {email
              ? 'Si un compte actif correspond à ces informations, un lien et un code de récupération viennent d’être envoyés à cette adresse. Ils ne fonctionnent qu’une fois et pendant une durée limitée.'
              : 'Aucun e-mail n’est envoyé par l’application. Contactez votre responsable : après vérification de votre identité, il vous remettra un lien ou un code personnel. Vous choisirez vous-même votre nouveau mot de passe.'}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/reinitialiser-mot-de-passe">J’ai reçu un code</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => request.mutate(values))}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-tesla-bordeaux">Mot de passe oublié ?</h1>
        <p className="text-sm text-muted-foreground">Indiquez l’adresse e-mail de votre compte.</p>
      </div>
      <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          {...fieldA11y('email', errors.email?.message)}
          {...register('email')}
        />
      </FormField>
      {request.isError && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertDescription>{request.error.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={request.isPending}>
        {request.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        Continuer
      </Button>
    </form>
  );
}
