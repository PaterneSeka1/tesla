import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { QUESTION_TYPES, SCORING_POLICIES, type QuestionType } from './grading.js';
import {
  MODULE_VERSION_ACTIONS,
  MODULE_VERSION_STATUSES,
  type ModuleVersionAction,
  type ModuleVersionStatus,
} from './modules.js';
import { stageSummarySchema } from './scouts.js';

// ─── Référentiels ──────────────────────────────────────────────────────────

/**
 * États éditoriaux d'une version de questionnaire : mêmes valeurs et transitions que les modules
 * (enum Prisma `EvaluationVersionStatus`, trigger `evaluation_versions_guard`).
 */
export const EVALUATION_VERSION_STATUSES = MODULE_VERSION_STATUSES;

export type EvaluationVersionStatus = ModuleVersionStatus;

/** Actions de l'historique (enum Prisma `EvaluationVersionAction`). */
export const EVALUATION_VERSION_ACTIONS = MODULE_VERSION_ACTIONS;

export type EvaluationVersionAction = ModuleVersionAction;

/** Code interne affiché à partir du numéro séquentiel : 7 → « EVAL-007 ». */
export function formatEvaluationCode(number: number): string {
  return `EVAL-${String(number).padStart(3, '0')}`;
}

export const MAX_QUESTIONS_PER_VERSION = 100;
export const MAX_OPTIONS_PER_QUESTION = 10;

// ─── Entrées ───────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value));

const titleSchema = z
  .string()
  .trim()
  .min(3, { error: '3 caractères au minimum.' })
  .max(150, { error: '150 caractères au maximum.' });

const instructionsSchema = z.string().trim().max(3000, { error: '3 000 caractères au maximum.' });

const durationSchema = z
  .number({ error: 'Durée invalide.' })
  .int({ error: 'Nombre entier de minutes.' })
  .min(1, { error: '1 minute au minimum.' })
  .max(600, { error: '600 minutes au maximum.' });

const maxAttemptsSchema = z
  .number({ error: 'Nombre invalide.' })
  .int({ error: 'Nombre entier.' })
  .min(1, { error: '1 au minimum.' })
  .max(20, { error: '20 au maximum.' });

/** Barème d'une question : positif, au centième près. */
export const pointsSchema = z
  .number({ error: 'Barème invalide.' })
  .positive({ error: 'Le barème doit être positif.' })
  .max(1000, { error: '1 000 points au maximum.' })
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
    error: 'Deux décimales au maximum.',
  });

export const createEvaluationInputSchema = z.object({
  title: titleSchema,
  instructions: instructionsSchema.default(''),
  stageId: z.uuid({ error: 'Choisissez l’étape concernée.' }),
  moduleId: z.uuid().nullable().optional(),
  durationMinutes: durationSchema.nullable().optional(),
  maxAttempts: maxAttemptsSchema.nullable().optional(),
});

export type CreateEvaluationInput = z.input<typeof createEvaluationInputSchema>;

/**
 * Modification des informations du brouillon. L'étape et le module (rattachement de l'évaluation)
 * ne sont modifiables que tant qu'aucune version n'a été publiée (contrôlé par l'API).
 */
export const updateEvaluationInputSchema = z
  .object({
    versionId: z.uuid(),
    revision: z.number().int().min(1),
    title: titleSchema.optional(),
    instructions: instructionsSchema.optional(),
    durationMinutes: durationSchema.nullable().optional(),
    maxAttempts: maxAttemptsSchema.nullable().optional(),
    stageId: z.uuid().optional(),
    moduleId: z.uuid().nullable().optional(),
  })
  .refine(
    ({ versionId: _v, revision: _r, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: 'Aucune modification fournie.' },
  );

export type UpdateEvaluationInput = z.input<typeof updateEvaluationInputSchema>;

const optionInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { error: 'Proposition vide.' })
    .max(500, { error: '500 caractères au maximum.' }),
  isCorrect: z.boolean(),
});

