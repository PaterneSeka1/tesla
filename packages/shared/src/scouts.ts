import { z } from 'zod';

/**
 * Matricule scout (RM-002) : chaîne, jamais un entier (zéros initiaux conservés), jamais généré par l'application.
 * Normalisation : suppression de tous les espaces, passage en majuscules ; chaîne vide = non renseigné.
 * Le format officiel n'étant pas confirmé, seuls les caractères A-Z, 0-9, « . », « / » et « - » sont admis
 * (même règle que la contrainte SQL `scout_profiles_matricule_format_check`).
 */
export const MATRICULE_PATTERN = /^[A-Z0-9][A-Z0-9./-]{0,31}$/;

export function normalizeMatricule(raw: string): string | null {
  const value = raw.replace(/\s+/g, '').toUpperCase();
  return value === '' ? null : value;
}

export const matriculeSchema = z
  .string()
  .transform(normalizeMatricule)
  .refine((value) => value === null || MATRICULE_PATTERN.test(value), {
    message:
      'Matricule invalide : lettres, chiffres, « . », « / » ou « - » (32 caractères au plus).',
  });

const personNameSchema = z.string().trim().min(1).max(100);

/** Inscription d'un routier, avec ou sans compte (RM-001). */
export const createScoutProfileInputSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  matricule: matriculeSchema.optional(),
  birthDate: z.iso.date().optional(),
  joinedAt: z.iso.date(),
  currentStageId: z.uuid().optional(),
});

export type CreateScoutProfileInput = z.input<typeof createScoutProfileInputSchema>;

export const createTeamInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});

export type CreateTeamInput = z.input<typeof createTeamInputSchema>;

/** Affectation à une équipe (RM-003). L'affectation ouverte précédente est close à `startedAt`. */
export const assignTeamInputSchema = z.object({
  scoutProfileId: z.uuid(),
  teamId: z.uuid(),
  startedAt: z.iso.datetime().optional(),
});

export type AssignTeamInput = z.input<typeof assignTeamInputSchema>;
