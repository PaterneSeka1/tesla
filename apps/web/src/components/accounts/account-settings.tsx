'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  changePasswordInputSchema,
  type ElapsedDuration,
  LEADER_FUNCTION_LABELS,
  type MyProfile,
  PASSWORD_MIN_LENGTH,
  STAGE_STATUS_SHORT_LABELS,
} from '@tesla/shared';
import { LoaderCircle } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { changePassword, myProfileQueryOptions } from '@/lib/api/accounts';
import { userCan } from '@/lib/navigation';
import { formatDate } from '@/lib/format';

/**
 * Mon profil (D173) : identité, informations Route et progression en lecture seule (gérées par
 * l'administration ou calculées par l'API) ; connexion (mot de passe) et fiche médicale.
 * Les sessions restent gérées par l'API (expiration, révocation au changement de mot de passe,
 * révocation par l'administrateur) mais ne sont plus listées ici.
 */
export function AccountSettings() {
  const user = useSessionUser();
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
      <ProfileOverview />
      <ConnectionCard />
      {/* Fiche médicale : chaque titulaire habilité ; jamais le compte administrateur (D142). */}
      {userCan(user, 'medicalRecord.own') && (
        <div className="lg:col-span-2">
          <MedicalRecordCard />
        </div>
      )}
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
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-break-word">{children}</dd>
    </div>
  );
}

/** Information absente : libellé simple, jamais une valeur fictive (D173). */
function Missing({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground italic">{children}</span>;
}

function duration({ years, months }: ElapsedDuration): string {
  const parts = [
    years > 0 && `${years} an${years > 1 ? 's' : ''}`,
    months > 0 && `${months} mois`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' et ') : 'moins d’un mois';
}

/**
 * Données administratives et valeurs calculées, en lecture seule (aucune action de modification :
 * administrateur pour les chefs, administrateur ou plein en fonction pour les routiers).
 */
function ProfileOverview() {
  const profile = useQuery(myProfileQueryOptions);
  if (profile.isPending) {
    return (
      <div className="lg:col-span-2">
        <TableSkeleton rows={3} />
      </div>
    );
  }
  if (profile.isError) {
    return (
      <div className="lg:col-span-2">
        <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
      </div>
    );
  }
  const { scout } = profile.data;
  return (
    <>
      <IdentityCard profile={profile.data} />
      {scout && <ProgressCard scout={scout} />}
    </>
  );
}

function IdentityCard({ profile }: { profile: MyProfile }) {
  const { scout, leaderFunction } = profile;
  return (
    <Card className={scout ? undefined : 'lg:col-span-2'}>
      <CardHeader>
        <CardTitle>
          <h2>Identité</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Nom">{profile.lastName}</Field>
          <Field label="Prénoms">{profile.firstName}</Field>
          {leaderFunction && (
            <Field label="Fonction">{LEADER_FUNCTION_LABELS[leaderFunction]}</Field>
          )}
          {scout && (
            <>
              <Field label="Matricule">
                {scout.matricule ? (
                  <span className="font-mono">{scout.matricule}</span>
                ) : (
                  <Missing>Non renseigné</Missing>
                )}
              </Field>
              <Field label="Équipe">{scout.team?.name ?? <Missing>Aucune</Missing>}</Field>
              <Field label="Naissance">
                {scout.birthDate ? (
                  <>
                    {formatDate(scout.birthDate)}
                    {scout.age !== null && (
                      <span className="block font-normal text-muted-foreground">
                        {scout.age} ans
                      </span>
                    )}
                  </>
                ) : (
                  <Missing>Non renseignée</Missing>
                )}
              </Field>
              <Field label="Entrée à la Route">
                {scout.joinedAt ? (
                  <>
                    {formatDate(scout.joinedAt)}
                    {scout.seniority && (
                      <span className="block font-normal text-muted-foreground">
                        {duration(scout.seniority)}
                      </span>
                    )}
                  </>
                ) : (
                  <Missing>Non renseignée</Missing>
                )}
              </Field>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function ProgressCard({ scout }: { scout: NonNullable<MyProfile['scout']> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Progression</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Étape actuelle">
            {scout.stage ? (
              <Badge variant="accent">{scout.stage.name}</Badge>
            ) : (
              <Missing>
                Non déterminée
                <span className="block text-xs not-italic">
                  {scout.stageReason === 'DATE_NAISSANCE_MANQUANTE'
                    ? 'Date de naissance à faire renseigner par votre responsable'
                    : STAGE_STATUS_SHORT_LABELS[scout.stageReason]}
                </span>
              </Missing>
            )}
          </Field>
          <Field label="Prochaine transition">
            {scout.nextMilestone ? (
              <>
                {MILESTONE_LABELS[scout.nextMilestone.kind]}
                {scout.nextMilestone.stage && ` (${scout.nextMilestone.stage.name})`}
                <span className="block font-normal text-muted-foreground">
                  {formatDate(scout.nextMilestone.date)}
                </span>
              </>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Sortie de la branche">
            {scout.membership === 'SORTI'
              ? 'Sorti'
              : scout.branchExitOn
                ? formatDate(scout.branchExitOn)
                : '—'}
          </Field>
          <Field label="Modules">
            {scout.catchUps.open > 0 ? (
              <Link
                href="/mes-rattrapages"
                className="text-tesla-rouge underline-offset-4 hover:underline"
              >
                {scout.catchUps.open} à rattraper
              </Link>
            ) : (
              'Aucun à rattraper'
            )}
            {scout.catchUps.acquired > 0 && (
              <span className="block font-normal text-muted-foreground">
                {scout.catchUps.acquired} acquis
              </span>
            )}
          </Field>
        </dl>
      </CardContent>
    </Card>
  );
}

type PasswordValues = z.input<typeof changePasswordInputSchema>;

/** Adresse de connexion et changement de mot de passe (ferme les autres sessions côté API). */
function ConnectionCard() {
  const user = useSessionUser();
  const toast = useToast();
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
      toast.success('Mot de passe modifié', 'Vos autres appareils ont été déconnectés.');
    } catch (error) {
      toast.error('Modification impossible', error instanceof Error ? error.message : undefined);
    }
  };
  const hint = `${PASSWORD_MIN_LENGTH} caractères au minimum.`;
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>
          <h2>Connexion</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl>
          <Field label="Adresse e-mail">
            <span className="break-all">{user.email}</span>
          </Field>
        </dl>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4 sm:grid-cols-2 sm:items-start"
        >
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Modifier le mot de passe
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
