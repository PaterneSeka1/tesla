import { z } from 'zod';
import { userSummarySchema } from './api.js';
import { ageProgressionSchema, ageRuleSetSchema, MEMBERSHIP_STATUSES } from './age-progression.js';
import { scoutRefSchema } from './progression.js';
import { stageSummarySchema } from './scouts.js';

// Parcours individuel : étape théorique (âge), étape officielle (décision), modules de l'étape,
// rattrapages. Voir docs/FEATURES/PROGRESSION_PAR_AGE.md et docs/FEATURES/RATTRAPAGE.md.

/** Statuts affichés d'une obligation de rattrapage (calculés à la lecture, sauf décision humaine). */
export const CATCH_UP_STATUSES = [
  'A_FAIRE',
  'EN_COURS',
  'EN_ATTENTE_VALIDATION',
  'ACQUIS',
  'EN_RETARD',
  'NON_APPLICABLE',
] as const;

export type CatchUpStatus = (typeof CATCH_UP_STATUSES)[number];

export const CATCH_UP_STATUS_LABELS: Record<CatchUpStatus, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  ACQUIS: 'Acquis',
  EN_RETARD: 'En retard',
  NON_APPLICABLE: 'Non applicable',
};

/** Synchronisé avec l'enum Prisma `CatchUpDecision`. */
export const CATCH_UP_DECISIONS = ['ACQUIS', 'NON_APPLICABLE'] as const;

export type CatchUpDecision = (typeof CATCH_UP_DECISIONS)[number];

/**
 * Statut affiché : la décision humaine prime ; un résultat accepté attend la décision ; une échéance
 * dépassée signale le retard ; une étude ou une tentative indique un travail en cours.
 * Aucune combinaison ne produit « ACQUIS » sans décision (validation exclusivement humaine).
 */
export function catchUpStatus(facts: {
  decision: CatchUpDecision | null;
  dueOn: string | null;
  today: string;
  studies: number;
  attempts: number;
  acceptedAttempts: number;
}): CatchUpStatus {
  if (facts.decision) return facts.decision;
  if (facts.acceptedAttempts > 0) return 'EN_ATTENTE_VALIDATION';
  if (facts.dueOn !== null && facts.dueOn < facts.today) return 'EN_RETARD';
  if (facts.studies > 0 || facts.attempts > 0) return 'EN_COURS';
  return 'A_FAIRE';
}

const moduleRefSchema = z.object({ id: z.uuid(), code: z.string(), title: z.string() });

export const catchUpObligationSchema = z.object({
  id: z.uuid(),
  module: moduleRefSchema,
  originStage: stageSummarySchema,
  ruleSetVersion: z.string(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
  /** Nulle : aucun délai officiel validé (arbitrage nécessaire). */
  dueOn: z.iso.date().nullable(),
  status: z.enum(CATCH_UP_STATUSES),
  studies: z.number().int(),
  attempts: z.number().int(),
  acceptedAttempts: z.number().int(),
  decision: z.enum(CATCH_UP_DECISIONS).nullable(),
  decisionReason: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  decidedBy: userSummarySchema.nullable(),
  /** Faux si le module n'est plus obligatoire dans le référentiel publié (l'obligation reste tracée). */
  stillRequired: z.boolean(),
});

export type CatchUpObligation = z.infer<typeof catchUpObligationSchema>;

export const decideCatchUpInputSchema = z.object({
  decision: z.enum(CATCH_UP_DECISIONS, { error: 'Choisissez une décision.' }),
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Le motif est obligatoire (3 caractères au minimum).' })
    .max(2000, { error: '2 000 caractères au maximum.' }),
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type DecideCatchUpInput = z.input<typeof decideCatchUpInputSchema>;

export const STAGE_GAPS = ['ALIGNEE', 'EN_AVANCE', 'EN_RETARD', 'INDETERMINE'] as const;

export type StageGap = (typeof STAGE_GAPS)[number];

export const STAGE_GAP_LABELS: Record<StageGap, string> = {
  ALIGNEE: 'Étape officielle conforme à l’âge',
  EN_AVANCE: 'Étape officielle en avance sur l’âge',
  EN_RETARD: 'Étape officielle en retard sur l’âge',
  INDETERMINE: 'Comparaison impossible (étape théorique non déterminée)',
};

/** Écart entre étape officielle et étape théorique : information d'accompagnement, jamais une décision. */
export function stageGap(
  theoreticalPosition: number | null,
  officialPosition: number | null,
): StageGap {
  if (theoreticalPosition === null || officialPosition === null) return 'INDETERMINE';
  if (officialPosition === theoreticalPosition) return 'ALIGNEE';
  return officialPosition > theoreticalPosition ? 'EN_AVANCE' : 'EN_RETARD';
}

export const pathwayModuleSchema = moduleRefSchema.extend({
  obligation: z.enum(['OBLIGATOIRE', 'FACULTATIF']).nullable(),
  officialSource: z.string().nullable(),
  studied: z.boolean(),
});

export const scoutPathwaySchema = z.object({
  scout: scoutRefSchema,
  age: ageProgressionSchema,
  theoreticalStage: stageSummarySchema.nullable(),
  officialStage: stageSummarySchema.nullable(),
  gap: z.enum(STAGE_GAPS),
  membership: z.object({
    status: z.enum(MEMBERSHIP_STATUSES),
    /** Date de sortie enregistrée (traitement appliqué) ; nulle si seulement calculée. */
    exitedOn: z.iso.date().nullable(),
  }),
  /** Modules publiés rattachés à l'étape théorique (à étudier). */
  stageModules: z.array(pathwayModuleSchema),
  catchUps: z.array(catchUpObligationSchema),
  /** Vrai si au moins une obligation n'a pas d'échéance faute de délai officiel. */
  catchUpDeadlineUndetermined: z.boolean(),
});

export type ScoutPathway = z.infer<typeof scoutPathwaySchema>;

/** Référentiels d'âge : version applicable aujourd'hui et historique complet. */
export const ageRuleSetListSchema = z.object({
  currentVersion: z.string().nullable(),
  items: z.array(ageRuleSetSchema),
});

export type AgeRuleSetList = z.infer<typeof ageRuleSetListSchema>;

/**
 * Indicateurs de parcours de l'encadrement (aucun classement entre routiers). Les prochaines sorties
 * sont listées par date, sans seuil d'alerte tant qu'aucun n'est validé.
 */
export const pathwayOverviewSchema = z.object({
  referenceDate: z.iso.date(),
  ruleSetVersion: z.string().nullable(),
  activeMembers: z.number().int(),
  exitedMembers: z.number().int(),
  missingBirthDate: z.number().int(),
  byTheoreticalStage: z.array(
    z.object({ stage: stageSummarySchema.nullable(), count: z.number().int() }),
  ),
  byGap: z.array(z.object({ gap: z.enum(STAGE_GAPS), count: z.number().int() })),
  upcomingExits: z.array(
    z.object({
      scout: scoutRefSchema,
      branchExitOn: z.iso.date(),
      daysUntilExit: z.number().int(),
      approaching: z.boolean().nullable(),
    }),
  ),
  catchUps: z.object({
    open: z.number().int(),
    overdue: z.number().int(),
    awaitingValidation: z.number().int(),
    withoutDeadline: z.number().int(),
  }),
});

export type PathwayOverview = z.infer<typeof pathwayOverviewSchema>;
