import { z } from 'zod';
import { type LessonBlock, type LessonDocument, type LessonInline } from './lesson-content.js';

/**
 * Référentiel scout (D220) : cérémonies, prières, chants, récits et textes de référence.
 * Une ressource du référentiel **est un module** publié (texte fondamental, D125) : contenu, versions,
 * circuit d'approbation, impression et hors ligne sont ceux des modules. Le référentiel se contente
 * de **ranger** des modules (ou une leçon précise d'un module) dans des rubriques dynamiques.
 * Une rubrique n'apparaît aux apprenants que si elle contient au moins une ressource publiée.
 */

/**
 * Ambiance de présentation d'une rubrique (interne : jamais affichée aux apprenants). Elle règle la
 * sobriété du lecteur ; les outils proposés (Mon rôle, lecteur audio) découlent du contenu réel.
 */
export const REFERENCE_AMBIANCES = [
  'SOLENNEL',
  'RECUEILLI',
  'MUSICAL',
  'NARRATIF',
  'DOCUMENTAIRE',
] as const;
export type ReferenceAmbiance = (typeof REFERENCE_AMBIANCES)[number];

/** Libellés de l'administration seulement. */
export const REFERENCE_AMBIANCE_LABELS: Record<ReferenceAmbiance, string> = {
  SOLENNEL: 'Cérémonie (sobre et solennel)',
  RECUEILLI: 'Prière (calme et recueilli)',
  MUSICAL: 'Chant (lecteur audio)',
  NARRATIF: 'Récit ou légende',
  DOCUMENTAIRE: 'Texte de référence',
};

/** Icônes proposées pour une rubrique (noms internes, rendus par le web). */
export const REFERENCE_ICONS = [
  'flamme',
  'livre',
  'musique',
  'parchemin',
  'etoile',
  'bouclier',
  'boussole',
  'tente',
  'coeur',
] as const;
export type ReferenceIcon = (typeof REFERENCE_ICONS)[number];

const title = z
  .string()
  .trim()
  .min(2, { error: 'Titre trop court.' })
  .max(80, { error: 'Titre trop long (80 caractères au plus).' });
const description = z
  .string()
  .trim()
  .max(300, { error: 'Description trop longue (300 caractères au plus).' });

export const createReferenceCategoryInputSchema = z.object({
  title,
  description: description.optional(),
  icon: z.enum(REFERENCE_ICONS).nullable().optional(),
  ambiance: z.enum(REFERENCE_AMBIANCES),
});
export type CreateReferenceCategoryInput = z.input<typeof createReferenceCategoryInputSchema>;

export const updateReferenceCategoryInputSchema = z
  .object({
    title: title.optional(),
    description: description.nullable().optional(),
    icon: z.enum(REFERENCE_ICONS).nullable().optional(),
    ambiance: z.enum(REFERENCE_AMBIANCES).optional(),
    /** Vrai : rubrique retirée (masquée partout, ressources conservées) ; faux : rétablie. */
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });
export type UpdateReferenceCategoryInput = z.input<typeof updateReferenceCategoryInputSchema>;

/** Nouvel ordre (identifiants dans l'ordre voulu, tous présents). */
export const reorderReferenceInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});
export type ReorderReferenceInput = z.input<typeof reorderReferenceInputSchema>;

/** Ranger un module (ou une seule de ses leçons) dans une rubrique. */
export const addReferenceEntryInputSchema = z.object({
  categoryId: z.uuid(),
  moduleId: z.uuid(),
  /** Leçon d'une version quelconque du module : le rangement suit son identité stable. */
  lessonId: z.uuid().nullable().optional(),
});
export type AddReferenceEntryInput = z.input<typeof addReferenceEntryInputSchema>;

/** Ressource visible : module publié, ou leçon publiée d'un module. */
export const referenceEntrySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  summary: z.string(),
  moduleSlug: z.string(),
  /** Leçon publiée désignée (null = module entier). */
  lessonId: z.uuid().nullable(),
  /** Parties (leçons) consultables séparément. */
  parts: z.array(z.object({ id: z.uuid(), title: z.string() })),
  hasAudio: z.boolean(),
  /** Contient des répliques (cérémonie) : mode « Mon rôle » et mode cérémonie proposés. */
  hasDialogue: z.boolean(),
  /** Extrait correspondant à la recherche (absent hors recherche). */
  match: z.string().nullable().default(null),
});
export type ReferenceEntry = z.infer<typeof referenceEntrySchema>;

