/** Nouvelle version de l'application en attente d'activation (service worker installé). */
let waiting: ServiceWorker | null = null;

export function setWaitingWorker(worker: ServiceWorker) {
  waiting = worker;
  window.dispatchEvent(new Event('app-update-available'));
}
export const appUpdateAvailable = () => waiting !== null;
/**
 * Active la nouvelle version ; la page se recharge dès qu'elle prend le contrôle. Repli : si
 * l'ancienne version ne cède pas la main (page ouverte sans réseau), rechargement après 3 s, ce
 * qui libère l'activation. Les données locales (IndexedDB) ne sont jamais touchées.
 */
export function applyAppUpdate() {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => window.location.reload(), 3_000);
}
