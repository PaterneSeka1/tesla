'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePasswordInputSchema,
  type ElapsedDuration,
  LEADER_FUNCTION_LABELS,
  PASSWORD_MIN_LENGTH,
  THEORETICAL_STAGE_REASON_LABELS,
} from '@tesla/shared';
import { LoaderCircle, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { type z } from 'zod';
import { MedicalRecordCard } from '@/components/accounts/medical-record-card';
import { useSessionUser } from '@/components/auth/session-gate';
import { FormField, fieldA11y } from '@/components/form-field';
import { PasswordInput } from '@/components/password-input';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import {
  changePassword,
  myProfileQueryOptions,
  revokeOtherSessions,
  revokeSession,
  sessionsQueryOptions,
} from '@/lib/api/accounts';
import { userCan } from '@/lib/navigation';
import { formatDate, formatDateTime } from '@/lib/format';

/**
 * Mon profil (D173) : identité, informations Route et progression en lecture seule (gérées par
 * l'administration ou calculées par l'API) ; compte, mot de passe, fiche médicale et sessions.
 */
export function AccountSettings() {
  const user = useSessionUser();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ProfileOverview />
      </div>
      <AccountCard />
      <PasswordCard />
      {/* Fiche médicale : chaque titulaire habilité ; jamais le compte administrateur (D142). */}
      {userCan(user, 'medicalRecord.own') && (
        <div className="lg:col-span-2">
          <MedicalRecordCard />
        </div>
      )}
      <div className="lg:col-span-2">
        <SessionsCard />
      </div>
    </div>
  );
}

const MILESTONE_LABELS = {
  DEBUT_ETAPE: 'Début d’étape',
  FIN_ETAPE: 'Fin d’étape',
  SORTIE_BRANCHE: 'Sortie de la branche',
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/** Information absente : libellé simple, jamais une valeur fictive (D173). */
function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}

function duration({ years, months }: ElapsedDuration): string {
  const parts = [
    years > 0 && `${years} an${years > 1 ? 's' : ''}`,
    months > 0 && `${months} mois`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' et ') : 'Moins d’un mois';
}

/**
 * Données administratives et valeurs calculées, en lecture seule : renseignées par
 * l'administration, calculées par l'API (âge, ancienneté, étape, échéances).
 */
function ProfileOverview() {
  const profile = useQuery(myProfileQueryOptions);
  if (profile.isPending) return <TableSkeleton rows={4} />;
  if (profile.isError) {
    return <QueryError error={profile.error} onRetry={() => void profile.refetch()} />;
  }
  const { scout, leaderFunction } = profile.data;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Gérée par l’administration : signalez toute erreur à votre responsable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nom">{profile.data.lastName}</Field>
            <Field label="Prénoms">{profile.data.firstName}</Field>
            {scout && (
              <>
                <Field label="Matricule">
                  {scout.matricule ? (
                    <span className="font-mono">{scout.matricule}</span>
                  ) : (
                    <Missing>Matricule non renseigné</Missing>
                  )}
                </Field>
                <Field label="Équipe actuelle">
                  {scout.team?.name ?? <Missing>Sans équipe</Missing>}
                </Field>
              </>
            )}
            {leaderFunction && (
              <Field label="Fonction">{LEADER_FUNCTION_LABELS[leaderFunction]}</Field>
            )}
          </dl>
        </CardContent>
      </Card>

      {scout && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles et Route</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Date de naissance">
                  {scout.birthDate ? (
                    formatDate(scout.birthDate)
                  ) : (
                    <Missing>Date de naissance non renseignée</Missing>
                  )}
                </Field>
                <Field label="Âge">{scout.age === null ? '—' : `${scout.age} ans`}</Field>
                <Field label="Entrée à la Route">
                  {scout.joinedAt ? (
                    formatDate(scout.joinedAt)
                  ) : (
                    <Missing>Date d’entrée non renseignée</Missing>
                  )}
                </Field>
                <Field label="Ancienneté">
                  {scout.seniority ? duration(scout.seniority) : '—'}
                </Field>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Progression</CardTitle>
              <CardDescription>Calculée automatiquement selon l’âge.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Étape actuelle">
                  {scout.stage ? (
                    <Badge variant="accent">{scout.stage.name}</Badge>
                  ) : (
                    <Missing>
                      Étape non déterminée
                      {scout.stageReason !== 'DATE_NAISSANCE_MANQUANTE' && (
                        <span className="block text-xs">
                          {THEORETICAL_STAGE_REASON_LABELS[scout.stageReason]}
                        </span>
                      )}
                    </Missing>
                  )}
                </Field>
                <Field label="Prochaine transition">
                  {scout.nextMilestone ? (
                    <>
                      {MILESTONE_LABELS[scout.nextMilestone.kind]}
                      {scout.nextMilestone.stage && ` (${scout.nextMilestone.stage.name})`} le{' '}
                      {formatDate(scout.nextMilestone.date)}
                    </>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Sortie de la branche">
                  {scout.membership === 'SORTI'
                    ? 'Sorti de la branche'
                    : scout.branchExitOn
                      ? `Prévue le ${formatDate(scout.branchExitOn)}`
                      : '—'}
                </Field>
                <Field label="Modules">
                  {scout.catchUps.open > 0
                    ? `${scout.catchUps.open} à rattraper`
                    : 'Aucun module à rattraper'}
                  {scout.catchUps.acquired > 0 && ` · ${scout.catchUps.acquired} acquis`}
                </Field>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/progression">Ma progression</Link>
                </Button>
                {scout.catchUps.open > 0 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/mes-rattrapages">Mes rattrapages</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AccountCard() {
  const user = useSessionUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compte</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          <Field label="Adresse e-mail">
            <span className="break-all">{user.email}</span>
          </Field>
        </dl>
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
