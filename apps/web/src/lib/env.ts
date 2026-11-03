import { z } from 'zod';

const publicEnvSchema = z.object({
  /**
   * URL absolue de l'API (développement, mode historique) ou `/api/v1` : appels même origine,
   * relayés vers l'API par `src/proxy.ts` (web sur Vercel, docs/DEPLOYMENT_VERCEL_OVH.md).
   */
  NEXT_PUBLIC_API_URL: z.union([z.url(), z.literal('/api/v1')], {
    error: 'NEXT_PUBLIC_API_URL doit être une URL valide ou « /api/v1 »',
  }),
});

const result = publicEnvSchema.safeParse({
  // Référence littérale obligatoire pour que Next.js intègre la variable au build.
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!result.success) {
  throw new Error(`Configuration web invalide :\n${z.prettifyError(result.error)}`);
}

export const env = result.data;
