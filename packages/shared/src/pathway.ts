import { z } from 'zod';
import { userSummarySchema } from './api.js';
import { ageProgressionSchema, ageRuleSetSchema, MEMBERSHIP_STATUSES } from './age-progression.js';
import { scoutRefSchema } from './progression.js';
import { stageSummarySchema } from './scouts.js';

// Parcours individuel : étape actuelle calculée selon l'âge (D173), modules de l'étape,
// rattrapages, modules acquis. Voir docs/FEATURES/PROGRESSION_PAR_AGE.md et docs/FEATURES/RATTRAPAGE.md.

/** Statuts affichés d'une obligation de rattrapage (calculés à la lecture, sauf décision humaine). */
export const CATCH_UP_STATUSES = [
  'A_FAIRE',
  'EN_COURS',
  'EN_ATTENTE_VALIDATION',
  'ACQUIS',
  'EN_RETARD',
  'NON_APPLICABLE',
  'A_REEXAMINER',
] as const;

export type CatchUpStatus = (typeof CATCH_UP_STATUSES)[number];

export const CATCH_UP_STATUS_LABELS: Record<CatchUpStatus, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  ACQUIS: 'Acquis',
  EN_RETARD: 'En retard',
  NON_APPLICABLE: 'Non applicable',
  A_REEXAMINER: 'À réexaminer',
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
  /**
   * Faux si, d'après les données actuelles (date de naissance corrigée…), la période de l'étape
   * d'origine n'est plus échue : l'obligation reste tracée et attend une décision humaine.
   */
  stillDue?: boolean;
}): CatchUpStatus {
  if (facts.decision) return facts.decision;
  if (facts.stillDue === false) return 'A_REEXAMINER';
  if (facts.acceptedAttempts > 0) return 'EN_ATTENTE_VALIDATION';
  if (facts.dueOn !== null && facts.dueOn < facts.today) return 'EN_RETARD';
  if (facts.studies > 0 || facts.attempts > 0) return 'EN_COURS';
  return 'A_FAIRE';
}

/** Étape d'origine échue avant l'entrée à la Route, après, ou date d'entrée non renseignée. */
export const CATCH_UP_ARRIVALS = ['AVANT_ARRIVEE', 'APRES_ARRIVEE', 'INCONNUE'] as const;

export type CatchUpArrival = (typeof CATCH_UP_ARRIVALS)[number];

export const CATCH_UP_ARRIVAL_LABELS: Record<CatchUpArrival, string> = {
  AVANT_ARRIVEE: 'Étape échue avant l’entrée à la Route',
  APRES_ARRIVEE: 'Étape échue depuis l’entrée à la Route',
  INCONNUE: 'Date d’entrée non renseignée',
};

const moduleRefSchema = z.object({ id: z.uuid(), code: z.string(), title: z.string() });

export const catchUpObligationSchema = z.object({
  id: z.uuid(),
  module: moduleRefSchema,
  originStage: stageSummarySchema,
  /** Référentiel et motif détaillé : responsable plein seulement (nuls / générique sinon, D176). */
  ruleSetVersion: z.string().nullable(),
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
  /**
   * Faux si la période de l'étape d'origine n'est plus échue selon les données actuelles (correction
   * de la date de naissance, nouveau référentiel) : incohérence héritée à réexaminer, jamais effacée.
   */
  stillDue: z.boolean(),
  /**
   * Position de l'échéance de l'étape d'origine par rapport à la date d'entrée à la Route :
   * information de suivi, jamais une dispense (une arrivée tardive ne dispense de rien).
   */
  arrival: z.enum(CATCH_UP_ARRIVALS),
  /**
   * Vrai si l'obligation retient encore le routier (D177) : sans décision, toujours exigée, étape
   * d'origine échue et aucun résultat accepté. Tant qu'il en reste une, les autres cours sont fermés.
   */
  blocking: z.boolean(),
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

export const pathwayModuleSchema = moduleRefSchema.extend({
  obligation: z.enum(['OBLIGATOIRE', 'FACULTATIF']).nullable(),
  officialSource: z.string().nullable(),
  studied: z.boolean(),
  /** Fermé tant que les rattrapages en cours ne sont pas terminés (D177). */
  locked: z.boolean(),
});

/**
 * Verrou des rattrapages (D177) : tant qu'une étape antérieure reste à rattraper, seuls ses modules
 * (et ceux des étapes déjà rattrapées) sont ouverts au routier ; les autres cours et évaluations
 * sont fermés, sauf dérogation du responsable. Les étapes se rattrapent dans l'ordre du parcours.
 */
export const catchUpLockSchema = z.object({
  active: z.boolean(),
  /** Étape en cours de rattrapage (la plus ancienne non terminée). */
  stage: stageSummarySchema.nullable(),
  /** Échéance de cette étape (nulle sans délai validé). */
  dueOn: z.iso.date().nullable(),
  /** Modules ouverts pendant le verrou. */
  allowedModuleIds: z.array(z.uuid()),
});

export type CatchUpLock = z.infer<typeof catchUpLockSchema>;

export const scoutPathwaySchema = z.object({
  scout: scoutRefSchema,
  age: ageProgressionSchema,
  /** Étape actuelle, calculée selon l'âge (seule étape de l'application, D173). */
  stage: stageSummarySchema.nullable(),
  membership: z.object({
    status: z.enum(MEMBERSHIP_STATUSES),
    /** Date de sortie enregistrée (traitement appliqué) ; nulle si seulement calculée. */
    exitedOn: z.iso.date().nullable(),
  }),
  /** Modules publiés rattachés à l'étape actuelle (à étudier). */
  stageModules: z.array(pathwayModuleSchema),
  catchUps: z.array(catchUpObligationSchema),
  /** Vrai si au moins une obligation n'a pas d'échéance faute de délai officiel. */
  catchUpDeadlineUndetermined: z.boolean(),
  catchUpLock: catchUpLockSchema,
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
  byStage: z.array(z.object({ stage: stageSummarySchema.nullable(), count: z.number().int() })),
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
