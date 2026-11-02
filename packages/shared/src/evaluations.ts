import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import {
  answerOptionSchema,
  editorQuestionSchema,
  evaluationModuleRefSchema,
} from './evaluation-authoring.js';
import { QUESTION_TYPES } from './grading.js';
import { stageSummarySchema, teamRefSchema } from './scouts.js';
import { ATTEMPT_STATUSES, EVALUATION_MODES } from './evaluation-enums.js';

export * from './evaluation-enums.js';

/**
 * Code public de tentative (RM-007) : « NT-AAAA-NNNNNN » (année civile UTC d'émission, rang dans l'année).
 * Identifiant de recherche, pas un secret : sa possession ne donne aucun droit d'accès.
 */
export const ATTEMPT_CODE_PREFIX = 'NT';
export const ATTEMPT_CODE_PATTERN = /^NT-\d{4}-\d{6}$/;
export const ATTEMPT_CODE_MAX_SEQUENCE = 999_999;

export function formatAttemptCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new RangeError(`Année de code de tentative invalide : ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > ATTEMPT_CODE_MAX_SEQUENCE) {
    throw new RangeError(`Numéro de code de tentative invalide : ${sequence}`);
  }
  return `${ATTEMPT_CODE_PREFIX}-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Normalise une saisie (espaces, minuscules) avant recherche. */
export function normalizeAttemptCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export const attemptCodeSchema = z
  .string()
  .transform(normalizeAttemptCode)
  .refine((value) => ATTEMPT_CODE_PATTERN.test(value), {
    message: 'Code de tentative invalide (format attendu : NT-2027-000125).',
  });

const reasonSchema = z
  .string()
  .trim()
  .min(3, { error: 'Motif obligatoire (3 caractères au minimum).' })
  .max(1000, { error: '1 000 caractères au maximum.' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value));

// ─── Éligibilité (RM-EVAL-002, RM-EVAL-003) ────────────────────────────────

/**
 * Résultat du contrôle d'éligibilité, identique en ligne et sur papier, avec ou sans compte.
 * Règle provisoire (D59) : étape courante = étape de l'évaluation, sinon dérogation active du responsable.
 */
export const ELIGIBILITY_STATUSES = [
  'ELIGIBLE',
  'ELIGIBLE_DEROGATION',
  'ELIGIBLE_RATTRAPAGE',
  'ETAPE_NON_CORRESPONDANTE',
  'SORTI_BRANCHE',
  'LIMITE_ATTEINTE',
  'PROFIL_INACTIF',
  'SANS_PROFIL',
] as const;

export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  ELIGIBLE: 'Accessible',
  ELIGIBLE_DEROGATION: 'Accessible par dérogation',
  ELIGIBLE_RATTRAPAGE: 'Accessible au titre d’un rattrapage',
  ETAPE_NON_CORRESPONDANTE: 'Réservée à une autre étape',
  SORTI_BRANCHE: 'Limite d’âge de la branche atteinte',
  LIMITE_ATTEINTE: 'Nombre de tentatives atteint',
  PROFIL_INACTIF: 'Profil routier inactif',
  SANS_PROFIL: 'Aucun profil routier rattaché au compte',
};

export const attemptRefSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
});

export type AttemptRef = z.infer<typeof attemptRefSchema>;

export const eligibilitySchema = z.object({
  status: z.enum(ELIGIBILITY_STATUSES),
  allowed: z.boolean(),
  waiver: z
    .object({ id: z.uuid(), reason: z.string(), expiresAt: z.iso.datetime().nullable() })
    .nullable(),
  /** Tentatives non annulées déjà enregistrées pour cette évaluation. */
  attemptsUsed: z.number().int().nonnegative(),
  maxAttempts: z.number().int().nullable(),
  /** Tentative non clôturée (à reprendre ou à terminer avant d'en créer une autre). */
  openAttempt: attemptRefSchema.nullable(),
});

export type Eligibility = z.infer<typeof eligibilitySchema>;

// ─── Évaluations disponibles ───────────────────────────────────────────────

