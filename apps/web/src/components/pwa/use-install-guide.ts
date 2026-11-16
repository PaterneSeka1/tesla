'use client';

import { useSyncExternalStore } from 'react';
import {
  currentInstallGuide,
  INSTALL_CHANGED_EVENT,
  INSTALLABLE_EVENT,
  type InstallGuide,
  OPEN_INSTALL_EVENT,
} from '@/lib/pwa-install';

const EVENTS = [INSTALLABLE_EVENT, INSTALL_CHANGED_EVENT, 'appinstalled'] as const;

function subscribe(listener: () => void) {
  for (const name of EVENTS) window.addEventListener(name, listener);
  return () => {
    for (const name of EVENTS) window.removeEventListener(name, listener);
  };
}

/**
 * Installation possible dans ce navigateur (D184) ; `null` dans l'application installée ou quand
 * aucune installation n'est proposée. Rendu serveur : `null`.
 */
export function useInstallGuide(): InstallGuide {
  return useSyncExternalStore(subscribe, currentInstallGuide, () => null);
}

/** Ouvre l'invitation à installer (`InstallPrompt`). */
export function openInstallPrompt(): void {
  window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
}
