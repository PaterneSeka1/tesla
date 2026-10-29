'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, fieldA11y } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, meQueryOptions } from '@/lib/api/auth';
import { ROLE_HOME } from '@/lib/spaces';

const loginSchema = z.object({
  email: z.email({ error: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Chemin interne uniquement (évite une redirection ouverte vers un autre site). */
function safeNextPath(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/** Connexion : la session est posée par l'API dans un cookie httpOnly (jamais lisible en JS). */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
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
      router.replace(safeNextPath(searchParams.get('suivant')) ?? ROLE_HOME[me.user.role]);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Connexion impossible.');
    }
  };

  return (
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
        <Input
          type="password"
          autoComplete="current-password"
          {...fieldA11y('password', errors.password?.message)}
          {...register('password')}
        />
      </FormField>
      {serverError && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