/** Règles de cohérence d'une question selon son type (partagées par le formulaire et l'API). */
function checkQuestionShape(
  value: { type: QuestionType; options: { isCorrect: boolean }[] },
  ctx: z.RefinementCtx,
): void {
  const correct = value.options.filter((option) => option.isCorrect).length;
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['options'], message });
  switch (value.type) {
    case 'CHOIX_UNIQUE':
      if (value.options.length < 2) issue('Au moins deux propositions.');
      else if (correct !== 1) issue('Une seule bonne réponse pour un choix unique.');
      break;
    case 'CHOIX_MULTIPLE':
      if (value.options.length < 2) issue('Au moins deux propositions.');
      else if (correct < 1) issue('Au moins une bonne réponse.');
      break;
    case 'VRAI_FAUX':
      if (value.options.length !== 2 || correct !== 1)
        issue('Indiquez si l’affirmation est vraie ou fausse.');
      break;
    default:
      if (value.options.length > 0) issue('Une question ouverte n’a pas de propositions.');
  }
}

const questionShape = {
  type: z.enum(QUESTION_TYPES, { error: 'Type de question invalide.' }),
  prompt: z
    .string()
    .trim()
    .min(1, { error: 'L’énoncé est requis.' })
    .max(2000, { error: '2 000 caractères au maximum.' }),
  points: pointsSchema,
  scoringPolicy: z.enum(SCORING_POLICIES).default('TOUT_OU_RIEN'),
  options: z
    .array(optionInputSchema)
    .max(MAX_OPTIONS_PER_QUESTION, { error: '10 propositions au maximum.' })
    .default([]),
  guidance: optionalText(2000).nullable().optional(),
  expectedAnswer: optionalText(2000).nullable().optional(),
};

export const createQuestionInputSchema = z
  .object({ versionId: z.uuid(), ...questionShape })
  .superRefine(checkQuestionShape);

export type CreateQuestionInput = z.input<typeof createQuestionInputSchema>;

/** Remplacement complet d'une question (propositions comprises) avec contrôle de concurrence. */
export const updateQuestionInputSchema = z
  .object({ revision: z.number().int().min(1), ...questionShape })
  .superRefine(checkQuestionShape);

export type UpdateQuestionInput = z.input<typeof updateQuestionInputSchema>;

/** Formulaire web d'une question (même règles que l'API, sans identifiants). */
export const questionFormSchema = z.object(questionShape).superRefine(checkQuestionShape);

export type QuestionFormInput = z.input<typeof questionFormSchema>;

export const deleteQuestionQuerySchema = z.object({ revision: z.coerce.number().int().min(1) });

export const reorderQuestionsInputSchema = z.object({
  versionId: z.uuid(),
  questionIds: z.array(z.uuid()).min(1).max(MAX_QUESTIONS_PER_VERSION),
});

export type ReorderQuestionsInput = z.input<typeof reorderQuestionsInputSchema>;

export const submitEvaluationInputSchema = z.object({
  versionId: z.uuid(),
  revision: z.number().int().min(1),
  note: optionalText(1000).optional(),
});

export type SubmitEvaluationInput = z.input<typeof submitEvaluationInputSchema>;

export const editorEvaluationListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  /** `working` = brouillon, soumis, à corriger ou approuvé ; `published` = version publiée. */
  status: z.enum([...EVALUATION_VERSION_STATUSES, 'working', 'published', 'all']).default('all'),
});

export type EditorEvaluationListQuery = z.input<typeof editorEvaluationListQuerySchema>;

export const evaluationSubmissionQuerySchema = z.object({
  status: z.enum(['SOUMIS', 'APPROUVE']).default('SOUMIS'),
});

export type EvaluationSubmissionQuery = z.input<typeof evaluationSubmissionQuerySchema>;

// ─── Réponses ──────────────────────────────────────────────────────────────

export const answerOptionSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  label: z.string(),
  isCorrect: z.boolean(),
});

/** Question complète, corrigé compris : réservée aux chefs et au responsable. */
export const editorQuestionSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  points: z.number(),
  scoringPolicy: z.enum(SCORING_POLICIES),
  guidance: z.string().nullable(),
  expectedAnswer: z.string().nullable(),
  revision: z.number().int(),
  options: z.array(answerOptionSchema),
});

export type EditorQuestion = z.infer<typeof editorQuestionSchema>;

