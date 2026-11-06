import { z } from 'zod';
import {
  addCalendarDays,
  compareCivilDates,
  MEMBERSHIP_STATUSES,
  THEORETICAL_STAGE_REASONS,
} from './age-progression.js';
import { userSummarySchema } from './api.js';
import { scoutRefSchema } from './progression.js';
import { stageSummarySchema } from './scouts.js';

// Correction exceptionnelle de l'étape (procédure de secours, D176). La progression par l'âge reste
// la règle : une exception est temporaire, motivée, historisée, réservée au responsable plein en
// fonction, et ne modifie jamais l'âge, la date d'entrée, les acquis, les cérémonies ni la sortie de
// la branche (21e anniversaire). Elle cesse d'elle-même à sa date de fin.

/**
 * État d'une exception à une date :
 * - `PROGRAMMEE` : pas encore commencée ; `ACTIVE` : appliquée ;
 * - `EXPIREE` : date de fin dépassée ; `LEVEE` : levée par le responsable ;
 * - `INOPERANTE` : le routier est sorti de la branche, l'exception ne s'applique plus.
 */
export const STAGE_OVERRIDE_STATUSES = [
  'PROGRAMMEE',
  'ACTIVE',
  'EXPIREE',
  'LEVEE',
  'INOPERANTE',
] as const;
export type StageOverrideStatus = (typeof STAGE_OVERRIDE_STATUSES)[number];

export const STAGE_OVERRIDE_STATUS_LABELS: Record<StageOverrideStatus, string> = {
  PROGRAMMEE: 'Programmée',
  ACTIVE: 'En cours',
  EXPIREE: 'Expirée',
  LEVEE: 'Levée',
  INOPERANTE: 'Sans effet (sortie de la branche)',
};

/** Période d'une exception : du `startsOn` au `endsOn` **inclus**. */
export interface StageOverridePeriod {
  startsOn: string;
  endsOn: string;
  liftedAt: string | null;
}

export function stageOverrideStatus(
  override: StageOverridePeriod,
  today: string,
  branchExitOn: string | null,
): StageOverrideStatus {
  if (override.liftedAt !== null) return 'LEVEE';
  if (branchExitOn !== null && compareCivilDates(today, branchExitOn) >= 0) return 'INOPERANTE';
  if (compareCivilDates(today, override.startsOn) < 0) return 'PROGRAMMEE';
  if (compareCivilDates(today, override.endsOn) > 0) return 'EXPIREE';
  return 'ACTIVE';
}

/**
 * Exception appliquée à une date (au plus une : la base interdit les chevauchements). Jamais au-delà
 * de la veille du 21e anniversaire, quelle que soit sa date de fin.
 */
export function activeStageOverride<T extends StageOverridePeriod>(
  overrides: readonly T[],
  today: string,
  branchExitOn: string | null,
): T | null {
  return (
    overrides.find((row) => stageOverrideStatus(row, today, branchExitOn) === 'ACTIVE') ?? null
  );
}

/** Dernier jour d'appartenance à la branche (veille du jour de sortie). */
export function lastDayInBranch(branchExitOn: string): string {
  return addCalendarDays(branchExitOn, -1);
}

// ─── Contrats d'API (responsable plein en fonction uniquement) ──────────────

const civilDate = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

const overrideReason = z
  .string()
  .trim()
  .min(10, { error: 'Le motif est obligatoire (10 caractères au minimum).' })
  .max(2000, { error: '2 000 caractères au maximum.' });

const overridePeriodFields = {
  stageCode: z.string().trim().min(1, { error: 'Choisissez une étape.' }),
  startsOn: civilDate,
  endsOn: civilDate,
  reason: overrideReason,
};

const periodOrder = (data: { startsOn: string; endsOn: string }, ctx: z.RefinementCtx) => {
  if (compareCivilDates(data.endsOn, data.startsOn) < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsOn'],
      message: 'La date de fin doit suivre la date de début.',
    });
  }
};

/** Aperçu des conséquences, sans écriture. */
export const previewStageOverrideInputSchema = z
  .object(overridePeriodFields)
  .superRefine(periodOrder);
