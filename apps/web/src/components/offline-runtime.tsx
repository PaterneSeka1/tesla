'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { listAttempts, syncAttempts } from '@/lib/offline/attempts';
import { ownerId } from '@/lib/offline/vault';
/** Planifie uniquement les opérations éligibles, sans boucle réseau permanente. */
export function OfflineRuntime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    async function schedule() {
      clearTimeout(timer);
      if (!ownerId() || !navigator.onLine || disposed) return;
      const copies = await listAttempts();
      const pending = copies.filter(
        (a) => ['EN_ATTENTE', 'EN_COURS'].includes(a.status) && a.retries < 6,
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
        if (navigator.onLine && ownerId()) await syncAttempts();
      } catch {
        /* Les copies restent persistées ; une reconnexion ou action manuelle relancera. */
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
    // Page ouverte sans réseau : TanStack se croit déjà en ligne et ne relance pas les erreurs.
    const reconnected = () => {
      void queryClient.refetchQueries({
        type: 'active',
        predicate: (q) => q.state.status === 'error',
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