export const evaluationVersionSummarySchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(EVALUATION_VERSION_STATUSES),
  title: z.string(),
  questionCount: z.number().int().nonnegative(),
  totalPoints: z.number().nonnegative(),
  updatedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
});

export type EvaluationVersionSummary = z.infer<typeof evaluationVersionSummarySchema>;

export const evaluationVersionDetailSchema = evaluationVersionSummarySchema.extend({
  instructions: z.string(),
  durationMinutes: z.number().int().nullable(),
  maxAttempts: z.number().int().nullable(),
  revision: z.number().int(),
  basedOnVersion: z.number().int().nullable(),
  /** Version du module évalué en vigueur à la publication. */
  moduleVersion: z.number().int().nullable(),
  createdBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedBy: userSummarySchema.nullable(),
  submittedBy: userSummarySchema.nullable(),
  submissionNote: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  approvedBy: userSummarySchema.nullable(),
  publishedBy: userSummarySchema.nullable(),
  archivedAt: z.iso.datetime().nullable(),
  questions: z.array(editorQuestionSchema),
});

export type EvaluationVersionDetail = z.infer<typeof evaluationVersionDetailSchema>;

export const evaluationEventSchema = z.object({
  id: z.uuid(),
  versionId: z.uuid(),
  version: z.number().int(),
  action: z.enum(EVALUATION_VERSION_ACTIONS),
  fromStatus: z.enum(EVALUATION_VERSION_STATUSES).nullable(),
  toStatus: z.enum(EVALUATION_VERSION_STATUSES),
  actor: userSummarySchema,
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type EvaluationEvent = z.infer<typeof evaluationEventSchema>;

export const evaluationModuleRefSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  slug: z.string(),
  /** Titre de la version publiée (ou de la plus récente si le module n'est pas encore publié). */
  title: z.string(),
  published: z.boolean(),
});

export type EvaluationModuleRef = z.infer<typeof evaluationModuleRefSchema>;

export const EVALUATION_ACCESS_ROLES = ['AUTEUR', 'REDACTEUR_DU_MODULE', 'RESPONSABLE'] as const;

export const editorEvaluationListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  stage: stageSummarySchema,
  module: evaluationModuleRefSchema.nullable(),
  createdBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  access: z.enum(EVALUATION_ACCESS_ROLES),
  working: evaluationVersionSummarySchema.nullable(),
  published: evaluationVersionSummarySchema.nullable(),
  latest: evaluationVersionSummarySchema,
  attemptCount: z.number().int().nonnegative(),
});

export type EditorEvaluationListItem = z.infer<typeof editorEvaluationListItemSchema>;

export const editorEvaluationDetailSchema = editorEvaluationListItemSchema
  .omit({ working: true, latest: true })
  .extend({
    /** Étape et module modifiables (aucune version encore publiée). */
    settingsEditable: z.boolean(),
    /** Version de travail, sinon la plus récente. */
    current: evaluationVersionDetailSchema,
    versions: z.array(evaluationVersionSummarySchema),
    events: z.array(evaluationEventSchema),
  });

export type EditorEvaluationDetail = z.infer<typeof editorEvaluationDetailSchema>;

export const evaluationReviewSchema = z.object({
  evaluation: editorEvaluationDetailSchema,
  /** Version publiée actuelle, si elle diffère de la version examinée (comparaison). */
  published: evaluationVersionDetailSchema.nullable(),
});

export type EvaluationReview = z.infer<typeof evaluationReviewSchema>;

export const evaluationSubmissionItemSchema = z.object({
  evaluationId: z.uuid(),
  code: z.string(),
  stage: stageSummarySchema,
  module: evaluationModuleRefSchema.nullable(),
  createdBy: userSummarySchema.nullable(),
  version: evaluationVersionSummarySchema,
  submittedBy: userSummarySchema.nullable(),
  submissionNote: z.string().nullable(),
  replacesPublished: z.boolean(),
});

export type EvaluationSubmissionItem = z.infer<typeof evaluationSubmissionItemSchema>;

export const evaluationSubmissionListSchema = z.object({
  items: z.array(evaluationSubmissionItemSchema),
});

/** Modules proposés au rattachement d'une évaluation. */
export const moduleOptionListSchema = z.object({ items: z.array(evaluationModuleRefSchema) });