export type PreviewStageOverrideInput = z.input<typeof previewStageOverrideInputSchema>;

export const createStageOverrideInputSchema = z
  .object({
    ...overridePeriodFields,
    confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
  })
  .superRefine(periodOrder);
export type CreateStageOverrideInput = z.input<typeof createStageOverrideInputSchema>;

export const liftStageOverrideInputSchema = z.object({
  reason: overrideReason,
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});
export type LiftStageOverrideInput = z.input<typeof liftStageOverrideInputSchema>;

export const stageOverrideSchema = z.object({
  id: z.uuid(),
  stage: stageSummarySchema,
  /** Étape normalement calculée au moment de la demande (nulle = non déterminée). */
  computedStageAtRequest: stageSummarySchema.nullable(),
  reason: z.string(),
  startsOn: civilDate,
  endsOn: civilDate,
  status: z.enum(STAGE_OVERRIDE_STATUSES),
  createdAt: z.iso.datetime(),
  createdBy: userSummarySchema.nullable(),
  liftedAt: z.iso.datetime().nullable(),
  liftedBy: userSummarySchema.nullable(),
  liftReason: z.string().nullable(),
});
export type StageOverride = z.infer<typeof stageOverrideSchema>;

export const stageOverridePreviewSchema = z.object({
  computedStage: stageSummarySchema.nullable(),
  requestedStage: stageSummarySchema,
  startsOn: civilDate,
  endsOn: civilDate,
  /** Nombre de jours d'application (bornes incluses). */
  days: z.number().int(),
  /** Dernier jour dans la branche : l'exception ne peut aller au-delà. */
  lastDayInBranch: civilDate,
  /** Modules publiés de l'étape demandée, accessibles pendant l'exception. */
  requestedStageModules: z.number().int(),
  /** Modules publiés de l'étape normale, qui ne seront plus présentés comme « de mon étape ». */
  computedStageModules: z.number().int(),
  /** Obligations de rattrapage ouvertes : conservées, jamais effacées par l'exception. */
  openCatchUps: z.number().int(),
  /** Exception déjà programmée ou en cours sur une période qui se chevauche (refus). */
  conflict: z.boolean(),
});
export type StageOverridePreview = z.infer<typeof stageOverridePreviewSchema>;

/**
 * Supervision de la progression d'un routier : règles et explications internes, réservées au
 * responsable plein en fonction (D176). Jamais transmise aux autres profils ni conservée hors ligne.
 */
export const stageSupervisionSchema = z.object({
  scout: scoutRefSchema,
  referenceDate: civilDate,
  ruleSetVersion: z.string().nullable(),
  catchUpDelayMonths: z.number().int().nullable(),
  catchUpDelayDays: z.number().int().nullable(),
  birthDate: civilDate.nullable(),
  joinedAt: civilDate.nullable(),
  age: z.number().int().nullable(),
  /** Étape normale selon l'âge. */
  computedStage: stageSummarySchema.nullable(),
  computedReason: z.enum(THEORETICAL_STAGE_REASONS),
  /** Exception en cours (nulle sinon). */
  activeOverride: stageOverrideSchema.nullable(),
  /** Étape effectivement appliquée au parcours. */
  effectiveStage: stageSummarySchema.nullable(),
  periods: z.array(
    z.object({
      stage: stageSummarySchema,
      startsOn: civilDate,
      /** Échéance exclue ; nulle = jusqu'à la sortie. */
      endsOn: civilDate.nullable(),
    }),
  ),
  branchExitOn: civilDate.nullable(),
  membership: z.enum(MEMBERSHIP_STATUSES).nullable(),
  /** Étapes pouvant faire l'objet d'une exception (toutes sauf l'étape normale). */
  allowedStages: z.array(stageSummarySchema),
  /** Exception possible : date de naissance connue, routier dans la branche. */
  canOverride: z.boolean(),
  overrides: z.array(stageOverrideSchema),
});
export type StageSupervision = z.infer<typeof stageSupervisionSchema>;
