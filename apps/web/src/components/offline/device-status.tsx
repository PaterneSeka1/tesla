'use client';

import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { applyAppUpdate } from '@/lib/offline/app-update';
import { cn } from '@/lib/utils';
import { useDeviceState } from './use-device-state';

const formatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Informations utiles seulement (D116) : rien n'est affiché quand tout est synchronisé et en ligne.
 * Hors connexion, conflits, modifications en attente, date des données locales, mise à jour.
 */
export function DeviceStatus({ className }: { className?: string }) {
  const state = useDeviceState();
  const items: { key: string; label: string; tone?: 'warn' }[] = [];
  if (!state.online) items.push({ key: 'offline', label: 'Hors connexion' });
  if (state.attention > 0)
    items.push({
      key: 'attention',
      label:
        state.attention === 1 ? 'Conflit à résoudre' : `${state.attention} conflits à résoudre`,
      tone: 'warn',
    });
  if (state.pending > 0)
    items.push({
      key: 'pending',
      label:
        state.pending === 1
          ? '1 modification en attente'
          : `${state.pending} modifications en attente`,
    });
  if (state.localSince)
    items.push({
      key: 'fresh',
      label: `Données du ${formatter.format(new Date(state.localSince))}`,
    });
  if (items.length === 0 && !state.updateAvailable) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)} role="status">
      {items.length > 0 && (
        <Link
          href="/appareil"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 hover:bg-white/20"
        >
          {state.attention > 0 ? (
            <TriangleAlert className="size-3.5 text-tesla-or" aria-hidden />
          ) : (
            !state.online && <CloudOff className="size-3.5" aria-hidden />
          )}
          {items.map((item) => item.label).join(' · ')}
        </Link>
      )}
      {state.updateAvailable && (
        <button
          type="button"
          onClick={() => {
            if (
              state.pending === 0 ||
              window.confirm(
                'Des modifications attendent la synchronisation. Elles sont conservées sur cet appareil pendant la mise à jour. Continuer ?',
              )
            )
              applyAppUpdate();
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-tesla-or px-2.5 py-1 font-medium text-tesla-bordeaux"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Mettre à jour
        </button>
      )}
    </div>
  );
}
