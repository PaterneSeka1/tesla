import { apiErrorSchema, CSRF_HEADER, CSRF_HEADER_VALUE } from '@tesla/shared';
import { type z } from 'zod';
import { env } from '@/lib/env';

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
      'Impossible de joindre le serveur. Vérifiez votre connexion.',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    if (error.success)
      throw new ApiError(error.data.statusCode, error.data.code, error.data.message);
    throw new ApiError(response.status, 'UNKNOWN_ERROR', 'Une erreur inattendue est survenue.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Réponse du serveur inattendue.');
  }
  return parsed.data;
}

/** Écriture JSON (POST, PATCH, PUT, DELETE) avec réponse validée (`z.null()` pour une réponse 204). */
export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  schema: z.ZodType<T>,
  body: unknown = {},
): Promise<T> {
  return apiFetch(path, schema, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
