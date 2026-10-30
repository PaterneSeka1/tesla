import { apiErrorSchema, CSRF_HEADER, CSRF_HEADER_VALUE, OPERATION_ID_HEADER } from '@tesla/shared';
import { type z } from 'zod';
import { env } from '@/lib/env';
import { enqueueOperation, OfflineQueuedError, type OfflineWrite } from '@/lib/offline/operations';
import { readStoredResponse, storeResponse } from '@/lib/offline/repository';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Profondeur des lectures strictes en cours (voir `withStrictReads`). */
let strictReads = 0;

/**
 * Lectures strictes (préparation de l'appareil, téléchargement d'un module) : jamais de repli sur
 * la copie locale, et une copie qui n'a pas pu être enregistrée (quota, appareil verrouillé) est
 * une erreur. Un rapport « Prêt » ne peut donc pas reposer sur des données anciennes ou absentes.
 */
export async function withStrictReads<T>(run: () => Promise<T>): Promise<T> {
  strictReads++;
  try {
    return await run();
  } finally {
    strictReads--;
  }
}

/**
 * Appel typé de l'API : la réponse est validée par un schéma Zod partagé.
 * Les erreurs sont normalisées en `ApiError` avec un message affichable en français.
 * La session est portée par un cookie httpOnly (`credentials: 'include'`) ; les écritures
 * ajoutent l'en-tête anti-CSRF exigé par l'API.
 */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const read = !init?.method || init.method === 'GET';
  if (!read) return request(path, schema, init);
  // Lecture offline-first (D109) : réseau si disponible, sinon dernière copie de cet appareil.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const strict = strictReads > 0;
  if (!offline || strict) {
    try {
      const data = await request(path, schema, init);
      if (strict) await storeResponse(path, data, { strict });
      else await storeResponse(path, data).catch(() => {});
      return data;
    } catch (error) {
      if (strict || !(error instanceof ApiError) || error.status !== 0) throw error;
    }
  }
  const stored = await readStoredResponse(path).catch(() => null);
  const parsed = stored ? schema.safeParse(stored.body) : null;
  if (parsed?.success) return parsed.data;
  throw new ApiError(
    0,
    'NETWORK_ERROR',
    stored === null
      ? 'Hors connexion : ces données ne sont pas encore disponibles sur cet appareil.'
      : 'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
  );
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.method && init.method !== 'GET' && { [CSRF_HEADER]: CSRF_HEADER_VALUE }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Connexion impossible. Vérifiez votre réseau, puis réessayez.',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    if (error.success)
      throw new ApiError(error.data.statusCode, error.data.code, error.data.message);
    throw new ApiError(response.status, 'UNKNOWN_ERROR', 'Une erreur est survenue. Réessayez.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Une erreur est survenue. Réessayez.');
  }
  return parsed.data;
}

/**
 * Écriture JSON (POST, PATCH, PUT, DELETE) avec réponse validée (`z.null()` pour une réponse 204).
 * Avec `offline`, l'écriture est rejouable (D110) : elle porte un identifiant d'opération et, sans
 * réseau, elle est enregistrée dans la file de l'appareil ; `OfflineQueuedError` est alors levée
 * (l'appelant l'affiche comme « en attente de synchronisation », jamais comme un succès serveur).
 */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  schema: z.ZodType<T>,
  body: unknown = {},
  offline?: OfflineWrite,
): Promise<T> {
  const operationId = offline ? crypto.randomUUID() : null;
  const queue = async (sent: boolean): Promise<never> => {
    const op = await enqueueOperation(operationId!, method, path, body, offline!, { sent });
    throw new OfflineQueuedError(op.id, op.tempId);
  };
  if (offline && typeof navigator !== 'undefined' && navigator.onLine === false)
    return queue(false);
  try {
    return await apiFetch(path, schema, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(operationId && { [OPERATION_ID_HEADER]: operationId }),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Réseau coupé pendant l'envoi : même identifiant, le serveur déduplique s'il l'avait reçu.
    if (offline && error instanceof ApiError && error.status === 0) return queue(true);
    throw error;
  }
}

/** Paramètres de requête sans les valeurs vides. */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if ((typeof value === 'string' && value !== '') || typeof value === 'number') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
