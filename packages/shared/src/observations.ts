import { z } from 'zod';
import { userSummarySchema } from './api.js';

/** Niveaux d'accès. Doit rester synchronisé avec l'enum Prisma `ObservationVisibility` (vérifié par un test). */
export const OBSERVATION_VISIBILITIES = ['ENCADREMENT', 'RESPONSABLE'] as const;

export type ObservationVisibility = (typeof OBSERVATION_VISIBILITIES)[number];

export const OBSERVATION_VISIBILITY_LABELS: Record<ObservationVisibility, string> = {
  ENCADREMENT: 'Chefs et responsable',
  RESPONSABLE: 'Responsable uniquement',
};

const contentSchema = z
  .string()
  .trim()
  .min(1, { error: 'Le contenu est requis.' })
  .max(5000, { error: '5 000 caractères au maximum.' });

/** Libellé libre facultatif ; chaîne vide = aucune catégorie. */
const categorySchema = z
  .string()
  .trim()
  .max(80, { error: '80 caractères au maximum.' })
  .transform((value) => (value === '' ? null : value));

/** Observation d'accompagnement : jamais une validation officielle d'acquis ou d'étape. */
export const createObservationInputSchema = z.object({
  observedOn: z.iso.date({ error: 'Date invalide.' }),
  content: contentSchema,
  category: categorySchema.optional(),
  visibility: z.enum(OBSERVATION_VISIBILITIES).default('ENCADREMENT'),
});

export type CreateObservationInput = z.input<typeof createObservationInputSchema>;

export const updateObservationInputSchema = z
  .object({
    observedOn: z.iso.date({ error: 'Date invalide.' }).optional(),
    content: contentSchema.optional(),
    category: categorySchema.nullable().optional(),
    visibility: z.enum(OBSERVATION_VISIBILITIES).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Aucune modification fournie.',
  });

export type UpdateObservationInput = z.input<typeof updateObservationInputSchema>;

export const observationSchema = z.object({
  id: z.uuid(),
  scoutProfileId: z.uuid(),
  author: userSummarySchema,
  observedOn: z.iso.date(),
  content: z.string(),
  category: z.string().nullable(),
  visibility: z.enum(OBSERVATION_VISIBILITIES),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  /** Seul l'auteur peut modifier son observation. */
  canEdit: z.boolean(),
});

export type Observation = z.infer<typeof observationSchema>;

export const observationRevisionSchema = z.object({
  id: z.uuid(),
  editor: userSummarySchema,
  observedOn: z.iso.date(),
  content: z.string(),
  category: z.string().nullable(),
  visibility: z.enum(OBSERVATION_VISIBILITIES),
  /** Date à laquelle cet état a été remplacé. */
  replacedAt: z.iso.datetime(),
});

export type ObservationRevision = z.infer<typeof observationRevisionSchema>;

export const observationRevisionListSchema = z.object({
  items: z.array(observationRevisionSchema),
});
