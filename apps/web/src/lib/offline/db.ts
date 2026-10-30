/** Schéma v2 : les anciennes fondations v1 restent intactes et ne sont plus utilisées. */
export const OFFLINE_DB_NAME = 'tesla-academie';
export const OFFLINE_DB_VERSION = 2;
export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Stockage hors ligne indisponible sur ce navigateur.'));
      return;
    }
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      for (const store of ['records', 'settings']) {
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Stockage local inaccessible.'));
    request.onblocked = () =>
      reject(new Error('Fermez les autres onglets pour mettre à jour le stockage local.'));
  });
}
export async function dbRead<T>(store: string, id?: string): Promise<T> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request =
      id === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(id);
    tx.oncomplete = () => {
      db.close();
      resolve(request.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
/** Comparaison de révision dans la même transaction : protège les brouillons entre onglets. */
export async function dbWrite(
  store: string,
  value: { id: string; revision?: number },
  expectedRevision?: number,
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const table = tx.objectStore(store);
    if (expectedRevision === undefined) table.put(value);
    else {
      const read = table.get(value.id);
      read.onsuccess = () => {
        const previous = read.result as { revision: number } | undefined;
        if ((previous?.revision ?? 0) !== expectedRevision) tx.abort();
        else table.put(value);
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          tx.error?.name === 'QuotaExceededError'
            ? 'Espace insuffisant. Supprimez un module, puis recommencez.'
            : 'Enregistrement impossible ou conflit entre onglets. Rechargez avant de continuer.',
        ),
      );
    };
  });
}
export async function dbDelete(store: string, id: string): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
/** Clés d'un préfixe, sans lire ni déchiffrer les valeurs (modules volumineux inclus). */
export async function dbKeys(store: string, prefix: string): Promise<string[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx
      .objectStore(store)
      .getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`, false, false));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result as string[]);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
