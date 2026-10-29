import { z } from 'zod';

/**
 * Contenu structuré d'une leçon : document au format ProseMirror/Tiptap (JSON), jamais du HTML.
 * Le schéma est une liste blanche : tout nœud, marque ou attribut non prévu est refusé ou retiré
 * (les objets Zod ignorent les clés inconnues). Le rendu web construit des éléments React à partir
 * de ces nœuds, sans `dangerouslySetInnerHTML`.
 */

/** Liens autorisés : http, https, mailto (jamais `javascript:`, `data:`…). */
export function isSafeLinkHref(href: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/** Images : URL https externe uniquement (aucun fichier stocké sur le serveur). */
export function isSafeImageSrc(src: string): boolean {
  try {
    return new URL(src).protocol === 'https:';
  } catch {
    return false;
  }
}

export type LessonMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'link'; attrs: { href: string } };

export type LessonInline =
  { type: 'text'; text: string; marks?: LessonMark[] } | { type: 'hardBreak' };

export interface LessonListItem {
  type: 'listItem';
  content: LessonBlock[];
}

export type LessonBlock =
  | { type: 'paragraph'; content?: LessonInline[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: LessonInline[] }
  | { type: 'bulletList'; content: LessonListItem[] }
  | { type: 'orderedList'; attrs?: { start?: number }; content: LessonListItem[] }
  | { type: 'blockquote'; content: LessonBlock[] }
  | { type: 'horizontalRule' }
  | { type: 'image'; attrs: { src: string; alt?: string | null } };

export interface LessonDocument {
  type: 'doc';
  content: LessonBlock[];
}

const MAX_DEPTH = 8;
/** Taille maximale du document sérialisé (caractères). */
export const LESSON_CONTENT_MAX_LENGTH = 200_000;

const markSchema: z.ZodType<LessonMark> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({
      href: z.string().max(2000).refine(isSafeLinkHref, { message: 'Lien non autorisé.' }),
    }),
  }),
]);

const inlineSchema: z.ZodType<LessonInline> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string().min(1).max(20_000),
    marks: z.array(markSchema).max(5).optional(),
  }),
  z.object({ type: z.literal('hardBreak') }),
]);

const listItemSchema: z.ZodType<LessonListItem> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockSchema).min(1).max(50) }),
);

const blockSchema: z.ZodType<LessonBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), content: z.array(inlineSchema).max(500).optional() }),
    z.object({
      type: z.literal('heading'),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: z.array(inlineSchema).max(100).optional(),
    }),
    z.object({ type: z.literal('bulletList'), content: z.array(listItemSchema).min(1).max(200) }),
    z.object({
      type: z.literal('orderedList'),
      attrs: z.object({ start: z.number().int().min(0).max(10_000).optional() }).optional(),
      content: z.array(listItemSchema).min(1).max(200),
    }),
    z.object({ type: z.literal('blockquote'), content: z.array(blockSchema).min(1).max(50) }),
    z.object({ type: z.literal('horizontalRule') }),
    z.object({
      type: z.literal('image'),
      attrs: z.object({
        src: z.string().max(2000).refine(isSafeImageSrc, {
          message: 'Image non autorisée : adresse https:// requise.',
        }),
        alt: z.string().max(300).nullable().optional(),
      }),
    }),
  ]),
);

function depth(node: unknown): number {
  if (!node || typeof node !== 'object' || !('content' in node) || !Array.isArray(node.content)) {
    return 1;
  }
  return 1 + Math.max(0, ...node.content.map(depth));
}

export const lessonDocumentSchema: z.ZodType<LessonDocument> = z
  .object({ type: z.literal('doc'), content: z.array(blockSchema).max(2000) })
  .refine((doc) => depth(doc) <= MAX_DEPTH, { message: 'Contenu trop imbriqué.' })
  .refine((doc) => JSON.stringify(doc).length <= LESSON_CONTENT_MAX_LENGTH, {
    message: 'Contenu trop long.',
  });

export function emptyLessonDocument(): LessonDocument {
  return { type: 'doc', content: [] };
}

/** Vrai si la leçon ne contient ni texte ni image (soumission refusée dans ce cas). */
export function isLessonDocumentEmpty(doc: LessonDocument): boolean {
  const hasContent = (node: LessonBlock | LessonListItem | LessonInline): boolean => {
    if (node.type === 'image') return true;
    if (node.type === 'text') return node.text.trim() !== '';
    return 'content' in node && Array.isArray(node.content) && node.content.some(hasContent);
  };
  return !doc.content.some(hasContent);
}
