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
