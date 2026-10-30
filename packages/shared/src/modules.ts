import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { lessonDocumentSchema } from './lesson-content.js';
import { stageSummarySchema } from './scouts.js';

// ─── Référentiels ──────────────────────────────────────────────────────────

/** États éditoriaux. Doit rester synchronisé avec l'enum Prisma `ModuleVersionStatus` (vérifié par un test). */
export const MODULE_VERSION_STATUSES = [
  'BROUILLON',
  'SOUMIS',
  'A_CORRIGER',
  'REFUSE',
  'APPROUVE',
  'PUBLIE',
  'ARCHIVE',
] as const;

export type ModuleVersionStatus = (typeof MODULE_VERSION_STATUSES)[number];

export const MODULE_VERSION_STATUS_LABELS: Record<ModuleVersionStatus, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis',
  A_CORRIGER: 'À corriger',
  REFUSE: 'Refusé',
  APPROUVE: 'Approuvé',
  PUBLIE: 'Publié',
  ARCHIVE: 'Archivé',
};

/** Versions « de travail » : au plus une par module (index unique partiel). */
export const WORKING_MODULE_STATUSES = ['BROUILLON', 'SOUMIS', 'A_CORRIGER', 'APPROUVE'] as const;

/**
 * Transitions autorisées (même table que le trigger SQL `module_versions_guard`).
 * Tout passage hors brouillon, sauf la soumission, est réservé au responsable.
 */
export const MODULE_VERSION_TRANSITIONS: Record<
  ModuleVersionStatus,
  readonly ModuleVersionStatus[]
> = {
  BROUILLON: ['SOUMIS'],
  SOUMIS: ['APPROUVE', 'A_CORRIGER', 'REFUSE'],
  APPROUVE: ['PUBLIE', 'A_CORRIGER'],
  A_CORRIGER: ['BROUILLON'],
  PUBLIE: ['ARCHIVE'],
  REFUSE: [],
  ARCHIVE: [],
};

export function canTransition(from: ModuleVersionStatus, to: ModuleVersionStatus): boolean {
  return MODULE_VERSION_TRANSITIONS[from].includes(to);
}

/** Doit rester synchronisé avec l'enum Prisma `ModuleVersionAction`. */
export const MODULE_VERSION_ACTIONS = [
  'CREEE',
  'SOUMISE',
  'REPRISE',
  'CORRECTIONS_DEMANDEES',
  'REFUSEE',
  'APPROUVEE',
  'PUBLIEE',
  'REMPLACEE',
  'ARCHIVEE',
] as const;

export type ModuleVersionAction = (typeof MODULE_VERSION_ACTIONS)[number];

export const MODULE_VERSION_ACTION_LABELS: Record<ModuleVersionAction, string> = {
  CREEE: 'Version créée',
  SOUMISE: 'Soumise à l’approbation',
  REPRISE: 'Rédaction reprise',
  CORRECTIONS_DEMANDEES: 'Corrections demandées',
  REFUSEE: 'Refusée',
  APPROUVEE: 'Approuvée',
  PUBLIEE: 'Publiée',
  REMPLACEE: 'Remplacée par une nouvelle version',
  ARCHIVEE: 'Archivée',
};

/** Décisions du responsable (historique des publications). */
export const MODULE_DECISION_ACTIONS = [
  'CORRECTIONS_DEMANDEES',
  'REFUSEE',
  'APPROUVEE',
  'PUBLIEE',
  'REMPLACEE',
  'ARCHIVEE',
] as const satisfies readonly ModuleVersionAction[];

/** Doit rester synchronisé avec l'enum Prisma `ModuleResourceKind`. */
export const MODULE_RESOURCE_KINDS = ['IMAGE', 'DOCUMENT', 'VIDEO', 'LIEN'] as const;

export type ModuleResourceKind = (typeof MODULE_RESOURCE_KINDS)[number];

export const MODULE_RESOURCE_KIND_LABELS: Record<ModuleResourceKind, string> = {
  IMAGE: 'Image',
  DOCUMENT: 'Document',
  VIDEO: 'Vidéo externe',
  LIEN: 'Lien de référence',
};

/**
 * Hébergeurs de vidéos acceptés (aucune vidéo stockée sur le VPS). Liste provisoire,
 * modifiable ici (voir docs/DECISIONS.md).
 */
export const ALLOWED_VIDEO_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
] as const;