export const availableEvaluationQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  stageId: z.uuid().optional(),
  /** Chefs et responsable : éligibilité calculée pour ce routier (préparation papier). */
  scoutProfileId: z.uuid().optional(),
});

export type AvailableEvaluationQuery = z.input<typeof availableEvaluationQuerySchema>;

export const availableEvaluationSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  instructions: z.string(),
  stage: stageSummarySchema,
  module: evaluationModuleRefSchema.nullable(),
  versionId: z.uuid(),
  version: z.number().int(),
  questionCount: z.number().int().nonnegative(),
  durationMinutes: z.number().int().nullable(),
  maxAttempts: z.number().int().nullable(),
  publishedAt: z.iso.datetime(),
  /** Routier connecté, ou routier désigné par `scoutProfileId` ; null pour un chef sans routier choisi. */
  eligibility: eligibilitySchema.nullable(),
});

export type AvailableEvaluation = z.infer<typeof availableEvaluationSchema>;

// ─── Passation en ligne ────────────────────────────────────────────────────

/** Question telle que vue par le routier : ni barème, ni bonne réponse, ni critère de correction. */
export const publicQuestionSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  options: z.array(z.object({ id: z.uuid(), label: z.string() })),
});

export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const attemptAnswerInputSchema = z.object({
  questionId: z.uuid(),
  optionIds: z.array(z.uuid()).max(10).default([]),
  text: z
    .string()
    .max(5000, { error: '5 000 caractères au maximum.' })
    .transform((value) => (value.trim() === '' ? null : value))
    .nullable()
    .default(null),
});

export type AttemptAnswerInput = z.input<typeof attemptAnswerInputSchema>;

export const saveAnswersInputSchema = z.object({
  answers: z.array(attemptAnswerInputSchema).min(1).max(100),
});

export type SaveAnswersInput = z.input<typeof saveAnswersInputSchema>;

export const savedAnswerSchema = z.object({
  questionId: z.uuid(),
  optionIds: z.array(z.uuid()),
  text: z.string().nullable(),
});

export const attemptSessionSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  evaluation: z.object({
    id: z.uuid(),
    title: z.string(),
    instructions: z.string(),
    durationMinutes: z.number().int().nullable(),
  }),
  version: z.number().int(),
  startedAt: z.iso.datetime().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  questions: z.array(publicQuestionSchema),
  answers: z.array(savedAnswerSchema),
});

export type AttemptSession = z.infer<typeof attemptSessionSchema>;

/**
 * Historique d'un routier. Le résultat détaillé n'est communiqué qu'après examen par le responsable,
 * sans les bonnes réponses (D61, provisoire).
 */
