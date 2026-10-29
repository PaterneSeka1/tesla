import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { ATTEMPT_STATUSES, EVALUATION_MODES } from './evaluation-enums.js';
import { NONE_FILTER, stageSummarySchema, teamRefSchema } from './scouts.js';

/**
 * Étapes de progression de la Branche Route (référentiel SAPF-Route).
 * Les durées dépendent de l'âge et restent à arbitrer : elles ne sont pas codées ici.
 */
export const PROGRESSION_STAGES = [
  {
    code: 'NOVICIAT',
    order: 1,
    name: 'Noviciat',
    programmeLabel: 'Novices Routiers',
    badge: 'Flot gris',
  },
  {
    code: 'APPRENTISSAGE',
    order: 2,
    name: 'Apprentissage',
    programmeLabel: 'Aspirants Routiers',
    badge: 'Flot marron',
  },
  {
    code: 'COMPAGNONNAGE',
    order: 3,
    name: 'Compagnonnage',
    programmeLabel: 'Compagnons Routiers',
    badge: 'Flot routier',
  },
  {
    code: 'DEPART_ROUTIER',
    order: 4,
    name: 'Départ routier',
    programmeLabel: 'Routiers Confirmés',
    badge: 'Étoile or',
  },
] as const;

export type ProgressionStageCode = (typeof PROGRESSION_STAGES)[number]['code'];

// ─── Phase 4 : historique des étapes, compétences, validations, études de modules ─────────
// Règles : docs/FEATURES/PROGRESSION.md et docs/FEATURES/COMPETENCES.md. Aucune règle ci-dessous ne
// déclenche de validation ou de changement d'étape : ce sont des contrats et des calculs d'affichage.

const requiredText = (min: number, max: number, label = 'Ce champ') =>
  z
    .string()
    .trim()
    .min(min, { error: `${label} est obligatoire (${min} caractères au minimum).` })
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value));

const calendarDate = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

/** Routier désigné dans une liste (sans données personnelles au-delà de l'identité et du matricule). */
export const scoutRefSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  matricule: z.string().nullable(),
  team: teamRefSchema.nullable(),
});

export type ScoutRef = z.infer<typeof scoutRefSchema>;

// ─── Historique des étapes ──────────────────────────────────────────────────

/** Synchronisé avec l'enum Prisma `StageChangeKind` (vérifié par un test). */
export const STAGE_CHANGE_KINDS = ['INSCRIPTION', 'DECISION', 'CORRECTION', 'REPRISE'] as const;

export type StageChangeKind = (typeof STAGE_CHANGE_KINDS)[number];

export const STAGE_CHANGE_KIND_LABELS: Record<StageChangeKind, string> = {
  INSCRIPTION: 'Étape initiale (inscription)',
  DECISION: 'Décision du responsable',
  CORRECTION: 'Correction d’une décision',
  REPRISE: 'Changement antérieur (repris)',
};

/**
 * Changement d'étape : acte officiel du responsable, confirmé explicitement. `expectedCurrentStageId`
 * protège contre une décision prise sur une fiche périmée (409 si l'étape a changé entre-temps).
 */