/** Code interne affiché à partir du numéro séquentiel : 7 → « MOD-007 ». */
export function formatModuleCode(number: number): string {
  return `MOD-${String(number).padStart(3, '0')}`;
}

/** Slug d'URL : minuscules sans accents, mots séparés par des tirets (60 caractères au plus). */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'module';
}

// ─── Entrées ───────────────────────────────────────────────────────────────

const titleSchema = z
  .string()
  .trim()
  .min(3, { error: '3 caractères au minimum.' })
  .max(150, { error: '150 caractères au maximum.' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value));

const durationSchema = z
  .number({ error: 'Durée invalide.' })
  .int({ error: 'Nombre entier de minutes.' })
  .min(1, { error: '1 minute au minimum.' })
  .max(6000, { error: '6 000 minutes au maximum.' });

const objectivesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, { error: 'Objectif vide.' })
      .max(300, { error: '300 caractères au maximum.' }),
  )
  .max(20, { error: '20 objectifs au maximum.' });

/** Typologie (D99). Synchronisé avec l'enum Prisma `ModuleCategory`. Le rattrapage n'en est pas une. */
export const MODULE_CATEGORIES = [
  'TRANSVERSAL',
  'ETAPE',
  'COMPLEMENTAIRE',
  'TEXTE_FONDAMENTAL',
] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export const MODULE_CATEGORY_LABELS: Record<ModuleCategory, string> = {
  TRANSVERSAL: 'Découverte (toutes étapes)',
  ETAPE: 'Parcours d’étape',
  COMPLEMENTAIRE: 'Complémentaire',
  TEXTE_FONDAMENTAL: 'Texte fondamental',
};

/** Synchronisé avec l'enum Prisma `ModuleObligation` ; null = non précisé. */
export const MODULE_OBLIGATIONS = ['OBLIGATOIRE', 'FACULTATIF'] as const;

export type ModuleObligation = (typeof MODULE_OBLIGATIONS)[number];

export const MODULE_OBLIGATION_LABELS: Record<ModuleObligation, string> = {
  OBLIGATOIRE: 'Obligatoire',
  FACULTATIF: 'Facultatif',
};

/**
 * Cohérence de la typologie (également imposée en base) : un module d'étape a une étape ; un module
 * obligatoire est un module d'étape appuyé sur une source officielle. Renvoie le message d'erreur.
 */
export function moduleTypologyError(fields: {
  category: ModuleCategory | null;
  obligation: ModuleObligation | null;
  stageId: string | null;
  officialSource: string | null;
}): string | null {
  if (fields.category === 'ETAPE' && !fields.stageId) {
    return 'Un module de parcours d’étape doit indiquer son étape.';
  }
  if (
    fields.obligation === 'OBLIGATOIRE' &&
    (fields.category !== 'ETAPE' || !fields.stageId || !fields.officialSource)
  ) {
    return 'Un module obligatoire doit relever d’une étape et citer sa source officielle (manuel, édition).';
  }
  return null;
}

/** Informations éditoriales d'une version (titre, description, objectifs…). */
const moduleMetadataShape = {
  title: titleSchema,
  summary: z.string().trim().max(2000, { error: '2 000 caractères au maximum.' }),
  objectives: objectivesSchema,
  prerequisites: optionalText(2000).nullable(),
  durationMinutes: durationSchema.nullable(),
  stageId: z.uuid().nullable(),
  theme: optionalText(80).nullable(),
  category: z.enum(MODULE_CATEGORIES).nullable(),
  obligation: z.enum(MODULE_OBLIGATIONS).nullable(),
  /** Référence du document officiel ; null = contenu éditorial non homologué. */
  officialSource: optionalText(500).nullable(),
};

export const createModuleInputSchema = z.object({
  title: moduleMetadataShape.title,
  summary: moduleMetadataShape.summary.default(''),
  objectives: moduleMetadataShape.objectives.default([]),
  prerequisites: moduleMetadataShape.prerequisites.optional(),
  durationMinutes: moduleMetadataShape.durationMinutes.optional(),
  stageId: moduleMetadataShape.stageId.optional(),
  theme: moduleMetadataShape.theme.optional(),
  category: moduleMetadataShape.category.optional(),
  obligation: moduleMetadataShape.obligation.optional(),
  officialSource: moduleMetadataShape.officialSource.optional(),
});

export type CreateModuleInput = z.input<typeof createModuleInputSchema>;

