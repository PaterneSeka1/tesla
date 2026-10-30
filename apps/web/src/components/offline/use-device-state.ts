'use client';

import { useEffect, useState } from 'react';
import { appUpdateAvailable } from '@/lib/offline/app-update';
import { listAttempts } from '@/lib/offline/attempts';
import { listOperations } from '@/lib/offline/operations';
import { localFreshness } from '@/lib/offline/repository';
import { ensureVaultRestored, ownerId } from '@/lib/offline/vault';

export interface DeviceState {
  online: boolean;
  unlocked: boolean;
  /** Modifications et copies non encore confirmées par le serveur. */
  pending: number;
  /** Conflits ou rejets à examiner. */
  attention: number;
  /** Données affichées depuis l'appareil : date de la plus ancienne copie. */
  localSince: string | null;
  updateAvailable: boolean;
}

const INITIAL: DeviceState = {
  online: true,
  unlocked: false,
  pending: 0,
  attention: 0,
  localSince: null,
  updateAvailable: false,
};

/** État de l'appareil, relu à chaque événement local (aucune interrogation périodique). */
export function useDeviceState(): DeviceState {
  const [state, setState] = useState(INITIAL);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      await ensureVaultRestored();
      const unlocked = !!ownerId();
      const [copies, operations] = unlocked
        ? await Promise.all([
            listAttempts().catch(() => []),
            listOperations()
              .then((rows) => rows.map((row) => row.value))
              .catch(() => []),
          ])
        : [[], []];
      const states = [...copies, ...operations].map((item) => item.status);
      if (disposed) return;
      setState({
        online: navigator.onLine,
        unlocked,
        pending: states.filter((s) => ['EN_ATTENTE', 'EN_COURS'].includes(s)).length,
        attention: states.filter((s) => ['CONFLIT', 'REJETE'].includes(s)).length,
        localSince: localFreshness().oldest,
        updateAvailable: appUpdateAvailable(),
      });
    };
    const listener = () => {
      void refresh();
    };
    const events = [
      'online',
      'offline',
      'offline-vault-change',
      'offline-data-change',
      'offline-freshness-change',
      'app-update-available',
    ];
    for (const event of events) window.addEventListener(event, listener);
    listener();
    return () => {
      disposed = true;
      for (const event of events) window.removeEventListener(event, listener);
    };
  }, []);
  return state;
}
