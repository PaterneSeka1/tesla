import { ensureVaultRestored, ownerId, putRecord, readRecord } from './vault';

// Dépôt de lecture offline-first (D109) : chaque réponse GET autorisée est conservée, chiffrée,
// dans le coffre du compte ; sans réseau, la même requête est servie depuis cette copie. Une seule
// logique pour tous les écrans (via `apiFetch`) : aucune page n'a son propre cache.

export interface CachedResponse {
  body: unknown;
  fetchedAt: string;
  /** Opérations locales déjà appliquées à cette copie (affichage provisoire). */
  pendingOperationIds?: string[];
}

/**
 * Jamais conservé sur l'appareil : session, réservations hors ligne, passation en ligne, et tout ce
 * qui contient corrigés ou barèmes (rédaction et revue des questionnaires, corrections, examen des
 * résultats), ainsi que la gestion des comptes. Ces écrans exigent le serveur (D113).
 */
const EXCLUDED_PREFIXES = [
  '/auth/',
  '/users',
  '/offline/',
  '/attempts/',
  '/editor/evaluations',
  '/admin/evaluations',
  '/admin/attempts',
  '/corrections',
  '/paper',
];
export function isCacheablePath(path: string) {
  return !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix)) && !path.includes('/pdf');
}
/** Clé stable : paramètres triés (l'ordre de construction d'une requête ne compte pas). */
export function cacheKey(path: string) {
  const [base, query = ''] = path.split('?', 2);
  const params = new URLSearchParams(query);
  params.sort();
  const search = params.toString();
  return `q:${base}${search ? `?${search}` : ''}`;
}
const key = cacheKey;

/** Chemins servis depuis l'appareil, avec la date de leur dernière copie serveur. */
const servedLocally = new Map<string, string>();
function freshnessChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('offline-freshness-change'));
}
export function localFreshness(): { count: number; oldest: string | null } {
  const dates = [...servedLocally.values()].sort();
  return { count: dates.length, oldest: dates[0] ?? null };
}
export function clearLocalFreshness() {
  servedLocally.clear();
  freshnessChanged();
}

/** `strict` : une copie non enregistrée (appareil verrouillé, quota dépassé) lève une erreur. */
export async function storeResponse(path: string, body: unknown, { strict = false } = {}) {
  if (!isCacheablePath(path)) return;
  await ensureVaultRestored();
  const written =
    ownerId() !== null &&
    (await putRecord(key(path), {
      body,
      fetchedAt: new Date().toISOString(),
    } satisfies CachedResponse));
  if (written && servedLocally.delete(path)) freshnessChanged();
  if (!written && strict) throw new Error('Copie locale impossible : appareil verrouillé.');
}

export async function readStoredResponse(path: string): Promise<CachedResponse | null> {
  if (!isCacheablePath(path)) return null;
  await ensureVaultRestored();
  if (!ownerId()) return null;
  const row = await readRecord<CachedResponse>(key(path)).catch(() => null);
  if (!row) return null;
  servedLocally.set(path, row.value.fetchedAt);
  freshnessChanged();
  return row.value;
}

/**
 * Applique localement une modification en attente à une copie existante (affichage provisoire
 * jusqu'à la confirmation du serveur, qui remplacera la copie au prochain rafraîchissement).
 */
export async function patchStoredResponse(
  path: string,
  operationId: string,
  update: (body: unknown) => unknown,
) {
  if (!ownerId()) return;
  const row = await readRecord<CachedResponse>(key(path)).catch(() => null);
  if (!row) return;
  await putRecord(key(path), {
    body: update(row.value.body),
    fetchedAt: row.value.fetchedAt,
    pendingOperationIds: [...(row.value.pendingOperationIds ?? []), operationId],
  } satisfies CachedResponse);
}