/** Version visée et compteur de concurrence lu par le client (refus 409 si modifié entre-temps). */
const versionTarget = { versionId: z.uuid(), revision: z.number().int().min(1) };

export const updateModuleVersionInputSchema = z
  .object({
    ...versionTarget,
    title: moduleMetadataShape.title.optional(),
    summary: moduleMetadataShape.summary.optional(),
    objectives: moduleMetadataShape.objectives.optional(),
    prerequisites: moduleMetadataShape.prerequisites.optional(),
    durationMinutes: moduleMetadataShape.durationMinutes.optional(),
    stageId: moduleMetadataShape.stageId.optional(),
    theme: moduleMetadataShape.theme.optional(),
    category: moduleMetadataShape.category.optional(),
    obligation: moduleMetadataShape.obligation.optional(),
    officialSource: moduleMetadataShape.officialSource.optional(),
  })
  .refine(
    ({ versionId: _v, revision: _r, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: 'Aucune modification fournie.' },
  );

export type UpdateModuleVersionInput = z.input<typeof updateModuleVersionInputSchema>;

const lessonTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'Le titre est requis.' })
  .max(150, { error: '150 caractères au maximum.' });

export const createLessonInputSchema = z.object({
  versionId: z.uuid(),
  title: lessonTitleSchema,
  durationMinutes: durationSchema.nullable().optional(),
  content: lessonDocumentSchema.optional(),
});

export type CreateLessonInput = z.input<typeof createLessonInputSchema>;

export const updateLessonInputSchema = z
  .object({
    revision: z.number().int().min(1),
    title: lessonTitleSchema.optional(),
    durationMinutes: durationSchema.nullable().optional(),
    content: lessonDocumentSchema.optional(),
  })
  .refine(
    ({ revision: _r, ...fields }) => Object.values(fields).some((value) => value !== undefined),
    { message: 'Aucune modification fournie.' },
  );

export type UpdateLessonInput = z.input<typeof updateLessonInputSchema>;

export const deleteLessonQuerySchema = z.object({ revision: z.coerce.number().int().min(1) });

/** Nouvel ordre complet des leçons : refusé si la liste ne correspond plus aux leçons existantes. */
export const reorderLessonsInputSchema = z.object({
  versionId: z.uuid(),
  lessonIds: z.array(z.uuid()).min(1).max(200),
});

export type ReorderLessonsInput = z.input<typeof reorderLessonsInputSchema>;

function isAllowedResourceUrl(kind: ModuleResourceKind, raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (kind === 'LIEN') return url.protocol === 'https:' || url.protocol === 'http:';
  if (url.protocol !== 'https:') return false;
  if (kind === 'VIDEO') return (ALLOWED_VIDEO_HOSTS as readonly string[]).includes(url.hostname);
  return true;
}

export const createResourceInputSchema = z
  .object({
    versionId: z.uuid(),
    lessonId: z.uuid().nullable().optional(),
    kind: z.enum(MODULE_RESOURCE_KINDS, { error: 'Type de ressource invalide.' }),
    title: z.string().trim().min(1, { error: 'Le titre est requis.' }).max(150),
    url: z.string().trim().max(2000, { error: 'Adresse trop longue.' }),
    description: optionalText(500).nullable().optional(),
  })
  .refine((value) => isAllowedResourceUrl(value.kind, value.url), {
    path: ['url'],
    message: 'Adresse non autorisée : https:// requis (vidéos : YouTube ou Vimeo uniquement).',
  });

export type CreateResourceInput = z.input<typeof createResourceInputSchema>;

/** Nombre maximal de textes fondamentaux cités par une version. */
export const MAX_TEXT_LINKS = 10;

/** Textes fondamentaux cités par le brouillon (liste complète, dans l'ordre d'affichage). */
export const setTextLinksInputSchema = z.object({
  versionId: z.uuid(),
  textModuleIds: z
    .array(z.uuid())
    .max(MAX_TEXT_LINKS, { error: `${MAX_TEXT_LINKS} textes au maximum.` })
    .refine((ids) => new Set(ids).size === ids.length, { error: 'Texte cité deux fois.' }),
});

export type SetTextLinksInput = z.input<typeof setTextLinksInputSchema>;

/** Texte fondamental cité par une version (référence, jamais une copie). */
export const moduleTextLinkSchema = z.object({
  moduleId: z.uuid(),
  code: z.string(),
  slug: z.string(),
  title: z.string(),
  /** Faux tant qu'aucune version du texte n'est publiée : la bibliothèque ne l'affiche pas. */
  published: z.boolean(),
});