export const myAttemptSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  evaluation: z.object({ id: z.uuid(), title: z.string() }),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  result: z
    .object({
      score: z.number(),
      maxScore: z.number(),
      reviewedAt: z.iso.datetime().nullable(),
      comment: z.string().nullable(),
      questions: z.array(
        z.object({
          id: z.uuid(),
          position: z.number().int(),
          type: z.enum(QUESTION_TYPES),
          prompt: z.string(),
          points: z.number(),
          awardedPoints: z.number().nullable(),
          appreciation: z.string().nullable(),
          comment: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
});

export type MyAttempt = z.infer<typeof myAttemptSchema>;

export const myAttemptQuerySchema = paginationQuerySchema.extend({
  evaluationId: z.uuid().optional(),
});

export type MyAttemptQuery = z.input<typeof myAttemptQuerySchema>;

// ─── Préparation papier (RM-006) ───────────────────────────────────────────

/** La version utilisée est la version publiée courante ; `evaluationVersionId`, s'il est fourni, doit la désigner. */
export const preparePaperAttemptInputSchema = z.object({
  scoutProfileId: z.uuid({ error: 'Choisissez un routier.' }),
  evaluationId: z.uuid({ error: 'Choisissez une évaluation.' }),
  evaluationVersionId: z.uuid().optional(),
  plannedFor: z.iso.date().optional(),
});

export type PreparePaperAttemptInput = z.input<typeof preparePaperAttemptInputSchema>;

// ─── Distribution collective (D163) ────────────────────────────────────────

/** Plafond d'un lot : une communauté de 25 routiers, avec marge ; au-delà, plusieurs lots. */
export const PAPER_BATCH_MAX = 60;

/** Routier candidat à une distribution : éligibilité calculée par le serveur, jamais par le web. */
export const distributionCandidateSchema = z.object({
  scout: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    matricule: z.string().nullable(),
    hasAccount: z.boolean(),
    stage: stageSummarySchema.nullable(),
    team: teamRefSchema.nullable(),
  }),
  eligibility: z.enum(ELIGIBILITY_STATUSES),
  allowed: z.boolean(),
  /** Tentative non clôturée existante (papier réutilisable, ou en ligne / hors ligne en conflit). */
  openAttempt: z
    .object({
      code: z.string(),
      mode: z.enum(EVALUATION_MODES),
      status: z.enum(ATTEMPT_STATUSES),
      /** Réservation hors ligne en cours, non synchronisée : aucune bascule possible avant échéance. */
      offlinePending: z.boolean(),
    })
    .nullable(),
});

export type DistributionCandidate = z.infer<typeof distributionCandidateSchema>;

export const distributionCandidatesSchema = z.object({
  evaluation: z.object({
    id: z.uuid(),
    code: z.string(),
    title: z.string(),
    version: z.number().int(),
  }),
  candidates: z.array(distributionCandidateSchema),
});

export type DistributionCandidates = z.infer<typeof distributionCandidatesSchema>;

/**
 * Préparation collective : idempotente (une copie papier encore préparée est réutilisée, jamais
 * dupliquée ; un double envoi ne crée rien de plus). Chaque routier est traité séparément : un échec
 * n'annule pas les autres et un nouvel envoi reprend le lot.
 */
export const preparePaperBatchInputSchema = z.object({
  evaluationId: z.uuid({ error: 'Choisissez une évaluation.' }),
  scoutProfileIds: z
    .array(z.uuid())
    .min(1, { error: 'Sélectionnez au moins un routier.' })
    .max(PAPER_BATCH_MAX, { error: `${PAPER_BATCH_MAX} routiers au plus par lot.` })
    .refine((ids) => new Set(ids).size === ids.length, { error: 'Routier en double.' }),
  plannedFor: z.iso.date().optional(),
});

export type PreparePaperBatchInput = z.input<typeof preparePaperBatchInputSchema>;

export const PAPER_BATCH_OUTCOMES = ['CREEE', 'REUTILISEE', 'IGNOREE'] as const;

export const paperBatchResultSchema = z.object({
  items: z.array(
    z.object({
      scoutProfileId: z.uuid(),
      outcome: z.enum(PAPER_BATCH_OUTCOMES),
      code: z.string().nullable(),
      /** Raison d'une copie ignorée (code d'erreur stable et message affichable). */
      reason: z.object({ code: z.string(), message: z.string() }).nullable(),
    }),
  ),
});

export type PaperBatchResult = z.infer<typeof paperBatchResultSchema>;

/** Téléchargement groupé des questionnaires préparés : un PDF commun ou une archive ZIP (un PDF par routier). */
export const paperBatchDocumentQuerySchema = z.object({
  codes: z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(attemptCodeSchema).min(1).max(PAPER_BATCH_MAX)),
  format: z.enum(['pdf', 'zip']).default('pdf'),
});

export type PaperBatchDocumentQuery = z.input<typeof paperBatchDocumentQuerySchema>;

export const PAPER_DOCUMENTS = ['questionnaire', 'corrige', 'grille'] as const;

export type PaperDocument = (typeof PAPER_DOCUMENTS)[number];

export const PAPER_DOCUMENT_LABELS: Record<PaperDocument, string> = {
  questionnaire: 'Questionnaire du routier',
  corrige: 'Corrigé (responsable)',
  grille: 'Grille de correction',
};

export const paperDocumentQuerySchema = z.object({
  document: z.enum(PAPER_DOCUMENTS).default('questionnaire'),
});

// ─── Correction (chefs) ────────────────────────────────────────────────────

