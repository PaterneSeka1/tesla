import { apiErrorSchema } from '@tesla/shared';
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
      headers: { Accept: 'application/json', ...init?.headers },
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
