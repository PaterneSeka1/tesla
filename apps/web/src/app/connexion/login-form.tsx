'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Formulaire visuel uniquement : l'authentification serveur n'est pas encore implémentée.
 * Aucune donnée n'est envoyée ni conservée.
 */
export function LoginForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = () => setSubmitted(true);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full">
        Se connecter
      </Button>
      {submitted && (
        <Alert variant="info" aria-live="polite">
          <Info aria-hidden />
          <AlertDescription>
            La connexion n’est pas encore disponible. Elle sera activée lors de la phase «
            Authentification et comptes ».
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
