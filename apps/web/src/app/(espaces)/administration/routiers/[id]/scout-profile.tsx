'use client';

import { useQuery } from '@tanstack/react-query';
import { THEORETICAL_STAGE_REASON_LABELS } from '@tesla/shared';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { PathwaySection } from './pathway-section';
import { BackLink } from '@/components/back-link';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { scoutQueryOptions } from '@/lib/api/scouts';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { PedagogicalFile } from './pedagogical-file';
import { ScoutActions } from './scout-actions';

/** Information absente : jamais de valeur fictive (D173). */
function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ScoutProfileView() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionUser();
  const { data: scout, error, isPending, refetch } = useQuery(scoutQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  // Gestion administrative : administrateur ou responsable plein en fonction (vérifié par l'API).
  const isResponsable = userCan(user, 'scout.update');
  // Le dossier pédagogique n'est jamais ouvert à l'administrateur (permissions distinctes).
  const pedagogy = userCan(user, 'progression.read');

  return (
    <>
      <BackLink href="/administration/routiers">Routiers</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {fullName(scout)}
          </h1>
          <div className="flex flex-wrap gap-2">
            {scout.isActive ? (
              <Badge variant="success">Actif</Badge>
            ) : (
              <Badge variant="outline">Désactivé</Badge>
            )}
            {scout.hasAccount ? (
              <Badge variant="secondary">Avec compte</Badge>
            ) : (
              <Badge variant="outline">Sans compte</Badge>
            )}
            <Badge variant={scout.stage ? 'accent' : 'outline'}>
              {scout.stage?.name ?? 'Étape non déterminée'}
            </Badge>
          </div>
        </div>
        {isResponsable && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/administration/routiers/${scout.id}/modifier`}>
                <Pencil aria-hidden />
                Compléter ou corriger
              </Link>
            </Button>
            <ScoutActions scout={scout} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Nom">{scout.lastName}</Detail>
            <Detail label="Prénoms">{scout.firstName}</Detail>
            <Detail label="Matricule">
              {scout.matricule ? (
                <span className="font-mono">{scout.matricule}</span>
              ) : (
                <Missing>Matricule non renseigné</Missing>
              )}
            </Detail>
            <Detail label="Équipe actuelle">
              {scout.team ? (
                <Link
                  href={`/administration/equipes/${scout.team.id}`}
                  className="text-tesla-rouge underline-offset-4 hover:underline"
                >
                  {scout.team.name}
                </Link>
              ) : (
                'Sans équipe'
              )}
            </Detail>
            <Detail label="Étape actuelle">
              {scout.stage ? (
                <>
                  {scout.stage.name}
                  <span className="block text-xs text-muted-foreground">Déterminée par l’âge</span>
                </>
              ) : (
                <Missing>
                  Étape non déterminée
                  {/* Le motif « date de naissance manquante » figure déjà sur le champ voisin. */}
                  {scout.stageReason !== 'DATE_NAISSANCE_MANQUANTE' && (
                    <span className="block text-xs">
                      {THEORETICAL_STAGE_REASON_LABELS[scout.stageReason]}
                    </span>
                  )}
                </Missing>
              )}
            </Detail>
            <Detail label="Date d’entrée à la Route">
              {scout.joinedAt ? (
                formatDate(scout.joinedAt)
              ) : (
                <Missing>Date d’entrée non renseignée</Missing>
              )}
            </Detail>
            <Detail label="Date de naissance">
              {scout.birthDate ? (
                formatDate(scout.birthDate)
              ) : (
                <Missing>Date de naissance non renseignée</Missing>
              )}
            </Detail>
            <Detail label="Compte">
              {scout.account ? (
                <>
                  {scout.account.email ?? 'Compte rattaché'}
                  {!scout.account.isActive && ' (désactivé)'}
                  <span className="block text-xs text-muted-foreground">
                    {scout.account.lastLoginAt
                      ? `Dernière connexion : ${formatDateTime(scout.account.lastLoginAt)}`
                      : 'Jamais connecté'}
                  </span>
                </>
              ) : (
                'Aucun compte : suivi assuré par l’encadrement'
              )}
            </Detail>
            <Detail label="Fiche créée le">{formatDate(scout.createdAt)}</Detail>
          </dl>
        </CardContent>
      </Card>

      {userCan(user, 'catchUp.read') && <PathwaySection scoutId={scout.id} user={user} />}

      {pedagogy && <PedagogicalFile scoutId={scout.id} />}
    </>
  );
}
