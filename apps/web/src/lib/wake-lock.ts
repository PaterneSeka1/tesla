'use client';

import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Garde l'écran allumé tant que `enabled` est vrai (mode cérémonie, chant collectif), lorsque le
 * navigateur le permet (Screen Wake Lock). Le verrou, levé par le système quand la page passe en
 * arrière-plan, est redemandé au retour. Sans prise en charge : aucun effet, `active` reste faux.
 */
export function useWakeLock(enabled: boolean): { supported: boolean; active: boolean } {
  const [active, setActive] = useState(false);
  const supported = wakeLockSupported();
  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setActive(true);
        sentinel.addEventListener('release', () => setActive(false));
      } catch {
        // Refus (économie d'énergie, page non visible) : l'écran suit le réglage du téléphone.
        setActive(false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void request();
      }
    };
    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      setActive(false);
    };
  }, [enabled, supported]);
  return { supported, active };
}
