'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { meQueryOptions } from '@/lib/api/auth';
import { listAttempts, syncAttempts } from '@/lib/offline/attempts';
import { listOperations, pruneSynchronized, syncOperations } from '@/lib/offline/operations';
import { clearLocalFreshness } from '@/lib/offline/repository';
import { ensureVaultRestored, ownerId } from '@/lib/offline/vault';

const MAX_AUTOMATIC_RETRIES = 6;

/**
 * Synchronisation de l'appareil (copies d'évaluation et file d'opérations) : planifie uniquement
 * les envois dus, sans boucle réseau permanente. Déclenchements : ouverture, retour du réseau,
 * retour au premier plan, déverrouillage, nouvelle opération.
 */
export function OfflineRuntime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    async function schedule() {
      clearTimeout(timer);
      if (!ownerId() || !navigator.onLine || disposed) return;
      const [copies, operations] = await Promise.all([listAttempts(), listOperations()]);
      const pending = [...copies, ...operations.map((row) => row.value)].filter(
        (a) => ['EN_ATTENTE', 'EN_COURS'].includes(a.status) && a.retries < MAX_AUTOMATIC_RETRIES,
      );
      if (!pending.length || disposed) return;
      const due = Math.min(...pending.map((a) => a.nextRetryAt));
      timer = setTimeout(
        () => {
          void run();
        },
        Math.max(1000, due - Date.now()),
      );
    }
    async function run() {
      try {
        await ensureVaultRestored();
        if (navigator.onLine && ownerId()) {
          await syncAttempts();
          if ((await syncOperations()) > 0) await queryClient.invalidateQueries();
          await pruneSynchronized();
        }
      } catch {
        /* Les opérations restent persistées ; une reconnexion ou une action manuelle relancera. */
      } finally {
        if (!disposed) void schedule().catch(() => {});
      }
    }
    const changed = () => {
      void schedule().catch(() => {});
    };
    const connected = () => {
      void run();
    };
    // Retour du réseau : session revérifiée par le serveur, données locales remplacées par des
    // copies à jour, puis envoi des opérations en attente.
    const reconnected = () => {
      clearLocalFreshness();
      void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      void queryClient.refetchQueries({
        type: 'active',
        predicate: (q) => q.state.status === 'error' || q.queryKey[0] !== 'auth',
      });
      connected();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') connected();
    };
    window.addEventListener('online', reconnected);
    window.addEventListener('offline-vault-change', connected);
    window.addEventListener('offline-data-change', changed);
    document.addEventListener('visibilitychange', visible);
    connected();
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('online', reconnected);
      window.removeEventListener('offline-vault-change', connected);
      window.removeEventListener('offline-data-change', changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [queryClient]);
  return null;
}
