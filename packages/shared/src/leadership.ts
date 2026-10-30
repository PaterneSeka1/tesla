import { z } from 'zod';
import { userSummarySchema } from './api.js';
import { LEADER_FUNCTIONS } from './roles.js';

// Encadrement : fonctions désignées par l'administrateur (D132, docs/FEATURES/ENCADREMENT.md).
// Aucune année scoute, aucune reconduction, aucune délégation.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/** Membre de l'encadrement en fonction (visible par tous les membres connectés). */
export const leadershipMemberSchema = z.object({
  assignmentId: z.uuid(),
  user: userSummarySchema,
  function: z.enum(LEADER_FUNCTIONS),
  since: z.iso.datetime(),
});

export type LeadershipMember = z.infer<typeof leadershipMemberSchema>;

/** Composition actuelle : responsable plein (ou vacance), adjoint, assistants. */
export const leadershipTeamSchema = z.object({ members: z.array(leadershipMemberSchema) });

export type LeadershipTeam = z.infer<typeof leadershipTeamSchema>;

/** Désignation historisée (en cours si `endedAt` est nul). */
export const leadershipAssignmentSchema = z.object({
  id: z.uuid(),
  user: userSummarySchema,
  function: z.enum(LEADER_FUNCTIONS),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  reason: z.string().nullable(),
  endReason: z.string().nullable(),
  assignedBy: userSummarySchema.nullable(),
  endedBy: userSummarySchema.nullable(),
  /** Reprise d'un ancien mandat lors de la migration. */
  migrated: z.boolean(),
});

export type LeadershipAssignment = z.infer<typeof leadershipAssignmentSchema>;

/** Vue d'administration : composition, personnes désignables, historique complet. */
export const leadershipAdminSchema = z.object({
  members: z.array(leadershipMemberSchema),
  /** Comptes actifs de l'encadrement, seuls désignables, avec leur fonction actuelle. */
  staff: z.array(
    userSummarySchema.extend({ currentFunction: z.enum(LEADER_FUNCTIONS).nullable() }),
  ),
  history: z.array(leadershipAssignmentSchema),
});

export type LeadershipAdmin = z.infer<typeof leadershipAdminSchema>;

/**
 * Désigner une personne à une fonction. Si elle exerçait une autre fonction, celle-ci prend fin.
 * Remplacer le responsable plein exige `confirmReplacement: true` (aucun remplacement implicite).
 */
export const assignLeaderInputSchema = z.object({
  userId: z.uuid({ error: 'Choisissez une personne.' }),
  function: z.enum(LEADER_FUNCTIONS, { error: 'Choisissez une fonction.' }),
  reason: optionalText(500),
  confirmReplacement: z.boolean().optional(),
});

export type AssignLeaderInput = z.input<typeof assignLeaderInputSchema>;

export const endLeaderInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Le motif est obligatoire (3 caractères au minimum).' })
    .max(500, { error: '500 caractères au maximum.' }),
});

export type EndLeaderInput = z.input<typeof endLeaderInputSchema>;
