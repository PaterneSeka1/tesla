import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { EVALUATION_MODES, ATTEMPT_STATUSES } from './evaluations.js';

/**
 * Matricule scout (RM-002) : chaîne, jamais un entier (zéros initiaux conservés), jamais généré par l'application.
 * Normalisation : suppression de tous les espaces, passage en majuscules ; chaîne vide = non renseigné.
 * Format officiel (confirmé par le responsable, invariable) : 7 chiffres suivis d'une lettre, ex. « 0000001A ».
 * Même règle que la contrainte SQL `scout_profiles_matricule_format_check`.
 */
export const MATRICULE_PATTERN = /^\d{7}[A-Z]$/;

export function normalizeMatricule(raw: string): string | null {
  const value = raw.replace(/\s+/g, '').toUpperCase();
  return value === '' ? null : value;
}

export const matriculeSchema = z
  .string()
  .transform(normalizeMatricule)
  .refine((value) => value === null || MATRICULE_PATTERN.test(value), {
    message: 'Matricule invalide : 7 chiffres suivis d’une lettre (ex. 0000001A).',
  });

const personNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ce champ est requis.' })
  .max(100, { error: '100 caractères au maximum.' });

const calendarDateSchema = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

/**
 * Inscription d'un routier, sans adresse e-mail ni mot de passe : aucun compte n'est créé (RM-001).
 * `teamId` : affectation initiale facultative (même transaction).
 * `confirmDuplicate` : confirme l'inscription malgré un homonyme déjà enregistré.
 */
export const createScoutProfileInputSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  matricule: matriculeSchema.optional(),
  birthDate: calendarDateSchema.optional(),
  joinedAt: calendarDateSchema,
  currentStageId: z.uuid().optional(),
  teamId: z.uuid().optional(),
  confirmDuplicate: z.boolean().optional(),
});

export type CreateScoutProfileInput = z.input<typeof createScoutProfileInputSchema>;

/**
 * Modification d'une fiche. `null` (ou chaîne vide pour le matricule) retire la valeur.
 * Le changement d'étape est réservé au responsable (vérifié par l'API).
 */
export const updateScoutProfileInputSchema = z
  .object({
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    matricule: matriculeSchema.nullable().optional(),
    birthDate: calendarDateSchema.nullable().optional(),
    joinedAt: calendarDateSchema.optional(),
    currentStageId: z.uuid().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Aucune modification fournie.',
  });

export type UpdateScoutProfileInput = z.input<typeof updateScoutProfileInputSchema>;

/** Filtre « aucun » pour l'équipe ou l'étape (routiers sans équipe, sans étape renseignée). */
export const NONE_FILTER = 'none';

export const scoutListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  teamId: z.union([z.uuid(), z.literal(NONE_FILTER)]).optional(),
  stageId: z.union([z.uuid(), z.literal(NONE_FILTER)]).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  account: z.enum(['with', 'without', 'all']).default('all'),
});

export type ScoutListQuery = z.input<typeof scoutListQuerySchema>;

/** Rattachement d'un compte routier existant, désigné par son adresse e-mail. */
export const linkAccountInputSchema = z.object({
  email: z
    .email({ error: 'Adresse e-mail invalide.' })
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
});

export type LinkAccountInput = z.input<typeof linkAccountInputSchema>;

const teamNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Le nom est requis.' })
  .max(80, { error: '80 caractères au maximum.' });

const teamDescriptionSchema = z
  .string()
  .trim()
  .max(500, { error: '500 caractères au maximum.' })
  .transform((value) => (value === '' ? null : value));

export const createTeamInputSchema = z.object({
  name: teamNameSchema,
  description: teamDescriptionSchema.optional(),
});

export type CreateTeamInput = z.input<typeof createTeamInputSchema>;

export const updateTeamInputSchema = z
  .object({
    name: teamNameSchema.optional(),
    description: teamDescriptionSchema.nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'Aucune modification fournie.',
  });

