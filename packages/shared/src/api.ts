import { z } from 'zod';

export const API_PREFIX = 'api/v1';

/** Réponse de `GET /api/v1/health`. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
  database: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Format homogène des erreurs renvoyées par l'API. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  path: z.string(),
  timestamp: z.iso.datetime(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/**
 * En-tête anti-CSRF exigé par l'API sur toute requête modifiant des données (POST, PATCH, PUT, DELETE).
 * Un en-tête personnalisé impose un pré-vol CORS : un site tiers ne peut pas l'envoyer.
 */
export const CSRF_HEADER = 'x-tesla-csrf';
export const CSRF_HEADER_VALUE = '1';

/** Pagination des listes : `?page=1&pageSize=20`. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().nonnegative(),
  });
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Recherche textuelle facultative (chaîne vide = aucun filtre). */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => (value ? value : undefined));

/** Personne affichée comme auteur d'une action (jamais l'e-mail). */
export const userSummarySchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
