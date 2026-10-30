'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toaster';
import { OfflineQueuedError } from '@/lib/offline/operations';

/** Domaines dont les données dépendent des décisions de progression, d'activités et de présences. */
const QUERY_ROOTS = [
  'progression',
  'activities',
  'programmes',
  'dashboards',
  'scouts',
  'pathway',
  'leadership',
] as const;

/** Écriture enregistrée sur l'appareil, pas encore confirmée par le serveur (D110). */
export const OFFLINE_SAVED = {
  title: 'Enregistré sur cet appareil',
  detail: 'En attente de synchronisation : rien n’est encore officiel.',
} as const;

/**
 * Exécute une action de suivi pédagogique, recharge les données concernées et affiche le résultat.
 * Un conflit (données modifiées entre-temps) recharge aussi les données : l'utilisateur recommence
 * sur une version à jour, rien n'est écrasé.
 */
export function usePedagogyAction() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return async (
    action: () => Promise<unknown>,
    messages: { success: string; error: string; detail?: string },
  ): Promise<boolean> => {
    const refresh = () =>
      Promise.all(QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
    try {
      await action();
      await refresh();
      toast.success(messages.success, messages.detail);
      return true;
    } catch (error) {
      await refresh();
      if (error instanceof OfflineQueuedError) {
        toast.success(OFFLINE_SAVED.title, OFFLINE_SAVED.detail);
        return true;
      }
      toast.error(messages.error, error instanceof Error ? error.message : undefined);
      return false;
    }
  };
}
