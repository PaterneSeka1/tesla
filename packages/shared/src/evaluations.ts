import { z } from 'zod';

/** Modes de passation. Doit rester synchronisé avec l'enum Prisma `EvaluationMode` (vérifié par un test). */
export const EVALUATION_MODES = ['EN_LIGNE', 'HORS_LIGNE', 'PAPIER'] as const;

export type EvaluationMode = (typeof EVALUATION_MODES)[number];

/** Statuts d'une tentative. Doit rester synchronisé avec l'enum Prisma `AttemptStatus` (vérifié par un test). */
export const ATTEMPT_STATUSES = [
  'PREPAREE',
  'EN_COURS',
  'A_CORRIGER',
  'SOUMISE',
  'VALIDEE',
  'REFUSEE',
  'ANNULEE',
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Statuts « non clôturés » : au plus une tentative de ce type par routier et par évaluation (RM-012). */
export const OPEN_ATTEMPT_STATUSES = ['PREPAREE', 'EN_COURS', 'A_CORRIGER', 'SOUMISE'] as const;

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  PREPAREE: 'Préparée',
  EN_COURS: 'En cours',
  A_CORRIGER: 'À corriger',
  SOUMISE: 'Soumise au responsable',
  VALIDEE: 'Résultat validé',
  REFUSEE: 'Résultat refusé',
  ANNULEE: 'Annulée',
};

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

const reasonSchema = z.string().trim().min(3).max(1000);
const scoreSchema = z.number().nonnegative().max(99_999.99);

/** Préparation d'une feuille papier nominative (RM-006). */
export const preparePaperAttemptInputSchema = z.object({
  scoutProfileId: z.uuid(),
  evaluationId: z.uuid(),
  evaluationVersionId: z.uuid(),
  plannedFor: z.iso.date().optional(),
});

export type PreparePaperAttemptInput = z.input<typeof preparePaperAttemptInputSchema>;

/**
 * Saisie (ou correction) du résultat d'une tentative papier (RM-008).
 * `answers` : réponses transcrites, indexées par identifiant de question.
 * `reason` est obligatoire pour une correction après soumission (contrôlé par l'API).
 */
export const recordPaperResultInputSchema = z
  .object({
    completedAt: z.iso.datetime(),
    answers: z.record(z.string().min(1).max(100), z.string().max(5000)),
    score: scoreSchema.optional(),
    maxScore: scoreSchema.positive().optional(),
    observations: z.string().trim().max(5000).optional(),
    evidenceFileKey: z.string().trim().min(1).max(500).optional(),
    reason: reasonSchema.optional(),
  })
  .refine((v) => v.score === undefined || v.maxScore === undefined || v.score <= v.maxScore, {
    message: 'Le score ne peut pas dépasser le barème.',
    path: ['score'],
  });

export type RecordPaperResultInput = z.input<typeof recordPaperResultInputSchema>;

/** Décision pédagogique du responsable sur un résultat soumis (distincte de la validation d'étape). */
export const decideAttemptInputSchema = z.object({
  decision: z.enum(['VALIDEE', 'REFUSEE']),
  comment: z.string().trim().max(2000).optional(),
});

export type DecideAttemptInput = z.input<typeof decideAttemptInputSchema>;

/** Annulation ou réouverture : motif obligatoire. */
export const attemptReasonInputSchema = z.object({ reason: reasonSchema });

export type AttemptReasonInput = z.input<typeof attemptReasonInputSchema>;

/** Dérogation individuelle accordée par le responsable (RM-009). */
export const grantWaiverInputSchema = z.object({
  scoutProfileId: z.uuid(),
  evaluationId: z.uuid(),
  reason: reasonSchema,
  expiresAt: z.iso.datetime().optional(),
});

export type GrantWaiverInput = z.input<typeof grantWaiverInputSchema>;
