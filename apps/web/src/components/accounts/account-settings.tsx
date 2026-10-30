'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePasswordInputSchema,
  PASSWORD_MIN_LENGTH,
  LEADER_FUNCTION_LABELS,
  updateProfileInputSchema,
} from '@tesla/shared';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { FormField, fieldA11y } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toaster';
import {
  changePassword,
  revokeOtherSessions,
  revokeSession,
  sessionsQueryOptions,
  updateProfile,
} from '@/lib/api/accounts';
import { meQueryOptions } from '@/lib/api/auth';
import { formatDateTime } from '@/lib/format';

/** Compte personnel : nom affiché, mot de passe, sessions ouvertes (serveur requis). */
export function AccountSettings() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard />
      <PasswordCard />
      <div className="lg:col-span-2">
        <SessionsCard />
      </div>
    </div>
  );
}

type ProfileValues = z.input<typeof updateProfileInputSchema>;

function ProfileCard() {
  const user = useSessionUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });
  const onSubmit = async (values: ProfileValues) => {
    try {
      const me = await updateProfile(values);
      queryClient.setQueryData(meQueryOptions.queryKey, me);
      reset(values);
      toast.success('Profil enregistré');
    } catch (error) {
      toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <dl className="grid gap-1 text-sm">
            <dt className="text-muted-foreground">Adresse e-mail</dt>
            <dd className="break-all">{user.email}</dd>
            {user.leaderFunction && (
              <>
                <dt className="mt-2 text-muted-foreground">Fonction</dt>
                <dd>{LEADER_FUNCTION_LABELS[user.leaderFunction]}</dd>
              </>
            )}
          </dl>
          <FormField id="firstName" label="Prénom" error={errors.firstName?.message} required>
            <Input
              autoComplete="given-name"
              {...fieldA11y('firstName', errors.firstName?.message)}
              {...register('firstName')}
            />
          </FormField>
          <FormField id="lastName" label="Nom" error={errors.lastName?.message} required>
            <Input
              autoComplete="family-name"
              {...fieldA11y('lastName', errors.lastName?.message)}
              {...register('lastName')}
            />
          </FormField>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type PasswordValues = z.input<typeof changePasswordInputSchema>;

function PasswordCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordValues>({ resolver: zodResolver(changePasswordInputSchema) });
  const onSubmit = async (values: PasswordValues) => {
    try {
      await changePassword(values);
      reset();
      await queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey });
      toast.success('Mot de passe modifié', 'Vos autres sessions ont été fermées.');
    } catch (error) {
      toast.error('Modification impossible', error instanceof Error ? error.message : undefined);
    }
  };
  const hint = `${PASSWORD_MIN_LENGTH} caractères au minimum.`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            id="currentPassword"
            label="Mot de passe actuel"
            error={errors.currentPassword?.message}
            required
          >
            <PasswordInput
              autoComplete="current-password"
              {...fieldA11y('currentPassword', errors.currentPassword?.message)}
              {...register('currentPassword')}
            />
          </FormField>
          <FormField
            id="newPassword"
            label="Nouveau mot de passe"
            hint={hint}
            error={errors.newPassword?.message}
            required
          >
            <PasswordInput
              autoComplete="new-password"
              {...fieldA11y('newPassword', errors.newPassword?.message, hint)}
              {...register('newPassword')}
            />
          </FormField>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
            Modifier le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const sessions = useQuery(sessionsQueryOptions);
  const toast = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey });
  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await refresh();
      toast.success('Session fermée');
    },
    onError: (error) => toast.error('Opération impossible', error.message),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async ({ revoked }) => {
      await refresh();
      toast.success(revoked > 0 ? `${revoked} session(s) fermée(s)` : 'Aucune autre session');
    },
    onError: (error) => toast.error('Opération impossible', error.message),
  });
  const others = sessions.data?.items.filter((session) => !session.current).length ?? 0;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Sessions ouvertes</CardTitle>
        {others > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => revokeOthers.mutate()}
            disabled={revokeOthers.isPending}
          >
            <LogOut aria-hidden />
            Fermer les autres sessions
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <TableSkeleton rows={2} />
        ) : sessions.isError ? (
          <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y">
            {sessions.data.items.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-words">
                    {session.userAgent ?? 'Navigateur inconnu'}{' '}
                    {session.current && <Badge variant="secondary">Cet appareil</Badge>}
                  </p>
                  <p className="text-muted-foreground">
                    Ouverte le {formatDateTime(session.createdAt)}
                    {session.lastUsedAt && ` · utilisée le ${formatDateTime(session.lastUsedAt)}`}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeOne.mutate(session.id)}
                    disabled={revokeOne.isPending}
                  >
                    Fermer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
