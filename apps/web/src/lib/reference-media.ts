import { lessonImageFileId } from '@tesla/shared';
import { resolveImageSrc } from '@/lib/api/assets';
import { assertOnlineOwner, ownerId } from '@/lib/offline/vault';

/**
 * Enregistrements du référentiel téléchargés pour l'écoute hors ligne (D222). Adaptateur limité,
 * distinct du coffre chiffré (qui garde les données personnelles et les textes) : un enregistrement
 * publié n'est pas une donnée personnelle, et un fichier audio de plusieurs mégaoctets n'a pas sa
 * place dans un enregistrement chiffré sérialisé. Garanties :
 * - seuls les enregistrements **publiés** dont le téléchargement est autorisé sont proposés ;
 * - copie rattachée au titulaire du coffre ouvert (`ownerId`) : une autre personne sur le même
 *   appareil ne la lit pas ; jamais dans le cache du service worker, jamais d'URL signée conservée ;
 * - clé = fichier stocké : les paroles synchronisées valent pour ce fichier exact (`syncedSrc`).
 * Point d'intégration : effacement à la réinitialisation du coffre (voir le suivi du chantier).
 */

const DB_NAME = 'tesla-referentiel-media';
const STORE = 'audio';
/** Plafond d'un enregistrement conservé (aligné sur le plafond d'envoi). */
export const MAX_LOCAL_AUDIO_BYTES = 20 * 1024 * 1024;

interface LocalAudio {
  key: string;
  owner: string;
  fileId: string;
  blob: Blob;
  bytes: number;
  savedAt: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('owner', 'owner');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Stockage local indisponible.'));
    });
  } finally {
    db.close();
  }
}

const keyFor = (owner: string, fileId: string) => `${owner}:${fileId}`;

/** Enregistrement conservé sur l'appareil pour le titulaire du coffre ouvert, ou null. */
export async function readLocalAudio(src: string): Promise<Blob | null> {
  const owner = ownerId();
  const fileId = lessonImageFileId(src);
  if (!owner || !fileId || typeof indexedDB === 'undefined') return null;
  try {
    const row = await run<LocalAudio | undefined>('readonly', (store) =>
      store.get(keyFor(owner, fileId)),
    );
    return row?.blob ?? null;
  } catch {
    return null;
  }
}

/** Taille de la copie locale (octets), ou null si absente. */
export async function localAudioSize(src: string): Promise<number | null> {
  const blob = await readLocalAudio(src);
  return blob ? blob.size : null;
}

/**
 * Télécharge l'enregistrement (lecture contrôlée par la session, puis URL signée courte) et le
 * conserve sur l'appareil. Exige le réseau et le titulaire du coffre connecté.
 */
export async function downloadLocalAudio(src: string): Promise<number> {
  const fileId = lessonImageFileId(src);
  if (!fileId) throw new Error('Enregistrement non téléchargeable.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Connexion requise pour télécharger.');
  }
  await assertOnlineOwner();
  const owner = ownerId();
  if (!owner) throw new Error('Ouvrez d’abord votre espace sur cet appareil.');
  const response = await fetch(resolveImageSrc(src), {
    credentials: 'include',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(120_000),
  });
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!response.ok || !mime.startsWith('audio/')) {
    throw new Error('Enregistrement inaccessible. Réessayez plus tard.');
  }
  const blob = await response.blob();
  if (blob.size === 0 || blob.size > MAX_LOCAL_AUDIO_BYTES) {
    throw new Error('Enregistrement trop volumineux pour cet appareil.');
  }
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < blob.size * 2
  ) {
    throw new Error('Espace local insuffisant.');
  }
  const row: LocalAudio = {
    key: keyFor(owner, fileId),
    owner,
    fileId,
    blob,
    bytes: blob.size,
    savedAt: new Date().toISOString(),
  };
  await run('readwrite', (store) => store.put(row));
  return blob.size;
}

/** Supprime la copie locale (aucun effet sur les résultats ni sur le carnet). */
export async function removeLocalAudio(src: string): Promise<void> {
  const owner = ownerId();
  const fileId = lessonImageFileId(src);
  if (!owner || !fileId) return;
  await run('readwrite', (store) => store.delete(keyFor(owner, fileId)));
}
