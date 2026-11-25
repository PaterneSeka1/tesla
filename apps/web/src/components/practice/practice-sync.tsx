'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { flushPendingResults, nextPendingAt } from '@/lib/practice-results';

/**
 * Synchronisation globale des résultats d'entraînement (D204), montée une fois dans le cadre
 * authentifié : indépendante de l'écran affiché. Déclenchements : ouverture, retour du réseau,
 * retour au premier plan, déverrouillage du coffre, nouveau résultat en attente ; puis à
 * l'échéance du prochain essai (attente croissante, jamais de boucle réseau permanente).
 * Une réponse arrivée après un changement de compte n'a aucun effet (`active`).
 */
export function PracticeSync() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const enabled = userCan(user, 'practice.own');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async (manual = false) => {
      clearTimeout(timer);
      if (!active) return;
      const settled = await flushPendingResults(user.id, manual).catch(() => 0);
      if (!active) return;
      if (settled > 0) void queryClient.invalidateQueries({ queryKey: ['me', 'journal'] });
      const next = await nextPendingAt(user.id).catch(() => null);
      if (active && next !== null)
        timer = setTimeout(() => void run(), Math.max(5_000, next - Date.now()));
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), 2_000);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const online = () => void run(true);
    void run();
    window.addEventListener('online', online);
    window.addEventListener('offline-vault-change', online);
    window.addEventListener('practice-result-pending', soon);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline-vault-change', online);
      window.removeEventListener('practice-result-pending', soon);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, user.id, queryClient]);
  return null;
}
