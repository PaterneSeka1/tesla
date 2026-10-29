import { z } from 'zod';
import { ROLES } from './roles.js';

/** Nom du cookie de session (httpOnly, posé et lu uniquement par l'API). */
export const SESSION_COOKIE_NAME = 'tesla_session';

export const loginInputSchema = z.object({
  email: z
    .email({ error: 'Adresse e-mail invalide.' })
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(1, { error: 'Le mot de passe est requis.' })
    .max(256, { error: 'Mot de passe trop long.' }),
});

export type LoginInput = z.input<typeof loginInputSchema>;

/** Utilisateur connecté. `scoutProfileId` : profil routier rattaché au compte, le cas échéant. */
export const sessionUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(ROLES),
  scoutProfileId: z.uuid().nullable(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const meResponseSchema = z.object({ user: sessionUserSchema });

export type MeResponse = z.infer<typeof meResponseSchema>;
