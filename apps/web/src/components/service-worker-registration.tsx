'use client';

import { useEffect } from 'react';
import { setWaitingWorker } from '@/lib/offline/app-update';

/**
 * Enregistre le service worker en production uniquement (évite les caches obsolètes en
 * développement). Une nouvelle version attend l'accord de l'utilisateur (`applyAppUpdate`) :
 * elle ne remplace jamais l'application en cours de saisie. Les données locales (IndexedDB) ne
 * dépendent pas du service worker et sont conservées.
 * Application ouverte sans réseau : l'enregistrement existant est suivi et la recherche de mise à
 * jour est relancée au retour de la connexion.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let reloading = false;
    let watched = false;
    // Première installation : le service worker prend le contrôle d'une page déjà chargée par le
    // réseau ; recharger effacerait la saisie en cours (activation, connexion). Seule une mise à
    // jour acceptée (un contrôleur existait déjà) recharge l'application.
    let controlled = navigator.serviceWorker.controller !== null;
    const onControllerChange = () => {
      if (!controlled) {
        controlled = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const ready = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller)
          setWaitingWorker(worker);
      };
      worker.addEventListener('statechange', ready);
      ready();
    };
    const watch = (registration: ServiceWorkerRegistration | undefined) => {
      if (!registration || watched) return;
      watched = true;
      track(registration.waiting);
      registration.addEventListener('updatefound', () => track(registration.installing));
    };
    const register = () =>
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(watch)
        .catch((error: unknown) => {
          if (navigator.onLine) console.error('Enregistrement du service worker impossible', error);
        });
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.getRegistration().then(watch);
    void register();
    window.addEventListener('online', register);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('online', register);
    };
  }, []);
  return null;
}
