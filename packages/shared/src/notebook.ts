import { z } from 'zod';

/**
 * Carnet personnel (D209) : favoris (module ou leçon) et notes personnelles sur une leçon.
 * Privés : seul le titulaire y accède (aucune route par identifiant, aucune permission de
 * l'encadrement). Les leçons sont suivies par leur identité stable : un renommage ou une nouvelle
 * version ne perd rien ; un contenu retiré reste listé comme « indisponible ».
 */
export const NOTE_MAX_LENGTH = 4000;

export const bookmarkInputSchema = z.object({
  moduleSlug: z.string().min(1).max(120),
  /** Leçon de la version publiée affichée ; absente : le module entier. */
  lessonId: z.uuid().optional(),
  on: z.boolean(),
});
export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;

export const noteInputSchema = z.object({
  moduleSlug: z.string().min(1).max(120),
  lessonId: z.uuid(),
  /** Texte vide : la note est supprimée. */
  body: z.string().max(NOTE_MAX_LENGTH),
  /** Révision connue de l'appareil (0 : pas encore de note) ; différente : conflit 409. */
  revision: z.number().int().min(0),
});
export type NoteInput = z.infer<typeof noteInputSchema>;

const target = z.object({
  /** Identifiant de l'élément du carnet (suppression, même si le contenu a été retiré). */
  id: z.uuid(),
  moduleSlug: z.string(),
  moduleTitle: z.string(),
  /** Leçon dans la version publiée actuelle (null : module, ou leçon retirée). */
  lessonId: z.uuid().nullable(),
  lessonTitle: z.string().nullable(),
  /** Faux si le module ou la leçon n'est plus publié. */
  available: z.boolean(),
});

export const noteSchema = target.extend({
  body: z.string(),
  revision: z.number().int(),
  updatedAt: z.iso.datetime(),
});
export type Note = z.infer<typeof noteSchema>;

export const notebookSchema = z.object({
  bookmarks: z.array(target.extend({ kind: z.enum(['module', 'lesson']) })),
  notes: z.array(noteSchema),
});
export type Notebook = z.infer<typeof notebookSchema>;

/** Réponse à l'enregistrement d'une note : la note, ou `null` si elle a été supprimée. */
export const noteSaveResultSchema = z.object({
  note: noteSchema.nullable(),
  revision: z.number().int(),
});
export type NoteSaveResult = z.infer<typeof noteSaveResultSchema>;