export const changeStageInputSchema = z.object({
  expectedCurrentStageId: z.uuid().nullable(),
  toStageId: z.uuid({ error: 'Choisissez la nouvelle étape.' }),
  effectiveOn: calendarDate,
  reason: requiredText(3, 2000, 'Le motif'),
  observations: optionalText(3000).optional(),
  evidence: optionalText(3000).optional(),
  ceremonyReference: optionalText(200).optional(),
  /** Correction exceptionnelle : désigne la décision corrigée (motif obligatoire, tracé). */
  correctsChangeId: z.uuid().optional(),
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type ChangeStageInput = z.input<typeof changeStageInputSchema>;

export const stageChangeSchema = z.object({
  id: z.uuid(),
  kind: z.enum(STAGE_CHANGE_KINDS),
  from: stageSummarySchema.nullable(),
  to: stageSummarySchema.nullable(),
  effectiveOn: z.iso.date(),
  decidedAt: z.iso.datetime(),
  decidedBy: userSummarySchema.nullable(),
  reason: z.string(),
  observations: z.string().nullable(),
  evidence: z.string().nullable(),
  ceremonyReference: z.string().nullable(),
  correctsChangeId: z.uuid().nullable(),
  /** Entrée qui corrige celle-ci (la décision reste visible). */
  correctedByChangeId: z.uuid().nullable(),
});

export type StageChange = z.infer<typeof stageChangeSchema>;

// ─── Référentiel de compétences ─────────────────────────────────────────────

/** Code lisible : lettres majuscules, chiffres, « - » ou « _ » (ex. SERV-01). */
export const COMPETENCY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;

const competencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => COMPETENCY_CODE_PATTERN.test(value), {
    message: 'Code invalide : 1 à 20 caractères (lettres, chiffres, - ou _), ex. SERV-01.',
  });

const criteriaSchema = z
  .array(requiredText(1, 300, 'Le critère'))
  .max(20, { error: '20 critères au maximum.' });

const competencyFields = {
  name: requiredText(3, 150, 'Le nom'),
  description: z.string().trim().max(3000, { error: '3 000 caractères au maximum.' }),
  domain: optionalText(80).nullable(),
  stageId: z.uuid().nullable(),
  observableCriteria: criteriaSchema,
  minEvidenceCount: z
    .number({ error: 'Nombre invalide.' })
    .int({ error: 'Nombre entier.' })
    .min(1, { error: '1 au minimum.' })
    .max(10, { error: '10 au maximum.' }),
  position: z.number().int().min(0).max(10_000),
  moduleIds: z.array(z.uuid()).max(20, { error: '20 modules au maximum.' }),
};

export const createCompetencyInputSchema = z.object({
  code: competencyCodeSchema,
  name: competencyFields.name,
  description: competencyFields.description.default(''),
  domain: competencyFields.domain.optional(),
  stageId: competencyFields.stageId.optional(),
  observableCriteria: competencyFields.observableCriteria.default([]),
  minEvidenceCount: competencyFields.minEvidenceCount.default(1),
  position: competencyFields.position.default(0),
  moduleIds: competencyFields.moduleIds.default([]),
});

export type CreateCompetencyInput = z.input<typeof createCompetencyInputSchema>;

/** Le code est figé après création (il peut figurer dans des décisions officielles). */
export const updateCompetencyInputSchema = z
  .object({
    name: competencyFields.name.optional(),
    description: competencyFields.description.optional(),
    domain: competencyFields.domain.optional(),
    stageId: competencyFields.stageId.optional(),
    observableCriteria: competencyFields.observableCriteria.optional(),
    minEvidenceCount: competencyFields.minEvidenceCount.optional(),
    position: competencyFields.position.optional(),
    moduleIds: competencyFields.moduleIds.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Aucune modification fournie.',
  });

export type UpdateCompetencyInput = z.input<typeof updateCompetencyInputSchema>;

export const competencyListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  stageId: z.union([z.uuid(), z.literal(NONE_FILTER)]).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});

export type CompetencyListQuery = z.input<typeof competencyListQuerySchema>;

const moduleRefSchema = z.object({ id: z.uuid(), code: z.string(), title: z.string() });

export const competencyRefSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
});

export type CompetencyRef = z.infer<typeof competencyRefSchema>;