export type ModuleTextLink = z.infer<typeof moduleTextLinkSchema>;

export const textCandidateListSchema = z.object({ items: z.array(moduleTextLinkSchema) });

export const addCollaboratorInputSchema = z.object({ userId: z.uuid() });

export type AddCollaboratorInput = z.input<typeof addCollaboratorInputSchema>;

export const submitModuleInputSchema = z.object({
  ...versionTarget,
  note: optionalText(1000).optional(),
});

export type SubmitModuleInput = z.input<typeof submitModuleInputSchema>;

/** Action sur une version identifiée sans ambiguïté (reprise, création, publication). */
export const versionActionInputSchema = z.object({ versionId: z.uuid() });

export type VersionActionInput = z.input<typeof versionActionInputSchema>;

/** Approbation : commentaire facultatif. */
export const approveModuleInputSchema = z.object({
  versionId: z.uuid(),
  comment: optionalText(2000).optional(),
});

export type ApproveModuleInput = z.input<typeof approveModuleInputSchema>;

/** Demande de correction, refus, archivage : motif obligatoire. */
export const motivatedDecisionInputSchema = z.object({
  versionId: z.uuid(),
  comment: z
    .string()
    .trim()
    .min(1, { error: 'Le motif est obligatoire.' })
    .max(2000, { error: '2 000 caractères au maximum.' }),
});

export type MotivatedDecisionInput = z.input<typeof motivatedDecisionInputSchema>;

export const editorModuleListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  /** `working` = brouillon, soumis, à corriger ou approuvé ; `published` = version publiée en ligne. */
  status: z.enum([...MODULE_VERSION_STATUSES, 'working', 'published', 'all']).default('all'),
});

export type EditorModuleListQuery = z.input<typeof editorModuleListQuerySchema>;

export const submissionListQuerySchema = z.object({
  status: z.enum(['SOUMIS', 'APPROUVE']).default('SOUMIS'),
});

export type SubmissionListQuery = z.input<typeof submissionListQuerySchema>;

export const catalogQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  stageId: z.uuid().optional(),
  theme: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  category: z.enum(MODULE_CATEGORIES).optional(),
});

export type CatalogQuery = z.input<typeof catalogQuerySchema>;

export const publicationHistoryQuerySchema = paginationQuerySchema;

// ─── Réponses ──────────────────────────────────────────────────────────────

export const moduleVersionSummarySchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(MODULE_VERSION_STATUSES),
  title: z.string(),
  stage: stageSummarySchema.nullable(),
  theme: z.string().nullable(),
  category: z.enum(MODULE_CATEGORIES).nullable(),
  lessonCount: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
});

export type ModuleVersionSummary = z.infer<typeof moduleVersionSummarySchema>;

/** Relation de l'utilisateur courant avec le module. */
export const MODULE_ACCESS_ROLES = ['AUTEUR', 'COLLABORATEUR', 'RESPONSABLE'] as const;

export const editorModuleListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  slug: z.string(),
  /** Null = module créé par le système (import d'une source documentaire). */
  createdBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  access: z.enum(MODULE_ACCESS_ROLES),
  /** Version de travail (au plus une). */
  working: moduleVersionSummarySchema.nullable(),
  /** Version publiée courante. */
  published: moduleVersionSummarySchema.nullable(),
  /** Version la plus récente, quel que soit son état. */
  latest: moduleVersionSummarySchema,
});

export type EditorModuleListItem = z.infer<typeof editorModuleListItemSchema>;

export const moduleResourceSchema = z.object({
  id: z.uuid(),
  lessonId: z.uuid().nullable(),
  kind: z.enum(MODULE_RESOURCE_KINDS),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type ModuleResource = z.infer<typeof moduleResourceSchema>;

export const moduleLessonSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  title: z.string(),
  durationMinutes: z.number().int().nullable(),
  content: lessonDocumentSchema,
  revision: z.number().int(),
  updatedAt: z.iso.datetime(),
  updatedBy: userSummarySchema.nullable(),
});

export type ModuleLesson = z.infer<typeof moduleLessonSchema>;

