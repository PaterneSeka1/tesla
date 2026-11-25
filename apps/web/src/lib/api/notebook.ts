import { queryOptions } from '@tanstack/react-query';
import {
  type BookmarkInput,
  notebookSchema,
  type NoteInput,
  noteSaveResultSchema,
} from '@tesla/shared';
import { apiFetch, apiSend } from './client';

// Carnet personnel (D209) : favoris et notes, privés. Copie chiffrée sur l'appareil comme toute
// lecture ; écritures différables hors ligne (file de l'appareil), recontrôlées par le serveur.

export const notebookQueryOptions = queryOptions({
  queryKey: ['me', 'notebook'],
  queryFn: () => apiFetch('/me/notebook', notebookSchema),
});

export const setBookmark = (input: BookmarkInput) =>
  apiSend('PUT', '/me/bookmarks', notebookSchema, input, {
    type: 'bookmark.set',
    label: 'Favori',
    entity: { kind: 'bookmark', id: `${input.moduleSlug}:${input.lessonId ?? ''}` },
  });

export const saveNote = (input: NoteInput) =>
  apiSend('PUT', '/me/notes', noteSaveResultSchema, input, {
    type: 'note.save',
    label: 'Note personnelle',
    entity: { kind: 'note', id: `${input.moduleSlug}:${input.lessonId}` },
  });

export const removeNotebookItem = (kind: 'bookmarks' | 'notes', id: string) =>
  apiSend('DELETE', `/me/${kind}/${id}`, notebookSchema);
