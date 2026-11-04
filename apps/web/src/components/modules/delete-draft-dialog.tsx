'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MODULE_VERSION_STATUS_LABELS } from '@tesla/shared';
import { CircleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { deleteDraft, draftDeletionQueryOptions } from '@/lib/api/modules';

/**
 * Confirmation de la suppression d'UN brouillon (D171). Le diagnostic vient de l'API à chaque
 * ouverture ; la réussite n'est annoncée qu'après la réponse du serveur ; double clic neutralisé.
 */
export function DeleteDraftDialog({
  moduleId,
  open,
  onOpenChange,
  onDeleted,
}: {
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (kind: 'MODULE' | 'VERSION') => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const {
    data: check,
    error,
    isPending,
  } = useQuery({
    ...draftDeletionQueryOptions(moduleId),
    enabled: open,
  });

  const change = (next: boolean) => {
    if (pending) return; // fermeture impossible pendant la suppression
    if (!next) setFailure(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!check?.allowed || !check.versionId || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      const result = await deleteDraft(moduleId, { versionId: check.versionId });
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast.success(
        result.kind === 'MODULE' ? 'Brouillon supprimé' : 'Version de travail abandonnée',
        result.kind === 'MODULE'
          ? `« ${check.title} » a été supprimé.`
          : `La version ${check.publishedVersion} en ligne reste inchangée.`,
      );
      onOpenChange(false);
      onDeleted?.(result.kind);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Suppression impossible.';
      setFailure(message);
      toast.error('Suppression impossible', message);
      await queryClient.invalidateQueries({
        queryKey: ['modules', 'editor', 'draft-deletion', moduleId],
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const isVersion = check?.kind === 'VERSION';
  const title = isVersion ? 'Abandonner la version de travail ?' : 'Supprimer ce brouillon ?';

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onInteractOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{check ? title : 'Supprimer le brouillon'}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              {isPending ? (
                <div className="space-y-2" aria-busy="true" aria-label="Vérification en cours">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : error ? (
                <p>{error.message}</p>
              ) : (
                <>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-sm text-foreground">
                    <dt className="text-muted-foreground">Module</dt>
                    <dd className="font-medium break-words">{check.title}</dd>
                    <dt className="text-muted-foreground">Code</dt>
                    <dd>{check.code}</dd>
                    {check.status && (
                      <>
                        <dt className="text-muted-foreground">Statut</dt>
                        <dd>
                          {MODULE_VERSION_STATUS_LABELS[check.status]}
                          {check.version !== null && ` · version ${check.version}`}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Leçons</dt>
                    <dd>{check.lessonCount}</dd>
                    {check.resourceCount > 0 && (
                      <>
                        <dt className="text-muted-foreground">Ressources</dt>
                        <dd>{check.resourceCount}</dd>
                      </>
                    )}
                  </dl>
                  {check.allowed ? (
                    <p>
                      {isVersion ? (
                        <>
                          {`Vous allez abandonner la version ${check.version} en préparation de « ${check.title} ». `}
                          {'Ses leçons non publiées seront supprimées. '}
                          {`La version ${check.publishedVersion} déjà publiée reste en ligne, inchangée.`}
                        </>
                      ) : (
                        <>
                          {`Vous allez supprimer le brouillon « ${check.title} ». `}
                          {check.lessonCount > 0
                            ? 'Ses leçons non publiées seront supprimées. '
                            : ''}
                          Aucun autre module n’est modifié ; la suppression est inscrite au journal.
                        </>
                      )}{' '}
                      Cette action est définitive.
                    </p>
                  ) : (
                    <Alert variant="destructive">
                      <CircleAlert aria-hidden />
                      <AlertTitle>Suppression impossible</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {check.blockers.map((blocker) => (
                            <li key={blocker.code}>{blocker.message}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
              {failure && (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              {check?.allowed ? 'Annuler' : 'Fermer'}
            </Button>
          </DialogClose>
          {check?.allowed && (
            <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
              {pending
                ? 'Suppression…'
                : isVersion
                  ? 'Abandonner la version'
                  : 'Supprimer le brouillon'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
