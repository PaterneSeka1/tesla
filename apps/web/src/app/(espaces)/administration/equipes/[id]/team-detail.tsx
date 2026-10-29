'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toaster';
import { archiveTeam, teamQueryOptions } from '@/lib/api/teams';
import { formatDate, fullName } from '@/lib/format';
import { TeamForm } from '../team-form';

export function TeamDetailView() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: team, error, isPending, refetch } = useQuery(teamQueryOptions(id));

  if (isPending) return <TableSkeleton rows={4} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const isResponsable = user.role === 'RESPONSABLE';
  const archived = team.archivedAt !== null;

  const onArchive = async () => {
    try {
      await archiveTeam(team.id);
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['scouts'] });
      toast.success(
        'Équipe archivée',
        'Les affectations en cours ont été clôturées ; l’historique est conservé.',
      );
      return true;
    } catch (archiveError) {
      toast.error(
        'Archivage impossible',
        archiveError instanceof Error ? archiveError.message : undefined,
      );
      return false;
    }
  };

  return (
    <>
      <BackLink href="/administration/equipes">Équipes</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
              {team.name}
            </h1>
            {archived ? (
              <Badge variant="outline">Archivée</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{team.description ?? 'Aucune description.'}</p>
          <p className="text-xs text-muted-foreground">
            Créée le {formatDate(team.createdAt)}
            {team.archivedAt && ` · archivée le ${formatDate(team.archivedAt)}`}
          </p>
        </div>
        {isResponsable && !archived && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Modifier
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <Archive aria-hidden />
                  Archiver
                </Button>
              }
              title={`Archiver l’équipe « ${team.name} » ?`}
              description={
                <>
                  <p>
                    {team.memberCount > 0
                      ? `${team.memberCount} routier${team.memberCount > 1 ? 's seront retirés' : ' sera retiré'} de l’équipe (affectation clôturée à la date du jour).`
                      : 'L’équipe ne compte actuellement aucun membre.'}
                  </p>
                  <p>
                    L’historique des affectations est conservé. Une équipe archivée ne peut plus
                    recevoir de membres.
                  </p>
                </>
              }
              confirmLabel="Archiver"
              destructive
              onConfirm={onArchive}
            />
          </div>
        )}
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Modifier l’équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamForm
              team={team}
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="members-title" className="space-y-3">
        <h3 id="members-title" className="text-lg font-semibold">
          Membres actuels ({team.memberCount})
        </h3>
        {team.members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun membre"
            description={
              archived
                ? 'Équipe archivée : consultez l’historique depuis la fiche de chaque routier.'
                : 'Affectez des routiers depuis leur fiche.'
            }
          />
        ) : (
          <Table>
            <TableCaption>Membres de l’équipe</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Routier</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead className="hidden sm:table-cell">Étape</TableHead>
                <TableHead className="hidden sm:table-cell">Depuis le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.members.map((member) => (
                <TableRow key={member.scoutProfileId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/administration/routiers/${member.scoutProfileId}`}
                      className="text-tesla-rouge underline-offset-4 hover:underline"
                    >
                      {fullName(member)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">{member.matricule ?? '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {member.stage?.name ?? 'Non renseignée'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(member.since)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
