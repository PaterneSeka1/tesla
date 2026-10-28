'use client';

import { useEffect } from 'react';

/** Enregistre le service worker en production uniquement (évite les caches obsolètes en développement). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.error('Enregistrement du service worker impossible', error);
    });
  }, []);
  return null;
}
