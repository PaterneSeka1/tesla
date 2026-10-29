'use client';

import { useQuery } from '@tanstack/react-query';
import { type EditorModuleDetail, MODULE_VERSION_ACTION_LABELS } from '@tesla/shared';
import { CircleAlert, Eye, FilePlus2, RotateCcw, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { ModuleHistory } from '@/components/modules/module-history';
import { ModuleMetadataForm } from '@/components/modules/module-metadata-form';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { SourceImportNotes } from '@/components/modules/source-import-notes';
import { useModuleAction } from '@/components/modules/use-module-action';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createModuleVersion,
  editorModuleQueryOptions,
  resumeModule,
  submitModule,
  updateModuleVersion,
} from '@/lib/api/modules';
import { CollaboratorsPanel } from './collaborators-panel';
import { LessonsPanel } from './lessons-panel';
import { ResourcesPanel } from './resources-panel';

const STATE_MESSAGES: Partial<Record<EditorModuleDetail['current']['status'], string>> = {
  SOUMIS: 'Cette version est soumise : elle est figée jusqu’à la décision du responsable.',
  APPROUVE:
    'Cette version est approuvée : elle est figée et attend sa publication par le responsable.',
  A_CORRIGER:
    'Le responsable a demandé des corrections : reprenez la rédaction pour modifier cette version.',
  REFUSE: 'Cette version a été refusée. Vous pouvez créer une nouvelle version de travail.',
  PUBLIE:
    'Cette version est publiée et ne peut plus être modifiée. Créez une nouvelle version : la version publiée restera visible jusqu’à la publication de la suivante.',
  ARCHIVE: 'Cette version est archivée. Vous pouvez créer une nouvelle version de travail.',
};

export function ModuleEditor() {
  const { id } = useParams<{ id: string }>();
  const run = useModuleAction();
  const { data: module, error, isPending, refetch } = useQuery(editorModuleQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const { current, permissions } = module;
  const lastDecision = module.events.find(
    (event) => event.versionId === current.id && event.comment && event.action !== 'SOUMISE',
  );

  return (
    <>
      <BackLink href="/encadrement/modules">Mes modules</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {module.code} · version {current.version}
            {module.publishedVersionId &&
              module.publishedVersionId !== current.id &&
              ' · une version est en ligne'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {current.title}
          </h1>
          <ModuleStatusBadge status={current.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/encadrement/modules/${module.id}/apercu`}>
              <Eye aria-hidden />
              Aperçu
            </Link>
          </Button>
          {permissions.canResume && (
            <Button
              onClick={() =>
                void run(() => resumeModule(module.id, current.id), {
                  success: 'Rédaction reprise',
                  error: 'Reprise impossible',
                })
              }
            >
              <RotateCcw aria-hidden />
              Reprendre la rédaction
            </Button>
          )}
          {permissions.canCreateVersion && (
            <Button
              onClick={() =>
                void run(() => createModuleVersion(module.id), {
                  success: 'Nouvelle version créée',
                  error: 'Création impossible',
                  detail: 'La version publiée reste visible jusqu’à la publication de celle-ci.',
                })
              }
            >
              <FilePlus2 aria-hidden />
              Nouvelle version
            </Button>
          )}
          {permissions.canSubmit && (
            <CommentDialog
              trigger={
                <Button>
                  <Send aria-hidden />
                  Soumettre
                </Button>
              }
              title="Soumettre à l’approbation ?"
              description={
                <p>
                  La version {current.version} sera figée et transmise au responsable pédagogique.
                  Seul le responsable peut l’approuver et la publier.
                </p>
              }
              label="Note pour le responsable (facultative)"
              confirmLabel="Soumettre"
              onConfirm={(note) =>
                run(
                  () =>
                    submitModule(module.id, {
                      versionId: current.id,
                      revision: current.revision,
                      note,
                    }),
                  { success: 'Module soumis', error: 'Soumission impossible' },
                )
              }
            />
          )}
        </div>
      </div>

      {STATE_MESSAGES[current.status] && (
        <Alert variant={current.status === 'A_CORRIGER' ? 'destructive' : 'info'}>
          <CircleAlert aria-hidden />
          <AlertTitle>{STATE_MESSAGES[current.status]}</AlertTitle>
          {lastDecision && (
            <AlertDescription>
              <p>
                {MODULE_VERSION_ACTION_LABELS[lastDecision.action]} : « {lastDecision.comment} »
              </p>
            </AlertDescription>
          )}
        </Alert>
      )}

      {module.sourceImport && <SourceImportNotes source={module.sourceImport} />}

      <Card>
        <CardHeader>
          <CardTitle>Informations du module</CardTitle>
          <CardDescription>
            Titre, description, étape recommandée, objectifs et prérequis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleMetadataForm
            version={current}
            disabled={!permissions.canEdit}
            submitLabel="Enregistrer les informations"
            onSubmit={async (values) => {
              await run(
                () =>
                  updateModuleVersion(module.id, {
                    versionId: current.id,
                    revision: current.revision,
                    ...values,
                  }),
                { success: 'Informations enregistrées', error: 'Enregistrement impossible' },
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leçons</CardTitle>
          <CardDescription>
            Ordonnez les leçons et rédigez leur contenu ; enregistrez chaque leçon avant de la
            fermer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonsPanel module={module} editable={permissions.canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ressources</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourcesPanel module={module} editable={permissions.canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collaborateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <CollaboratorsPanel module={module} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleHistory
            events={module.events}
            versions={module.versions}
            versionHref={(versionId) =>
              `/encadrement/modules/${module.id}/apercu?version=${versionId}`
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
