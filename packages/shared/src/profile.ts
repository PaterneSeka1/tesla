import { z } from 'zod';
import { MEMBERSHIP_STATUSES, THEORETICAL_STAGE_REASONS } from './age-progression.js';
import { LEADER_FUNCTIONS } from './roles.js';
import { stageSummarySchema, teamRefSchema } from './scouts.js';

// « Mon profil » (D173) : lecture seule des données administratives et des valeurs calculées par
// l'API. Aucune de ces informations n'est modifiable par son titulaire.

const civilDate = z.iso.date();

/** Durée révolue (ancienneté à la Route). */
export const elapsedDurationSchema = z.object({
  years: z.number().int().nonnegative(),
  months: z.number().int().min(0).max(11),
});

export type ElapsedDuration = z.infer<typeof elapsedDurationSchema>;

/** Partie « routier » : fiche administrative et parcours calculé selon l'âge. */
export const myScoutProfileSchema = z.object({
  matricule: z.string().nullable(),
  team: teamRefSchema.nullable(),
  birthDate: civilDate.nullable(),
  age: z.number().int().nullable(),
  joinedAt: civilDate.nullable(),
  seniority: elapsedDurationSchema.nullable(),
  /** Étape actuelle calculée (nulle = non déterminée, motif dans `stageReason`). */
  stage: stageSummarySchema.nullable(),
  stageReason: z.enum(THEORETICAL_STAGE_REASONS),
  ruleSetVersion: z.string().nullable(),
  /** Prochaine transition connue (début ou fin d'étape, sortie de la branche). */
  nextMilestone: z
    .object({
      kind: z.enum(['DEBUT_ETAPE', 'FIN_ETAPE', 'SORTIE_BRANCHE']),
      stage: stageSummarySchema.nullable(),
      date: civilDate,
    })
    .nullable(),
  branchExitOn: civilDate.nullable(),
  membership: z.enum(MEMBERSHIP_STATUSES).nullable(),
  /** Rattrapages : obligations sans décision encore exigées, et modules reconnus acquis. */
  catchUps: z.object({ open: z.number().int(), acquired: z.number().int() }),
});

export type MyScoutProfile = z.infer<typeof myScoutProfileSchema>;

export const myProfileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  /** Fonction d'encadrement en cours (désignée par l'administrateur), nulle sinon. */
  leaderFunction: z.enum(LEADER_FUNCTIONS).nullable(),
  /** Fiche routier rattachée au compte, nulle pour l'encadrement ou sans fiche. */
  scout: myScoutProfileSchema.nullable(),
});

export type MyProfile = z.infer<typeof myProfileSchema>;
