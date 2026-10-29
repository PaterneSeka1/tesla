'use client';

import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { ModuleVersionView } from '@/components/modules/module-version-view';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { editorModuleQueryOptions, moduleVersionQueryOptions } from '@/lib/api/modules';

/** Aperçu fidèle d'une version (version de travail par défaut, ou `?version=`). */
export function ModulePreview() {
  const { id } = useParams<{ id: string }>();
  const requested = useSearchParams().get('version');
  const moduleQuery = useQuery(editorModuleQueryOptions(id));
  const versionId = requested ?? moduleQuery.data?.current.id;
  const version = useQuery({
    ...moduleVersionQueryOptions(id, versionId ?? ''),
    enabled: versionId !== undefined,
  });

  if (moduleQuery.error)
    return <QueryError error={moduleQuery.error} onRetry={() => void moduleQuery.refetch()} />;
  if (version.error)
    return <QueryError error={version.error} onRetry={() => void version.refetch()} />;
  if (!moduleQuery.data || !version.data) return <TableSkeleton rows={6} />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/encadrement/modules/${id}/modifier`}>Retour à l’édition</BackLink>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          Imprimer l’aperçu
        </Button>
      </div>
      <Alert variant="info" className="print:hidden">
        <AlertDescription>
          <p className="flex flex-wrap items-center gap-2">
            Aperçu de la version {version.data.version} ({moduleQuery.data.code})
            <ModuleStatusBadge status={version.data.status} />— présentation telle que la verront
            les routiers après publication.
          </p>
        </AlertDescription>
      </Alert>
      <ModuleVersionView version={version.data} />
    </>
  );
}