export type UpdateTeamInput = z.input<typeof updateTeamInputSchema>;

export const teamListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export type TeamListQuery = z.input<typeof teamListQuerySchema>;

/** Affectation à une équipe (RM-003). L'affectation ouverte précédente est close à `startedAt`. */
export const assignTeamInputSchema = z.object({
  scoutProfileId: z.uuid(),
  teamId: z.uuid(),
  startedAt: z.iso.datetime().optional(),
});

export type AssignTeamInput = z.input<typeof assignTeamInputSchema>;

/** Corps de `POST /scouts/:id/teams/assign` (le routier est désigné par l'URL). */
export const assignTeamBodySchema = assignTeamInputSchema.omit({ scoutProfileId: true });

export type AssignTeamBody = z.input<typeof assignTeamBodySchema>;

/** Corps de `POST /scouts/:id/teams/unassign`. */
export const unassignTeamBodySchema = z.object({ endedAt: z.iso.datetime().optional() });

export type UnassignTeamBody = z.input<typeof unassignTeamBodySchema>;

// ─── Réponses de l'API ──────────────────────────────────────────────

export const stageSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  position: z.number().int(),
});

export type StageSummary = z.infer<typeof stageSummarySchema>;

export const teamRefSchema = z.object({ id: z.uuid(), name: z.string() });

export const teamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Routiers actuellement affectés (affectations ouvertes). */
  memberCount: z.number().int().nonnegative(),
});

export type Team = z.infer<typeof teamSchema>;

export const teamMemberSchema = z.object({
  scoutProfileId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  matricule: z.string().nullable(),
  stage: stageSummarySchema.nullable(),
  since: z.iso.datetime(),
});

export const teamDetailSchema = teamSchema.extend({ members: z.array(teamMemberSchema) });

export type TeamDetail = z.infer<typeof teamDetailSchema>;

export const scoutListItemSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  matricule: z.string().nullable(),
  isActive: z.boolean(),
  joinedAt: z.iso.date(),
  stage: stageSummarySchema.nullable(),
  team: teamRefSchema.nullable(),
  hasAccount: z.boolean(),
});

export type ScoutListItem = z.infer<typeof scoutListItemSchema>;

export const scoutDetailSchema = scoutListItemSchema.extend({
  birthDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Compte rattaché. L'e-mail n'est communiqué qu'au responsable. */
  account: z
    .object({
      email: z.string().nullable(),
      isActive: z.boolean(),
      lastLoginAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});

export type ScoutDetail = z.infer<typeof scoutDetailSchema>;

export const teamAssignmentSchema = z.object({
  id: z.uuid(),
  team: teamRefSchema.extend({ archived: z.boolean() }),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  assignedBy: userSummarySchema.nullable(),
  endedBy: userSummarySchema.nullable(),
});

export type TeamAssignment = z.infer<typeof teamAssignmentSchema>;

/** Historique pédagogique réel : tentatives enregistrées et changements d'étape journalisés. */
export const scoutPedagogicalHistorySchema = z.object({
  attempts: z.array(
    z.object({
      id: z.uuid(),
      code: z.string(),
      evaluationTitle: z.string(),
      mode: z.enum(EVALUATION_MODES),
      status: z.enum(ATTEMPT_STATUSES),
      completedAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  stageChanges: z.array(
    z.object({
      at: z.iso.datetime(),
      from: stageSummarySchema.nullable(),
      to: stageSummarySchema.nullable(),
      by: userSummarySchema.nullable(),
    }),
  ),
});

export type ScoutPedagogicalHistory = z.infer<typeof scoutPedagogicalHistorySchema>;

export const stageListResponseSchema = z.object({ items: z.array(stageSummarySchema) });

export type StageListResponse = z.infer<typeof stageListResponseSchema>;

export const teamAssignmentListSchema = z.object({ items: z.array(teamAssignmentSchema) });

export type TeamAssignmentList = z.infer<typeof teamAssignmentListSchema>;
