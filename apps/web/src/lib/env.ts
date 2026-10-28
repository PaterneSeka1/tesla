import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url({ error: 'NEXT_PUBLIC_API_URL doit être une URL valide' }),
});

const result = publicEnvSchema.safeParse({
  // Référence littérale obligatoire pour que Next.js intègre la variable au build.
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!result.success) {
  throw new Error(`Configuration web invalide :\n${z.prettifyError(result.error)}`);
}

export const env = result.data;