export const correctionListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  /** `open` = préparée, en cours, à corriger ou soumise. */
  status: z.enum([...ATTEMPT_STATUSES, 'open', 'all']).default('A_CORRIGER'),
  /**
   * `saisie` : copies papier préparées ou en cours de saisie (non transmises) ;
   * `correction` : copies à corriger (papier transmises, et copies en ligne remises).
   */
  queue: z.enum(['saisie', 'correction']).optional(),
  mode: z.enum(EVALUATION_MODES).optional(),
  evaluationId: z.uuid().optional(),
  scoutProfileId: z.uuid().optional(),
});

export type CorrectionListQuery = z.input<typeof correctionListQuerySchema>;

const scoutRefSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  matricule: z.string().nullable(),
  hasAccount: z.boolean(),
});

export const correctionListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  scout: scoutRefSchema.extend({
    stage: stageSummarySchema.nullable(),
    team: teamRefSchema.nullable(),
  }),
  evaluation: z.object({ id: z.uuid(), code: z.string(), title: z.string() }),
  version: z.number().int(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  recordedAt: z.iso.datetime().nullable(),
  recordedBy: userSummarySchema.nullable(),
  transmittedAt: z.iso.datetime().nullable(),
  transmittedBy: userSummarySchema.nullable(),
  updatedAt: z.iso.datetime(),
});

export type CorrectionListItem = z.infer<typeof correctionListItemSchema>;

