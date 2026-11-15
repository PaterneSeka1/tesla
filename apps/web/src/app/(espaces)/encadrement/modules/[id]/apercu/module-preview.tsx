'use client';

import { useQuery } from '@tanstack/react-query';
import { Monitor, Printer, Smartphone } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { safeReturnPath } from '@/lib/module-list-params';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { ModuleVersionView } from '@/components/modules/module-version-view';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { editorModuleQueryOptions, moduleVersionQueryOptions } from '@/lib/api/modules';
import { cn } from '@/lib/utils';

/** Aperçu fidèle d'une version (version de travail par défaut, ou `?version=`). */
export function ModulePreview() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requested = searchParams.get('version');
  const retour = searchParams.get('retour');
  const moduleQuery = useQuery(editorModuleQueryOptions(id));
  // Largeur de lecture simulée : ordinateur ou téléphone (360 px), pour contrôler la lisibilité.
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
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
        <BackLink
          href={`/encadrement/modules/${id}/modifier${retour ? `?retour=${encodeURIComponent(safeReturnPath(retour, '/encadrement/modules'))}` : ''}`}
        >
          Retour à l’édition
        </BackLink>
        <div className="flex flex-wrap gap-2">
          <div
            role="group"
            aria-label="Largeur de l’aperçu"
            className="flex rounded-md border p-0.5"
          >
            {(
              [
                ['desktop', 'Ordinateur', Monitor],
                ['mobile', 'Téléphone', Smartphone],
              ] as const
            ).map(([value, label, Icon]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={device === value ? 'default' : 'ghost'}
                aria-pressed={device === value}
                onClick={() => setDevice(value)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden />
            Imprimer l’aperçu
          </Button>
        </div>
      </div>
      <Alert variant="info" className="print:hidden">
        <AlertDescription>
          <p className="flex flex-wrap items-center gap-2">
            Aperçu de la version {version.data.version}
            <ModuleStatusBadge status={version.data.status} />
          </p>
        </AlertDescription>
      </Alert>
      <div
        className={cn(
          'mx-auto w-full transition-[max-width] motion-reduce:transition-none',
          device === 'mobile'
            ? 'max-w-[360px] rounded-[1.5rem] border-8 border-neutral-200 print:max-w-none print:border-0'
            : 'max-w-none',
        )}
      >
        <ModuleVersionView version={version.data} />
      </div>
    </>
  );
}