export const competencySchema = competencyRefSchema.extend({
  description: z.string(),
  domain: z.string().nullable(),
  stage: stageSummarySchema.nullable(),
  observableCriteria: z.array(z.string()),
  minEvidenceCount: z.number().int(),
  isActive: z.boolean(),
  position: z.number().int(),
  modules: z.array(moduleRefSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Competency = z.infer<typeof competencySchema>;

// ─── Statut d'une compétence pour un routier ────────────────────────────────

export const COMPETENCY_STATUSES = [
  'NON_EVALUE',
  'EN_COURS',
  'PROPOSE',
  'ACQUIS',
  'A_RETRAVAILLER',
] as const;

export type CompetencyStatus = (typeof COMPETENCY_STATUSES)[number];

export const COMPETENCY_STATUS_LABELS: Record<CompetencyStatus, string> = {
  NON_EVALUE: 'Non évaluée',
  EN_COURS: 'En cours',
  PROPOSE: 'Proposée au responsable',
  ACQUIS: 'Acquise (validée)',
  A_RETRAVAILLER: 'À retravailler',
};

/**
 * Statut affiché, déduit des seules décisions humaines enregistrées. Seule une validation officielle
 * active du responsable donne « ACQUIS » ; un quiz, une présence ou une étude n'y suffisent jamais.
 * - `openProposal` : proposition en cours (EN_ATTENTE → PROPOSE ; COMPLEMENT_DEMANDE → EN_COURS) ;
 * - `latestDecision` : dernière décision non révoquée du responsable ;
 * - `hasWork` : travail engagé et enregistré (étude d'un module lié, présence à une activité liée,
 *   proposition antérieure retirée).
 */
export function computeCompetencyStatus(facts: {
  hasActiveAcquired: boolean;
  openProposal: 'EN_ATTENTE' | 'COMPLEMENT_DEMANDE' | null;
  latestDecision: 'ACQUIS' | 'A_RETRAVAILLER' | null;
  hasWork: boolean;
}): CompetencyStatus {
  if (facts.hasActiveAcquired) return 'ACQUIS';
  if (facts.openProposal === 'EN_ATTENTE') return 'PROPOSE';
  if (facts.openProposal === 'COMPLEMENT_DEMANDE') return 'EN_COURS';
  if (facts.latestDecision === 'A_RETRAVAILLER') return 'A_RETRAVAILLER';
  return facts.hasWork ? 'EN_COURS' : 'NON_EVALUE';
}

// ─── Propositions et validations officielles ────────────────────────────────

/** Synchronisés avec les enums Prisma (vérifié par un test). */
export const PROPOSAL_STATUSES = [
  'EN_ATTENTE',
  'COMPLEMENT_DEMANDE',
  'APPROUVEE',
  'REFUSEE',
  'RETIREE',
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  EN_ATTENTE: 'En attente du responsable',
  COMPLEMENT_DEMANDE: 'Complément demandé',
  APPROUVEE: 'Approuvée (acquis validé)',
  REFUSEE: 'Refusée (à retravailler)',
  RETIREE: 'Retirée',
};

export const PROPOSAL_ACTIONS = [
  'SOUMISE',
  'PREUVE_AJOUTEE',
  'COMPLEMENT_DEMANDE',
  'RESOUMISE',
  'APPROUVEE',
  'REFUSEE',
  'RETIREE',
] as const;

export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

export const PROPOSAL_ACTION_LABELS: Record<ProposalAction, string> = {
  SOUMISE: 'Proposition soumise',
  PREUVE_AJOUTEE: 'Élément justificatif ajouté',
  COMPLEMENT_DEMANDE: 'Complément demandé',
  RESOUMISE: 'Proposition soumise à nouveau',
  APPROUVEE: 'Acquis validé',
  REFUSEE: 'Proposition refusée',
  RETIREE: 'Proposition retirée',
};

export const EVIDENCE_KINDS = [
  'OBSERVATION',
  'EVALUATION',
  'ACTIVITE',
  'ETUDE_MODULE',
  'AUTRE',
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  OBSERVATION: 'Observation',
  EVALUATION: 'Évaluation',
  ACTIVITE: 'Activité',
  ETUDE_MODULE: 'Étude de module',
  AUTRE: 'Autre élément observable',
};

export const COMPETENCY_DECISIONS = ['ACQUIS', 'A_RETRAVAILLER'] as const;

export type CompetencyDecision = (typeof COMPETENCY_DECISIONS)[number];

export const COMPETENCY_DECISION_LABELS: Record<CompetencyDecision, string> = {
  ACQUIS: 'Acquis validé',
  A_RETRAVAILLER: 'À retravailler',
};

export const evidenceInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('OBSERVATION'), observationId: z.uuid() }),
  z.object({ kind: z.literal('EVALUATION'), attemptId: z.uuid() }),
  z.object({ kind: z.literal('ACTIVITE'), activityId: z.uuid() }),
  z.object({ kind: z.literal('ETUDE_MODULE'), moduleStudyId: z.uuid() }),
  z.object({ kind: z.literal('AUTRE'), description: requiredText(3, 1000, 'La description') }),
]);

