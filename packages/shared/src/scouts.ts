import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { THEORETICAL_STAGE_REASONS } from './age-progression.js';
import { EVALUATION_MODES, ATTEMPT_STATUSES } from './evaluation-enums.js';
import { LEARNER_KINDS } from './roles.js';

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
 * Sexe d'un routier (D183) : donnée administrative choisie à l'inscription (obligatoire), jamais
 * déduite du prénom ni utilisée pour une décision pédagogique. Même liste que l'enum Prisma `ScoutSex`.
 */
export const SCOUT_SEXES = ['GARCON', 'FILLE'] as const;
export type ScoutSex = (typeof SCOUT_SEXES)[number];
export const SCOUT_SEX_LABELS: Record<ScoutSex, string> = { GARCON: 'Garçon', FILLE: 'Fille' };
export const scoutSexSchema = z.enum(SCOUT_SEXES, {
  error: (issue) =>
    issue.input === undefined ? 'Indiquez le sexe du routier (garçon ou fille).' : 'Sexe invalide.',
});

/**
 * Données administratives protégées d'un routier (D173) : renseignées uniquement par l'administrateur
 * ou le responsable plein en fonction, jamais par le routier lui-même. L'étape n'en fait pas partie :
 * elle est calculée selon l'âge et ne se saisit jamais.
 */
export const SCOUT_ADMIN_FIELDS = [
  'lastName',
  'firstName',
  'matricule',
  'sex',
  'birthDate',
  'joinedAt',
] as const;

export type ScoutAdminField = (typeof SCOUT_ADMIN_FIELDS)[number];

export const SCOUT_ADMIN_FIELD_LABELS: Record<ScoutAdminField, string> = {
  lastName: 'Nom',
  firstName: 'Prénoms',
  matricule: 'Matricule',
  sex: 'Sexe',
  birthDate: 'Date de naissance',
  joinedAt: 'Date d’entrée à la Route',
};

/**
 * Données d'une fiche adulte (D185) : identité seulement. Ni matricule, ni date de naissance, ni date
 * d'entrée : un adulte n'a ni étape, ni ancienneté à la Route (contrainte SQL
 * `scout_profiles_adult_fields_check`).
 */
export const ADULT_ADMIN_FIELDS = [
  'lastName',
  'firstName',
  'sex',
] as const satisfies readonly ScoutAdminField[];

/** Motif d'une correction (remplacement ou retrait d'une valeur déjà renseignée), conservé au journal. */
export const correctionReasonSchema = z
  .string()
  .trim()
  .min(5, { error: 'Indiquez le motif de la correction (5 caractères au minimum).' })
  .max(500, { error: '500 caractères au maximum.' });

/**
 * Étape accomplie avant l'arrivée sur la plateforme (D181). Date de fin facultative : jamais
 * inventée lorsqu'elle est inconnue.
 */
export const priorStageInputSchema = z.object({
  stageId: z.uuid({ error: 'Étape invalide.' }),
  completedOn: calendarDateSchema.optional(),
  note: z.string().trim().max(1000, { error: '1 000 caractères au maximum.' }).optional(),
});

export type PriorStageInput = z.input<typeof priorStageInputSchema>;

/**
 * Inscription d'un routier, sans adresse e-mail ni mot de passe : aucun compte n'est créé (RM-001).
 * **Sexe obligatoire (D183)**, choisi par celui qui inscrit. **Date de naissance obligatoire (D181)** : un routier actif a toujours une étape déterminée,
 * calculée par l'API ; une date qui ne permet pas de la déterminer bloque l'inscription. Matricule et
 * date d'entrée peuvent rester non renseignés (jamais remplacés par une valeur fictive).
 * `teamId` : affectation initiale facultative (même transaction).
 * `priorStages` : parcours antérieur reconnu dès l'inscription (responsable plein seulement).
 * `confirmDuplicate` : confirme l'inscription malgré un homonyme déjà enregistré.
 */
export const createScoutProfileInputSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  matricule: matriculeSchema.optional(),
  sex: scoutSexSchema,
  birthDate: calendarDateSchema,
  joinedAt: calendarDateSchema.optional(),
  teamId: z.uuid().optional(),
  priorStages: z.array(priorStageInputSchema).max(10).optional(),
  confirmDuplicate: z.boolean().optional(),
});

export type CreateScoutProfileInput = z.input<typeof createScoutProfileInputSchema>;

/**
 * Inscription d'un apprenant adulte (D185), sans compte : nom, prénoms et sexe. Aucune étape, aucune
 * équipe, aucun parcours antérieur. `confirmDuplicate` : homonyme déjà enregistré.
 */
export const createAdultProfileInputSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  sex: scoutSexSchema,
  confirmDuplicate: z.boolean().optional(),
});

export type CreateAdultProfileInput = z.input<typeof createAdultProfileInputSchema>;