export const referenceCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.enum(REFERENCE_ICONS).nullable(),
  ambiance: z.enum(REFERENCE_AMBIANCES),
  entries: z.array(referenceEntrySchema),
});
export type ReferenceCategory = z.infer<typeof referenceCategorySchema>;

/** Référentiel visible : rubriques non vides seulement, ressources publiées seulement. */
export const referenceCatalogSchema = z.object({
  categories: z.array(referenceCategorySchema),
});
export type ReferenceCatalog = z.infer<typeof referenceCatalogSchema>;

/** État de publication d'une ressource rangée (gestion seulement). */
export const REFERENCE_ENTRY_STATES = ['PUBLIEE', 'NON_PUBLIEE', 'LECON_ABSENTE'] as const;
export type ReferenceEntryState = (typeof REFERENCE_ENTRY_STATES)[number];

export const managedReferenceEntrySchema = z.object({
  id: z.uuid(),
  moduleId: z.uuid(),
  moduleSlug: z.string(),
  title: z.string(),
  lessonTitle: z.string().nullable(),
  state: z.enum(REFERENCE_ENTRY_STATES),
  /** La personne peut retirer ce rangement (rédactrice du module ou responsable). */
  canRemove: z.boolean(),
});
export type ManagedReferenceEntry = z.infer<typeof managedReferenceEntrySchema>;

export const managedReferenceCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.enum(REFERENCE_ICONS).nullable(),
  ambiance: z.enum(REFERENCE_AMBIANCES),
  archived: z.boolean(),
  /** Visible des apprenants (au moins une ressource publiée, rubrique non retirée). */
  visible: z.boolean(),
  entries: z.array(managedReferenceEntrySchema),
});
export type ManagedReferenceCategory = z.infer<typeof managedReferenceCategorySchema>;

export const managedReferenceSchema = z.object({
  categories: z.array(managedReferenceCategorySchema),
  /** Créer, renommer, ordonner ou retirer des rubriques (responsable plein en fonction). */
  canManageCategories: z.boolean(),
});
export type ManagedReference = z.infer<typeof managedReferenceSchema>;

/** Identifiant d'URL d'une rubrique (« Chants de veillée » → « chants-de-veillee »). */
export function referenceSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'rubrique'
  );
}

/** Texte normalisé pour la recherche (casse, accents, apostrophes et espaces ignorés). */
export function searchableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function inlineText(inline: LessonInline): string {
  return inline.type === 'text' ? inline.text : ' ';
}

/** Texte brut d'un bloc (paroles d'un enregistrement comprises), pour la recherche. */
export function blockPlainText(block: LessonBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return (block.content ?? []).map(inlineText).join('');
    case 'bulletList':
    case 'orderedList':
      return block.content.map((item) => item.content.map(blockPlainText).join(' ')).join(' ');
    case 'blockquote':
      return block.content.map(blockPlainText).join(' ');
    case 'audio':
      return [block.attrs.title ?? '', ...block.attrs.segments.map((s) => s.text)].join(' ');
    case 'image':
      return block.attrs.alt ?? '';
    case 'horizontalRule':
    case 'practice':
      return '';
  }
}

export function documentPlainText(document: LessonDocument): string {
  return document.content.map(blockPlainText).join('\n');
}

/**
 * Extrait d'environ `radius` caractères autour de la première occurrence de `query` (comparaison
 * normalisée), ou null. Les positions sont calculées sur le texte normalisé, de même longueur que
 * le texte d'origine pour les caractères latins usuels.
 */
export function searchExcerpt(text: string, query: string, radius = 60): string | null {
  const needle = searchableText(query);
  if (needle.length < 2) return null;
  const flat = text.replace(/\s+/g, ' ');
  const haystack = flat
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, "'")
    .toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  const start = Math.max(0, index - radius);
  const end = Math.min(flat.length, index + needle.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}