export type EvidenceInput = z.input<typeof evidenceInputSchema>;

const evidenceListSchema = z
  .array(evidenceInputSchema)
  .max(20, { error: '20 éléments au maximum.' });

export const createProposalInputSchema = z.object({
  scoutProfileId: z.uuid({ error: 'Choisissez un routier.' }),
  competencyId: z.uuid({ error: 'Choisissez une compétence.' }),
  justification: requiredText(3, 3000, 'La justification'),
  evidences: evidenceListSchema.default([]),
});

export type CreateProposalInput = z.input<typeof createProposalInputSchema>;

const revisionSchema = z.number().int().min(1);

export const addEvidenceInputSchema = z.object({
  revision: revisionSchema,
  evidences: evidenceListSchema.min(1, { error: 'Ajoutez au moins un élément.' }),
});

export type AddEvidenceInput = z.input<typeof addEvidenceInputSchema>;

/** Resoumission ou retrait par l'auteur (commentaire facultatif). */
export const proposalAuthorActionInputSchema = z.object({
  revision: revisionSchema,
  comment: optionalText(2000).optional(),
});

export type ProposalAuthorActionInput = z.input<typeof proposalAuthorActionInputSchema>;

/** Décision du responsable : justification (approbation) ou motif (refus, complément) obligatoire. */
export const proposalDecisionInputSchema = z.object({
  revision: revisionSchema,
  comment: requiredText(3, 3000, 'La justification'),
});

export type ProposalDecisionInput = z.input<typeof proposalDecisionInputSchema>;

export const revokeValidationInputSchema = z.object({
  reason: requiredText(3, 2000, 'Le motif'),
});

export type RevokeValidationInput = z.input<typeof revokeValidationInputSchema>;

export const proposalListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'closed', 'all', ...PROPOSAL_STATUSES]).default('open'),
  scoutProfileId: z.uuid().optional(),
  competencyId: z.uuid().optional(),
  /** `true` : seulement les propositions de l'utilisateur connecté. */
  mine: z.enum(['true', 'false']).optional(),
});

export type ProposalListQuery = z.input<typeof proposalListQuerySchema>;

export const evidenceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(EVIDENCE_KINDS),
  /** Description lisible de l'élément référencé (titre, date, statut). */
  label: z.string(),
  /** Lien interne vers l'élément (activité, tentative), si consultable. */
  reference: z.string().nullable(),
  addedBy: userSummarySchema,
  createdAt: z.iso.datetime(),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const proposalEventSchema = z.object({
  id: z.uuid(),
  action: z.enum(PROPOSAL_ACTIONS),
  fromStatus: z.enum(PROPOSAL_STATUSES).nullable(),
  toStatus: z.enum(PROPOSAL_STATUSES),
  comment: z.string().nullable(),
  actor: userSummarySchema,
  createdAt: z.iso.datetime(),
});