export const moduleVersionDetailSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: z.enum(MODULE_VERSION_STATUSES),
  title: z.string(),
  summary: z.string(),
  objectives: z.array(z.string()),
  prerequisites: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  stage: stageSummarySchema.nullable(),
  theme: z.string().nullable(),
  category: z.enum(MODULE_CATEGORIES).nullable(),
  obligation: z.enum(MODULE_OBLIGATIONS).nullable(),
  officialSource: z.string().nullable(),
  revision: z.number().int(),
  basedOnVersion: z.number().int().nullable(),
  createdBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  updatedBy: userSummarySchema.nullable(),
  submittedAt: z.iso.datetime().nullable(),
  submittedBy: userSummarySchema.nullable(),
  submissionNote: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  approvedBy: userSummarySchema.nullable(),
  publishedAt: z.iso.datetime().nullable(),
  publishedBy: userSummarySchema.nullable(),
  archivedAt: z.iso.datetime().nullable(),
  lessons: z.array(moduleLessonSchema),
  resources: z.array(moduleResourceSchema),
  textLinks: z.array(moduleTextLinkSchema),
});

export type ModuleVersionDetail = z.infer<typeof moduleVersionDetailSchema>;

export const moduleEventSchema = z.object({
  id: z.uuid(),
  versionId: z.uuid(),
  version: z.number().int(),
  action: z.enum(MODULE_VERSION_ACTIONS),
  fromStatus: z.enum(MODULE_VERSION_STATUSES).nullable(),
  toStatus: z.enum(MODULE_VERSION_STATUSES),
  /** Null = création par le système (import) ; toute décision a un auteur humain (contrainte SQL). */
  actor: userSummarySchema.nullable(),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type ModuleEvent = z.infer<typeof moduleEventSchema>;

export const moduleCollaboratorSchema = z.object({
  user: userSummarySchema,
  addedBy: userSummarySchema,
  addedAt: z.iso.datetime(),
});

export type ModuleCollaborator = z.infer<typeof moduleCollaboratorSchema>;

/** Nature d'une note éditoriale d'import. */
export const SOURCE_NOTE_KINDS = ['A_COMPLETER', 'A_VERIFIER', 'INFORMATION'] as const;

export const SOURCE_NOTE_KIND_LABELS: Record<(typeof SOURCE_NOTE_KINDS)[number], string> = {
  A_COMPLETER: 'À compléter',
  A_VERIFIER: 'À vérifier',
  INFORMATION: 'Information',
};

export const sourceEditorialNoteSchema = z.object({
  kind: z.enum(SOURCE_NOTE_KINDS),
  /** Rang de la leçon concernée dans la version importée (0, 1…) ; null = module entier. */
  lessonPosition: z.number().int().nonnegative().nullable(),
  note: z.string(),
});

export type SourceEditorialNote = z.infer<typeof sourceEditorialNoteSchema>;

/** Provenance d'un module importé : réservée aux rédacteurs, jamais transmise aux routiers. */
export const moduleSourceImportSchema = z.object({
  sourceKey: z.string(),
  sourceDocument: z.string(),
  sourcePages: z.string(),
  importedAt: z.iso.datetime(),
  editorialNotes: z.array(sourceEditorialNoteSchema),
});

export type ModuleSourceImport = z.infer<typeof moduleSourceImportSchema>;

export const editorModuleDetailSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  slug: z.string(),
  createdBy: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  access: z.enum(MODULE_ACCESS_ROLES),
  publishedVersionId: z.uuid().nullable(),
  /** Provenance si le module a été créé par import système, sinon null. */
  sourceImport: moduleSourceImportSchema.nullable(),
  /** Version de travail si elle existe, sinon la plus récente. */
  current: moduleVersionDetailSchema,
  versions: z.array(moduleVersionSummarySchema),
  collaborators: z.array(moduleCollaboratorSchema),
  events: z.array(moduleEventSchema),
  /** Actions permises à l'utilisateur courant (l'API les vérifie de toute façon). */
  permissions: z.object({
    canEdit: z.boolean(),
    canSubmit: z.boolean(),
    canResume: z.boolean(),
    canCreateVersion: z.boolean(),
    canManageCollaborators: z.boolean(),
    canReview: z.boolean(),
    /** Brouillon vide supprimable définitivement par le responsable (D129). */
    canPurge: z.boolean(),
  }),
});

export type EditorModuleDetail = z.infer<typeof editorModuleDetailSchema>;

/** Révision par le responsable : module complet et version publiée actuelle (pour comparaison). */
export const moduleReviewSchema = z.object({
  module: editorModuleDetailSchema,
  published: moduleVersionDetailSchema.nullable(),
});