/**
 * Modification administrative d'une fiche (D173). Renseigner une valeur absente est une
 * **complétion** ; remplacer ou retirer (`null`, chaîne vide pour le matricule) une valeur présente est
 * une **correction** : motif et confirmation exigés par l'API, ancienne et nouvelle valeurs journalisées.
 */
export const updateScoutProfileInputSchema = z
  .object({
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    matricule: matriculeSchema.nullable().optional(),
    /** Corrigeable avec motif, jamais retiré une fois renseigné (D183). */
    sex: scoutSexSchema.optional(),
    birthDate: calendarDateSchema.nullable().optional(),
    joinedAt: calendarDateSchema.nullable().optional(),
    /** Motif, obligatoire dès qu'une valeur déjà renseignée change. */
    reason: correctionReasonSchema.optional(),
    /** Confirmation explicite d'une correction. */
    confirmCorrection: z.literal(true).optional(),
    /** Version de la fiche vue lors de la saisie (synchronisation différée) : conflit si elle a changé. */
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .refine((value) => SCOUT_ADMIN_FIELDS.some((field) => value[field] !== undefined), {
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
  /** Routiers par défaut : les adultes (D185) ont leur propre liste. */
  kind: z.enum(LEARNER_KINDS).default('ROUTIER'),
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
  /** Équipe ouverte vue lors de la saisie (synchronisation différée) : conflit si elle a changé. */
  expectedTeamId: z.uuid().nullable().optional(),
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
  /** Routier ou adulte (D185), fixé à l'inscription. */
  kind: z.enum(LEARNER_KINDS),
  /** Nulle tant que la date d'entrée n'est pas renseignée. */
  joinedAt: z.iso.date().nullable(),
  /** Étape actuelle, calculée par l'API selon l'âge (D173) ; nulle = « Étape non déterminée ». */
  stage: stageSummarySchema.nullable(),
  /** Origine du calcul de l'étape (déterminée par l'âge, date de naissance manquante…). */
  stageReason: z.enum(THEORETICAL_STAGE_REASONS),
  team: teamRefSchema.nullable(),
  hasAccount: z.boolean(),
});

export type ScoutListItem = z.infer<typeof scoutListItemSchema>;

export const scoutDetailSchema = scoutListItemSchema.extend({
  /** Nul seulement pour une fiche antérieure à D183, jusqu'à sa complétion. */
  sex: z.enum(SCOUT_SEXES).nullable(),
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

/** État calculé d'un routier à une date de naissance donnée (aperçu d'une correction). */
export const computedStageSnapshotSchema = z.object({
  age: z.number().int().nullable(),
  stage: stageSummarySchema.nullable(),
  stageReason: z.enum(THEORETICAL_STAGE_REASONS),
  branchExitOn: z.iso.date().nullable(),
});

export type ComputedStageSnapshot = z.infer<typeof computedStageSnapshotSchema>;

/** Motifs empêchant d'enregistrer un routier actif (D181), voir `stageAdmissionIssue`. */
export const STAGE_ADMISSION_ISSUES = [
  'BIRTH_DATE_REQUIRED',
  'NO_AGE_RULE_SET',
  'BELOW_ROUTE_AGE',
  'NO_AGE_RULE',
  'ABOVE_ROUTE_AGE',
] as const;

export type StageAdmissionIssue = (typeof STAGE_ADMISSION_ISSUES)[number];

/** Aperçu, avant inscription, de l'étape calculée par l'API pour une date de naissance (D181). */
export const stagePreviewQuerySchema = z.object({ birthDate: calendarDateSchema });

export const stagePreviewSchema = computedStageSnapshotSchema.extend({
  /** Motif empêchant l'inscription comme routier actif (nul si l'étape est déterminée). */
  issue: z.enum(STAGE_ADMISSION_ISSUES).nullable(),
  message: z.string().nullable(),
  /** Étapes antérieures à l'étape proposée, qui peuvent être reconnues (parcours antérieur). */
  priorStages: z.array(stageSummarySchema),
});

export type StagePreview = z.infer<typeof stagePreviewSchema>;

export const birthDateImpactQuerySchema = z.object({
  birthDate: calendarDateSchema.or(z.literal('').transform(() => null)),
});

/**
 * Conséquences d'une correction de la date de naissance, montrées avant confirmation (D173) : rien
 * n'est écrit. Les obligations existantes ne sont jamais effacées : celles qui ne seraient plus
 * exigées passent « à réexaminer » ; les nouvelles sont créées après l'enregistrement.
 */
export const birthDateImpactSchema = z.object({
  current: computedStageSnapshotSchema,
  next: computedStageSnapshotSchema,
  /** Nouvelles obligations de rattrapage qui naîtraient de la correction. */
  newCatchUps: z.number().int(),
  /** Obligations sans décision dont l'étape d'origine ne serait plus échue. */
  catchUpsToReview: z.number().int(),
});

export type BirthDateImpact = z.infer<typeof birthDateImpactSchema>;
