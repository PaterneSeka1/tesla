/**
 * Structure IndexedDB de la PWA (fondation, non encore utilisée par les écrans).
 * Voir docs/OFFLINE_FIRST.md. Aucune donnée personnelle sensible ne doit y être stockée.
 */
export const OFFLINE_DB_NAME = 'tesla-academie';
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_STORES = {
  /** Modules publiés téléchargés pour lecture hors ligne. */
  modules: 'modules',
  /** Leçons des modules téléchargés (index par module). */
  lessons: 'lessons',
  /** Actions en attente de synchronisation (ex. progression de lecture). */
  syncQueue: 'syncQueue',
} as const;

export interface OfflineModule {
  id: string;
  /** Version publiée : sert à détecter une mise à jour côté serveur. */
  version: number;
  title: string;
  downloadedAt: string;
}

export interface OfflineLesson {
  id: string;
  moduleId: string;
  position: number;
  title: string;
  content: string;
}

export interface SyncQueueItem {
  id?: number;
  type: string;
  payload: unknown;
  createdAt: string;
}

export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORES.modules)) {
        db.createObjectStore(OFFLINE_STORES.modules, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.lessons)) {
        const lessons = db.createObjectStore(OFFLINE_STORES.lessons, { keyPath: 'id' });
        lessons.createIndex('byModule', 'moduleId');
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.syncQueue)) {
        const queue = db.createObjectStore(OFFLINE_STORES.syncQueue, {
          keyPath: 'id',
          autoIncrement: true,
        });
        queue.createIndex('byCreatedAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ouverture IndexedDB impossible.'));
  });
}