export type ModuleReview = z.infer<typeof moduleReviewSchema>;

export const submissionItemSchema = z.object({
  moduleId: z.uuid(),
  code: z.string(),
  createdBy: userSummarySchema.nullable(),
  collaborators: z.array(userSummarySchema),
  version: moduleVersionSummarySchema,
  submittedBy: userSummarySchema.nullable(),
  submissionNote: z.string().nullable(),
  /** Une version est déjà publiée : la publication de celle-ci la remplacera. */
  replacesPublished: z.boolean(),
});

export type SubmissionItem = z.infer<typeof submissionItemSchema>;

export const submissionListSchema = z.object({ items: z.array(submissionItemSchema) });

export const moduleActivityItemSchema = moduleEventSchema.extend({
  moduleId: z.uuid(),
  code: z.string(),
  title: z.string(),
});

export type ModuleActivityItem = z.infer<typeof moduleActivityItemSchema>;

export const moduleActivityListSchema = z.object({ items: z.array(moduleActivityItemSchema) });

export const chefCandidateListSchema = z.object({ items: z.array(userSummarySchema) });

// ─── Bibliothèque (versions publiées uniquement) ───────────────────────────

export const catalogModuleSchema = z.object({
  slug: z.string(),
  code: z.string(),
  version: z.number().int(),
  title: z.string(),
  summary: z.string(),
  stage: stageSummarySchema.nullable(),
  theme: z.string().nullable(),
  category: z.enum(MODULE_CATEGORIES).nullable(),
  obligation: z.enum(MODULE_OBLIGATIONS).nullable(),
  /** Faux = contenu éditorial non homologué (aucune source officielle citée). */
  official: z.boolean(),
  durationMinutes: z.number().int().nullable(),
  lessonCount: z.number().int().nonnegative(),
  publishedAt: z.iso.datetime(),
});

export type CatalogModule = z.infer<typeof catalogModuleSchema>;

export const catalogPageSchema = z.object({
  items: z.array(catalogModuleSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  /** Thèmes des modules publiés (filtre). */
  themes: z.array(z.string()),
  /** Étape actuelle du routier connecté, pour signaler les modules recommandés (jamais un blocage). */
  myStageId: z.uuid().nullable(),
});

export type CatalogPage = z.infer<typeof catalogPageSchema>;

export const catalogLessonSummarySchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  title: z.string(),
  durationMinutes: z.number().int().nullable(),
});

const publicResourceSchema = moduleResourceSchema.omit({ createdAt: true });

export const catalogModuleDetailSchema = catalogModuleSchema.extend({
  objectives: z.array(z.string()),
  prerequisites: z.string().nullable(),
  lessons: z.array(catalogLessonSummarySchema),
  resources: z.array(publicResourceSchema),
  /** Textes fondamentaux cités dont une version est publiée (absent des copies hors ligne antérieures). */
  texts: z.array(z.object({ slug: z.string(), title: z.string() })).default([]),
  myStageId: z.uuid().nullable(),
});

export type CatalogModuleDetail = z.infer<typeof catalogModuleDetailSchema>;

export const catalogLessonSchema = z.object({
  module: z.object({
    slug: z.string(),
    title: z.string(),
    version: z.number().int(),
    code: z.string(),
  }),
  lesson: catalogLessonSummarySchema.extend({
    content: lessonDocumentSchema,
    resources: z.array(publicResourceSchema),
  }),
  lessonCount: z.number().int(),
  previous: catalogLessonSummarySchema.nullable(),
  next: catalogLessonSummarySchema.nullable(),
});

export type CatalogLesson = z.infer<typeof catalogLessonSchema>;

/** Version imprimable : tout le contenu publié, jamais de corrigé. */
export const printableModuleSchema = catalogModuleSchema.extend({
  objectives: z.array(z.string()),
  prerequisites: z.string().nullable(),
  lessons: z.array(
    catalogLessonSummarySchema.extend({
      content: lessonDocumentSchema,
      resources: z.array(publicResourceSchema),
    }),
  ),
  resources: z.array(publicResourceSchema),
});

export type PrintableModule = z.infer<typeof printableModuleSchema>;

export const publicationHistoryItemSchema = moduleActivityItemSchema;

export type PublicationHistoryItem = z.infer<typeof publicationHistoryItemSchema>;
