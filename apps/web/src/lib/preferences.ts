'use client';

import { useSyncExternalStore } from 'react';

/**
 * Préférences de confort de cet appareil (D195) : aucune donnée personnelle, rien n'est envoyé au
 * serveur. Les sons sont désactivés par défaut ; la vibration n'existe que sur les appareils
 * compatibles ; les animations suivent le réglage du système sauf choix explicite.
 */
export interface DevicePreferences {
  /** `system` : suit `prefers-reduced-motion` ; `reduced` : animations réduites partout. */
  motion: 'system' | 'reduced';
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_PREFERENCES: DevicePreferences = {
  motion: 'system',
  sound: false,
  haptics: true,
};

const KEY = 'tesla.preferences';
const listeners = new Set<() => void>();
let cache: DevicePreferences | null = null;

export function parsePreferences(raw: string | null): DevicePreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      motion: value.motion === 'reduced' ? 'reduced' : 'system',
      sound: value.sound === true,
      haptics: value.haptics !== false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function readPreferences(): DevicePreferences {
  if (cache) return cache;
  try {
    cache = parsePreferences(window.localStorage.getItem(KEY));
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  return cache;
}

/** Applique le réglage d'animation au document (`data-motion`, lu par globals.css). */
export function applyMotionPreference(preferences = readPreferences()) {
  if (typeof document === 'undefined') return;
  if (preferences.motion === 'reduced') document.documentElement.dataset.motion = 'reduced';
  else delete document.documentElement.dataset.motion;
}

export function writePreferences(update: Partial<DevicePreferences>) {
  cache = { ...readPreferences(), ...update };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Stockage indisponible : réglage valable pour cette visite seulement.
  }
  applyMotionPreference(cache);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences(): DevicePreferences {
  return useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFERENCES);
}

/** Animations réduites : préférence de l'appareil ou réglage du système. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    readPreferences().motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