export const proposalSchema = z.object({
  id: z.uuid(),
  status: z.enum(PROPOSAL_STATUSES),
  scout: scoutRefSchema.extend({ stage: stageSummarySchema.nullable() }),
  competency: competencyRefSchema.extend({
    minEvidenceCount: z.number().int(),
    stage: stageSummarySchema.nullable(),
    observableCriteria: z.array(z.string()),
  }),
  proposedBy: userSummarySchema,
  justification: z.string(),
  decisionComment: z.string().nullable(),
  decidedBy: userSummarySchema.nullable(),
  decidedAt: z.iso.datetime().nullable(),
  revision: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  evidences: z.array(evidenceSchema),
  events: z.array(proposalEventSchema),
  validation: z
    .object({
      id: z.uuid(),
      decision: z.enum(COMPETENCY_DECISIONS),
      revokedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  /** Le responsable peut décider (proposition en attente). */
  canDecide: z.boolean(),
  /** L'auteur (ou le responsable) peut compléter, resoumettre ou retirer. */
  canEdit: z.boolean(),
});

export type Proposal = z.infer<typeof proposalSchema>;

export const competencyValidationSchema = z.object({
  id: z.uuid(),
  competency: competencyRefSchema,
  decision: z.enum(COMPETENCY_DECISIONS),
  justification: z.string(),
  decidedBy: userSummarySchema,
  decidedAt: z.iso.datetime(),
  proposalId: z.uuid(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: userSummarySchema.nullable(),
  revocationReason: z.string().nullable(),
});

export type CompetencyValidation = z.infer<typeof competencyValidationSchema>;

// ─── Études de modules ──────────────────────────────────────────────────────

export const STUDY_MODES = [
  'LECTURE_NUMERIQUE',
  'LECTURE_HORS_LIGNE',
  'COURS_PAPIER',
  'FORMATION_COLLECTIVE',
] as const;

export type StudyMode = (typeof STUDY_MODES)[number];

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  LECTURE_NUMERIQUE: 'Lecture numérique',
  LECTURE_HORS_LIGNE: 'Lecture hors ligne',
  COURS_PAPIER: 'Cours papier',
  FORMATION_COLLECTIVE: 'Formation collective',
};

/** Saisie par un chef ou le responsable (routier avec ou sans compte). */
export const recordModuleStudyInputSchema = z.object({
  moduleId: z.uuid({ error: 'Choisissez un module.' }),
  mode: z.enum(STUDY_MODES, { error: 'Choisissez une modalité.' }),
  studiedOn: calendarDate,
  activityId: z.uuid().optional(),
  observation: optionalText(1000).optional(),
});

export type RecordModuleStudyInput = z.input<typeof recordModuleStudyInputSchema>;

/** Déclaration par le routier lui-même : lecture numérique de la version publiée, à la date du jour. */
export const declareModuleStudyInputSchema = z.object({ moduleId: z.uuid() });

export type DeclareModuleStudyInput = z.input<typeof declareModuleStudyInputSchema>;

export const cancelModuleStudyInputSchema = z.object({
  reason: requiredText(3, 1000, 'Le motif'),
});

export type CancelModuleStudyInput = z.input<typeof cancelModuleStudyInputSchema>;

export const moduleStudySchema = z.object({
  id: z.uuid(),
  module: moduleRefSchema,
  moduleVersion: z.number().int().nullable(),
  mode: z.enum(STUDY_MODES),
  studiedOn: z.iso.date(),
  activity: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  observation: z.string().nullable(),
  recordedBy: userSummarySchema,
  /** Déclarée par le routier lui-même. */
  selfDeclared: z.boolean(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type ModuleStudy = z.infer<typeof moduleStudySchema>;

// ─── Dossier de progression d'un routier ────────────────────────────────────

export const scoutCompetencyItemSchema = z.object({
  competency: competencyRefSchema.extend({
    domain: z.string().nullable(),
    stage: stageSummarySchema.nullable(),
    isActive: z.boolean(),
  }),
  status: z.enum(COMPETENCY_STATUSES),
  /** Validation officielle ACQUIS active, le cas échéant. */
  validatedAt: z.iso.datetime().nullable(),
  openProposal: z.object({ id: z.uuid(), status: z.enum(PROPOSAL_STATUSES) }).nullable(),
});

export type ScoutCompetencyItem = z.infer<typeof scoutCompetencyItemSchema>;

export const scoutAttemptItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  evaluationTitle: z.string(),
  mode: z.enum(EVALUATION_MODES),
  status: z.enum(ATTEMPT_STATUSES),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const scoutProgressionSchema = z.object({
  scout: scoutRefSchema.extend({
    isActive: z.boolean(),
    hasAccount: z.boolean(),
    stage: stageSummarySchema.nullable(),
    stageSince: z.iso.date().nullable(),
  }),
  stageChanges: z.array(stageChangeSchema),
  competencies: z.array(scoutCompetencyItemSchema),
  validations: z.array(competencyValidationSchema),
  proposals: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(PROPOSAL_STATUSES),
      competency: competencyRefSchema,
      proposedBy: userSummarySchema,
      createdAt: z.iso.datetime(),
      decidedAt: z.iso.datetime().nullable(),
    }),
  ),
  moduleStudies: z.array(moduleStudySchema),
  attempts: z.array(scoutAttemptItemSchema),
  attendance: z.object({
    present: z.number().int(),
    absent: z.number().int(),
    excused: z.number().int(),
    recent: z.array(
      z.object({
        activity: z.object({
          id: z.uuid(),
          title: z.string(),
          plannedOn: z.iso.date(),
          heldOn: z.iso.date().nullable(),
        }),
        status: z.enum(['PRESENT', 'ABSENT', 'EXCUSE']),
        note: z.string().nullable(),
      }),
    ),
  }),
  /** Le lecteur est le responsable (décisions possibles). */
  canDecide: z.boolean(),
});

export type ScoutProgression = z.infer<typeof scoutProgressionSchema>;

export const TIMELINE_KINDS = [
  'EQUIPE',
  'ETAPE',
  'VALIDATION',
  'PROPOSITION',
  'ETUDE',
  'EVALUATION',
  'PRESENCE',
  'COMPTE',
] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  EQUIPE: 'Équipe',
  ETAPE: 'Étape',
  VALIDATION: 'Validation officielle',
  PROPOSITION: 'Proposition',
  ETUDE: 'Étude de module',
  EVALUATION: 'Évaluation',
  PRESENCE: 'Présence',
  COMPTE: 'Compte',
};

/** Historique chronologique unifié d'un routier (données enregistrées uniquement). */
export const scoutTimelineSchema = z.object({
  items: z.array(
    z.object({
      at: z.iso.datetime(),
      kind: z.enum(TIMELINE_KINDS),
      title: z.string(),
      detail: z.string().nullable(),
      by: userSummarySchema.nullable(),
    }),
  ),
});

export type ScoutTimeline = z.infer<typeof scoutTimelineSchema>;

/** Progression vue par le routier : décisions officielles et parcours, jamais les notes internes. */
export const myProgressionSchema = z.object({
  scout: z.object({
    firstName: z.string(),
    lastName: z.string(),
    team: teamRefSchema.nullable(),
    stage: stageSummarySchema.nullable(),
    stageSince: z.iso.date().nullable(),
  }),
  stageChanges: z.array(
    z.object({
      id: z.uuid(),
      from: stageSummarySchema.nullable(),
      to: stageSummarySchema.nullable(),
      effectiveOn: z.iso.date(),
    }),
  ),
  /** Compétences officiellement validées (validations actives). */
  acquired: z.array(
    z.object({
      competency: competencyRefSchema.extend({ domain: z.string().nullable() }),
      validatedAt: z.iso.datetime(),
    }),
  ),
  /** Compétences actives de l'étape courante, avec l'indication « validée » ou non. */
  stageCompetencies: z.array(
    z.object({
      competency: competencyRefSchema.extend({
        description: z.string(),
        observableCriteria: z.array(z.string()),
      }),
      acquired: z.boolean(),
    }),
  ),
  moduleStudies: z.array(moduleStudySchema.omit({ recordedBy: true })),
});

export type MyProgression = z.infer<typeof myProgressionSchema>;
