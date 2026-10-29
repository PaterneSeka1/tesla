'use client';

import { useQuery } from '@tanstack/react-query';
import { Archive, Check, CircleX, Pencil, Rocket, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { ResponsableOnly } from '@/components/auth/responsable-only';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { ModuleHistory } from '@/components/modules/module-history';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { SourceImportNotes } from '@/components/modules/source-import-notes';
import { ModuleVersionView } from '@/components/modules/module-version-view';
import { useModuleAction } from '@/components/modules/use-module-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  approveModule,
  archiveModule,
  moduleReviewQueryOptions,
  publishModule,
  rejectModule,
  requestModuleChanges,
} from '@/lib/api/modules';
import { authorName, fullName } from '@/lib/format';

export function ModuleRevision() {
  const user = useSessionUser();
  return (
    <ResponsableOnly role={user.role}>
      <RevisionContent />
    </ResponsableOnly>
  );
}

function RevisionContent() {
  const { id } = useParams<{ id: string }>();
  const run = useModuleAction();
  const [showPublished, setShowPublished] = useState(false);
  const { data, error, isPending, refetch } = useQuery(moduleReviewQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const { module, published } = data;
  const version = module.current;
  const versionId = version.id;
  const status = version.status;
  const onlineId = module.publishedVersionId;

  return (
    <>
      <BackLink href="/administration/modules-a-valider">Modules à valider</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {module.code} · version {version.version} · auteur {authorName(module.createdBy)}
            {module.collaborators.length > 0 &&
              ` · collaborateurs : ${module.collaborators.map((c) => fullName(c.user)).join(', ')}`}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {version.title}
          </h2>
          <ModuleStatusBadge status={status} />
        </div>
        <Button asChild variant="outline">
          <Link href={`/chef/modules/${module.id}/modifier`}>
            <Pencil aria-hidden />
            Ouvrir dans l’éditeur
          </Link>
        </Button>
      </div>

      {module.sourceImport && <SourceImportNotes source={module.sourceImport} />}

      <Card>
        <CardHeader>
          <CardTitle>Décision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {version.submissionNote && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
              Note de soumission : {version.submissionNote}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {status === 'SOUMIS' && (
              <CommentDialog
                trigger={
                  <Button>
                    <Check aria-hidden />
                    Approuver
                  </Button>
                }
                title="Approuver cette version ?"
                description={
                  <p>
                    La version sera figée jusqu’à sa publication. Elle ne sera visible des routiers
                    qu’après l’action « Publier ».
                  </p>
                }
                label="Commentaire (facultatif)"
                confirmLabel="Approuver"
                onConfirm={(comment) =>
                  run(() => approveModule(module.id, { versionId, comment }), {
                    success: 'Version approuvée',
                    error: 'Approbation impossible',
                  })
                }
              />
            )}
            {status === 'APPROUVE' && (
              <ConfirmDialog
                trigger={
                  <Button>
                    <Rocket aria-hidden />
                    Publier
                  </Button>
                }
                title="Publier cette version ?"
                description={
                  <p>
                    {onlineId
                      ? 'Elle remplacera immédiatement la version actuellement en ligne, qui sera archivée.'
                      : 'Le module deviendra visible de tous les routiers dans la bibliothèque.'}
                  </p>
                }
                confirmLabel="Publier"
                onConfirm={() =>
                  run(() => publishModule(module.id, versionId), {
                    success: 'Module publié',
                    error: 'Publication impossible',
                  })
                }
              />
            )}
            {(status === 'SOUMIS' || status === 'APPROUVE') && (
              <CommentDialog
                trigger={
                  <Button variant="outline">
                    <Undo2 aria-hidden />
                    Demander des corrections
                  </Button>
                }
                title="Demander des corrections"
                description={<p>La version retourne à l’équipe de rédaction avec votre motif.</p>}
                label="Corrections attendues"
                required
                confirmLabel="Renvoyer"
                onConfirm={(comment) =>
                  run(() => requestModuleChanges(module.id, { versionId, comment }), {
                    success: 'Corrections demandées',
                    error: 'Action impossible',
                  })
                }
              />
            )}
            {status === 'SOUMIS' && (
              <CommentDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <CircleX aria-hidden />
                    Refuser
                  </Button>
                }
                title="Refuser cette soumission ?"
                description={
                  <p>La version sera close. Une nouvelle version pourra être rédigée.</p>
                }
                label="Motif du refus"
                required
                destructive
                confirmLabel="Refuser"
                onConfirm={(comment) =>
                  run(() => rejectModule(module.id, { versionId, comment }), {
                    success: 'Soumission refusée',
                    error: 'Refus impossible',
                  })
                }
              />
            )}
            {onlineId && (
              <CommentDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Archive aria-hidden />
                    Archiver la version en ligne
                  </Button>
                }
                title="Retirer le module de la bibliothèque ?"
                description={
                  <p>
                    La version publiée sera archivée : le module ne sera plus visible des routiers.
                  </p>
                }
                label="Motif de l’archivage"
                required
                destructive
                confirmLabel="Archiver"
                onConfirm={(comment) =>
                  run(() => archiveModule(module.id, { versionId: onlineId, comment }), {
                    success: 'Version archivée',
                    error: 'Archivage impossible',
                  })
                }
              />
            )}
          </div>
          {!['SOUMIS', 'APPROUVE'].includes(status) && (
            <p className="text-sm text-muted-foreground">
              Aucune décision en attente sur la version {version.version}.
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="reviewed-content" className="space-y-3">
        <h3 id="reviewed-content" className="text-lg font-semibold">
          Contenu exact de la version {version.version}
        </h3>
        <ModuleVersionView version={version} />
      </section>

      {published && (
        <section className="space-y-3">
          <Button
            variant="outline"
            aria-expanded={showPublished}
            onClick={() => setShowPublished(!showPublished)}
          >
            {showPublished ? 'Masquer' : 'Afficher'} la version actuellement en ligne (version{' '}
            {published.version})
          </Button>
          {showPublished && <ModuleVersionView version={published} />}
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique des versions et des décisions</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleHistory
            events={module.events}
            versions={module.versions}
            versionHref={(id) => `/chef/modules/${module.id}/apercu?version=${id}`}
          />
        </CardContent>
      </Card>
    </>
  );
}