export const attemptEventSchema = z.object({
  id: z.uuid(),
  fromStatus: z.enum(ATTEMPT_STATUSES).nullable(),
  toStatus: z.enum(ATTEMPT_STATUSES),
  actor: userSummarySchema,
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type AttemptEvent = z.infer<typeof attemptEventSchema>;

/**
 * Question d'une copie. Sans la permission `attempt.answerKey` (D161), le corrigé est retiré par le
 * serveur : barème, bonnes réponses, réponse attendue, variantes et critères à null ou vides.
 */
export const correctionQuestionSchema = editorQuestionSchema.extend({
  points: z.number().nullable(),
  options: z.array(answerOptionSchema.extend({ isCorrect: z.boolean().nullable() })),
  answer: z
    .object({
      optionIds: z.array(z.uuid()),
      text: z.string().nullable(),
      awardedPoints: z.number().nullable(),
      autoScored: z.boolean(),
      appreciation: z.string().nullable(),
      comment: z.string().nullable(),
      gradedBy: userSummarySchema.nullable(),
      gradedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});

export type CorrectionQuestion = z.infer<typeof correctionQuestionSchema>;

/** Copie : corrigé et notes non publiées pour le responsable plein seulement (D161). */
export const correctionDetailSchema = z.object({
  id: z.uuid(),
  /** Vrai si la réponse contient le corrigé confidentiel (responsable plein). */
  answerKey: z.boolean(),
  code: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  correctionRevision: z.number().int(),
  scout: scoutRefSchema.extend({
    isActive: z.boolean(),
    stage: stageSummarySchema.nullable(),
    team: teamRefSchema.nullable(),
    /** Équipe à la date de préparation (imprimée sur la feuille). */
    teamAtPreparation: teamRefSchema.nullable(),
  }),
  evaluation: z.object({
    id: z.uuid(),
    code: z.string(),
    title: z.string(),
    stage: stageSummarySchema,
    module: evaluationModuleRefSchema.nullable(),
  }),
  version: z.object({
    id: z.uuid(),
    version: z.number().int(),
    title: z.string(),
    instructions: z.string(),
    totalPoints: z.number().nullable(),
    /** Faux si une version plus récente a été publiée depuis (la copie reste liée à sa version). */
    isCurrent: z.boolean(),
  }),
  plannedFor: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  createdBy: userSummarySchema,
  startedAt: z.iso.datetime().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  recordedAt: z.iso.datetime().nullable(),
  recordedBy: userSummarySchema.nullable(),
  transmittedAt: z.iso.datetime().nullable(),
  transmittedBy: userSummarySchema.nullable(),
  observations: z.string().nullable(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  waiver: z.object({ id: z.uuid(), reason: z.string() }).nullable(),
  decision: z
    .object({
      decidedAt: z.iso.datetime(),
      decidedBy: userSummarySchema.nullable(),
      comment: z.string().nullable(),
    })
    .nullable(),
  questions: z.array(correctionQuestionSchema),
  events: z.array(attemptEventSchema),
});

export type CorrectionDetail = z.infer<typeof correctionDetailSchema>;

export const gradeInputSchema = z.object({
  questionId: z.uuid(),
  /** Points d'une question ouverte (ignorés pour une question objective, corrigée automatiquement). */
  awardedPoints: z
    .number({ error: 'Note invalide.' })
    .nonnegative({ error: 'La note ne peut pas être négative.' })
    .max(1000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
      error: 'Deux décimales au maximum.',
    })
    .nullable()
    .default(null),
  appreciation: optionalText(300).nullable().default(null),
  comment: optionalText(2000).nullable().default(null),
});

export type GradeInput = z.input<typeof gradeInputSchema>;

/**
 * Enregistrement (brouillon) d'une correction. `answers` : transcription d'une copie papier uniquement
 * (les réponses d'une tentative en ligne ne sont jamais modifiées par un correcteur).
 * `reason` est obligatoire pour reprendre une correction déjà soumise au responsable.
 */
export const saveCorrectionInputSchema = z.object({
  correctionRevision: z.number().int().min(1),
  completedAt: z.iso.datetime().optional(),
  answers: z.array(attemptAnswerInputSchema).max(100).optional(),
  grades: z.array(gradeInputSchema).max(100).default([]),
  observations: optionalText(5000).nullable().optional(),
  reason: reasonSchema.optional(),
});

export type SaveCorrectionInput = z.input<typeof saveCorrectionInputSchema>;

export const correctionRevisionInputSchema = z.object({
  correctionRevision: z.number().int().min(1),
});

export type CorrectionRevisionInput = z.input<typeof correctionRevisionInputSchema>;

// ─── Examen par le responsable ─────────────────────────────────────────────

/** Accepter le résultat corrigé : n'est pas la validation officielle d'un acquis (RM-EVAL-004). */
export const acceptReviewInputSchema = z.object({ comment: optionalText(2000).optional() });

export type AcceptReviewInput = z.input<typeof acceptReviewInputSchema>;

/** Annulation, demande de nouvelle correction, réouverture : motif obligatoire. */
export const attemptReasonInputSchema = z.object({ reason: reasonSchema });

export type AttemptReasonInput = z.input<typeof attemptReasonInputSchema>;

/**
 * Bascule au papier (D164) : la tentative en ligne non remise est annulée (réponses conservées dans
 * l'historique) et une copie papier est préparée dans la même transaction. Refusée tant qu'une
 * réservation hors ligne non synchronisée est en cours.
 */
export const switchToPaperInputSchema = z.object({
  reason: reasonSchema,
  plannedFor: z.iso.date().optional(),
});

export type SwitchToPaperInput = z.input<typeof switchToPaperInputSchema>;

// ─── Dérogations (RM-EVAL-003) ─────────────────────────────────────────────

export const grantWaiverInputSchema = z.object({
  scoutProfileId: z.uuid({ error: 'Choisissez un routier.' }),
  evaluationId: z.uuid({ error: 'Choisissez une évaluation.' }),
  reason: reasonSchema,
  expiresAt: z.iso.datetime().optional(),
});

export type GrantWaiverInput = z.input<typeof grantWaiverInputSchema>;

export const waiverListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});

export type WaiverListQuery = z.input<typeof waiverListQuerySchema>;

export const waiverSchema = z.object({
  id: z.uuid(),
  scout: scoutRefSchema,
  evaluation: z.object({ id: z.uuid(), code: z.string(), title: z.string() }),
  reason: z.string(),
  grantedBy: userSummarySchema,
  grantedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: userSummarySchema.nullable(),
  revocationReason: z.string().nullable(),
  active: z.boolean(),
  attemptCount: z.number().int().nonnegative(),
});

export type Waiver = z.infer<typeof waiverSchema>;
