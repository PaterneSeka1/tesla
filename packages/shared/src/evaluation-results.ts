import { z } from 'zod';
import { ATTEMPT_STATUSES, EVALUATION_MODES } from './evaluation-enums.js';
import { QUESTION_TYPES } from './grading.js';
import { stageSummarySchema } from './scouts.js';

/**
 * Résultats d'un questionnaire pour l'encadrement (D139) : participation, copies, réponses et
 * répartition par question, calculées sur les seules données enregistrées (aucune valeur estimée).
 * Contient le corrigé : jamais transmis à un routier, jamais conservé hors ligne (`/editor/`).
 * Aucun classement : copies triées par nom (règle pédagogique 12).
 */

/** Copies remises (passation terminée), quelle que soit l'étape de correction. */
export const FINISHED_ATTEMPT_STATUSES = ['A_CORRIGER', 'SOUMISE', 'VALIDEE', 'REFUSEE'] as const;

export const evaluationResultAttemptSchema = z.object({
  code: z.string(),
  scout: z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  version: z.number().int(),
  submittedAt: z.iso.datetime().nullable(),
  /** Points obtenus et barème ; `complete` faux tant qu'une réponse attend une note humaine. */
  score: z.number(),
  maxScore: z.number(),
  complete: z.boolean(),
});

export const evaluationQuestionResultSchema = z.object({
  position: z.number().int(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  points: z.number(),
  /** Copies terminées de cette version. */
  copies: z.number().int(),
  answered: z.number().int(),
  /** Tous les points / une partie / aucun point / note humaine attendue. */
  fullPoints: z.number().int(),
  partialPoints: z.number().int(),
  noPoints: z.number().int(),
  pendingGrade: z.number().int(),
  /** Taux de réussite complète parmi les copies notées ; null si aucune copie notée. */
  successRate: z.number().nullable(),
  options: z.array(
    z.object({ label: z.string(), isCorrect: z.boolean(), chosen: z.number().int() }),
  ),
  /** Réponses rédigées (texte) avec leur note, par copie. */
  texts: z.array(
    z.object({ code: z.string(), text: z.string(), awardedPoints: z.number().nullable() }),
  ),
});

export const evaluationResultsSchema = z.object({
  evaluation: z.object({
    id: z.uuid(),
    title: z.string(),
    stage: stageSummarySchema,
    /** Version dont les questions sont détaillées (version publiée, sinon la dernière passée). */
    version: z.number().int().nullable(),
  }),
  /** Routiers actifs dans la branche dont l'étape officielle est celle du questionnaire. */
  concerned: z.number().int(),
  /** Routiers ayant au moins une copie terminée (toutes versions). */
  participants: z.number().int(),
  /** Routiers concernés sans aucune copie terminée. */
  notParticipated: z.number().int(),
  finishedAttempts: z.number().int(),
  openAttempts: z.number().int(),
  /** Moyenne des copies entièrement notées, en pourcentage du barème ; null si aucune. */
  averagePercent: z.number().nullable(),
  attempts: z.array(evaluationResultAttemptSchema),
  questions: z.array(evaluationQuestionResultSchema),
});

export type EvaluationResults = z.infer<typeof evaluationResultsSchema>;
export type EvaluationQuestionResult = z.infer<typeof evaluationQuestionResultSchema>;
