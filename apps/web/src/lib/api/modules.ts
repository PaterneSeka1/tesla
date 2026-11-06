import { queryOptions } from '@tanstack/react-query';
import {
  type AddCollaboratorInput,
  type ApproveModuleInput,
  catalogLessonSchema,
  catalogModuleDetailSchema,
  catalogPageSchema,
  type CatalogQuery,
  chefCandidateListSchema,
  type CreateLessonInput,
  type CreateModuleInput,
  type CreateResourceInput,
  type DeleteDraftInput,
  deleteDraftResultSchema,
  draftDeletionCheckSchema,
  editorModuleDetailSchema,
  editorModuleListItemSchema,
  type EditorModuleListQuery,
  editorModuleStatsSchema,
  moduleActivityListSchema,
  moduleReviewSchema,
  moduleVersionDetailSchema,
  type MotivatedDecisionInput,
  paginatedSchema,
  printableModuleSchema,
  publicationHistoryItemSchema,
  type ReorderLessonsInput,
  type SetTextLinksInput,
  submissionListSchema,
  type SubmissionListQuery,
  type SubmitModuleInput,
  textCandidateListSchema,
  type UpdateLessonInput,
  type UpdateModuleVersionInput,
} from '@tesla/shared';
import { z } from 'zod';
import { env } from '@/lib/env';
import { apiFetch, apiSend, toQueryString } from './client';

const noContent = z.null();
const editorPageSchema = paginatedSchema(editorModuleListItemSchema);
const historyPageSchema = paginatedSchema(publicationHistoryItemSchema);

// ─── Bibliothèque ───────────────────────────────────────────────────────────

export const catalogQueryOptions = (query: CatalogQuery) =>
  queryOptions({
    queryKey: ['modules', 'catalog', query],
    queryFn: () => apiFetch(`/modules${toQueryString({ ...query })}`, catalogPageSchema),
  });

export const catalogModuleQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['modules', 'catalog', 'detail', slug],
    queryFn: () => apiFetch(`/modules/${encodeURIComponent(slug)}`, catalogModuleDetailSchema),
  });

export const catalogLessonQueryOptions = (slug: string, lessonId: string) =>
  queryOptions({
    queryKey: ['modules', 'catalog', 'lesson', slug, lessonId],
    queryFn: () =>
      apiFetch(`/modules/${encodeURIComponent(slug)}/lessons/${lessonId}`, catalogLessonSchema),
  });

/** URL du support de cours PDF (session par cookie) : téléchargement direct. */
export const modulePdfUrl = (slug: string) =>
  `${env.NEXT_PUBLIC_API_URL}/modules/${encodeURIComponent(slug)}/pdf`;

export const practicalSheetPdfUrl = (slug: string, key: string) =>
  `${env.NEXT_PUBLIC_API_URL}/modules/${encodeURIComponent(slug)}/sheets/${encodeURIComponent(key)}/pdf`;

export const printableModuleQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['modules', 'catalog', 'print', slug],
    queryFn: () => apiFetch(`/modules/${encodeURIComponent(slug)}/print`, printableModuleSchema),
  });

// ─── Rédaction ─────────────────────────────────────────────────────────────

export const editorModulesQueryOptions = (query: EditorModuleListQuery) =>
  queryOptions({
    queryKey: ['modules', 'editor', 'list', query],
    queryFn: () => apiFetch(`/editor/modules${toQueryString({ ...query })}`, editorPageSchema),
  });

/**
 * Tous les modules visibles par l'éditeur (pages successives de 100, le maximum de l'API) : pour
 * les suivis qui filtrent côté client (soumissions), sans troncature au-delà de la première page.
 */
export const allEditorModulesQueryOptions = queryOptions({
  queryKey: ['modules', 'editor', 'list', 'all-pages'],
  queryFn: async () => {
    const items: z.infer<typeof editorPageSchema>['items'] = [];
    for (let page = 1; ; page += 1) {
      const result = await apiFetch(
        `/editor/modules${toQueryString({ status: 'all', page, pageSize: 100 })}`,
        editorPageSchema,
      );
      items.push(...result.items);
      if (result.items.length === 0 || items.length >= result.total) return items;
    }
  },
});

export const editorModuleStatsQueryOptions = queryOptions({
  queryKey: ['modules', 'editor', 'stats'],
  queryFn: () => apiFetch('/editor/module-stats', editorModuleStatsSchema),
});

/** Diagnostic avant suppression d'un brouillon (relu à chaque ouverture de la confirmation). */
export const draftDeletionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['modules', 'editor', 'draft-deletion', id],
    queryFn: () => apiFetch(`/editor/modules/${id}/draft-deletion`, draftDeletionCheckSchema),
    staleTime: 0,
  });

/** Suppression d'un seul brouillon désigné ; jamais différée hors ligne (décision irréversible). */
export const deleteDraft = (id: string, input: DeleteDraftInput) =>
  apiSend('POST', `/editor/modules/${id}/draft-deletion`, deleteDraftResultSchema, input);

export const editorModuleQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['modules', 'editor', 'detail', id],
    queryFn: () => apiFetch(`/editor/modules/${id}`, editorModuleDetailSchema),
  });

export const moduleVersionQueryOptions = (id: string, versionId: string) =>
  queryOptions({
    queryKey: ['modules', 'editor', 'version', id, versionId],
    queryFn: () =>
      apiFetch(`/editor/modules/${id}/versions/${versionId}`, moduleVersionDetailSchema),
  });

export const editorActivityQueryOptions = queryOptions({
  queryKey: ['modules', 'editor', 'activity'],
  queryFn: () => apiFetch('/editor/activity', moduleActivityListSchema),
});

export const chefCandidatesQueryOptions = queryOptions({
  queryKey: ['modules', 'editor', 'chefs'],
  queryFn: () => apiFetch('/editor/chefs', chefCandidateListSchema),
});

export const textCandidatesQueryOptions = queryOptions({
  queryKey: ['modules', 'editor', 'texts'],
  queryFn: () => apiFetch('/editor/texts', textCandidateListSchema),
});

export const createModule = (input: CreateModuleInput) =>
  apiSend('POST', '/editor/modules', editorModuleDetailSchema, input);

export const updateModuleVersion = (id: string, input: UpdateModuleVersionInput) =>
  apiSend('PATCH', `/editor/modules/${id}`, editorModuleDetailSchema, input);

export const createModuleVersion = (id: string) =>
  apiSend('POST', `/editor/modules/${id}/versions`, editorModuleDetailSchema);

export const resumeModule = (id: string, versionId: string) =>
  apiSend('POST', `/editor/modules/${id}/resume`, editorModuleDetailSchema, { versionId });

export const submitModule = (id: string, input: SubmitModuleInput) =>
  apiSend('POST', `/editor/modules/${id}/submit`, editorModuleDetailSchema, input);

export const addLesson = (id: string, input: CreateLessonInput) =>
  apiSend('POST', `/editor/modules/${id}/lessons`, editorModuleDetailSchema, input);

export const reorderLessons = (id: string, input: ReorderLessonsInput) =>
  apiSend('POST', `/editor/modules/${id}/lessons/reorder`, editorModuleDetailSchema, input);

export const updateLesson = (lessonId: string, input: UpdateLessonInput) =>
  apiSend('PATCH', `/editor/lessons/${lessonId}`, noContent, input);

export const deleteLesson = (lessonId: string, revision: number) =>
  apiSend('DELETE', `/editor/lessons/${lessonId}?revision=${revision}`, noContent);

export const addResource = (id: string, input: CreateResourceInput) =>
  apiSend('POST', `/editor/modules/${id}/resources`, editorModuleDetailSchema, input);

export const deleteResource = (resourceId: string) =>
  apiSend('DELETE', `/editor/resources/${resourceId}`, noContent);

export const setTextLinks = (id: string, input: SetTextLinksInput) =>
  apiSend('PUT', `/editor/modules/${id}/texts`, editorModuleDetailSchema, input);

export const duplicateModule = (id: string) =>
  apiSend('POST', `/editor/modules/${id}/duplicate`, editorModuleDetailSchema);

export const addCollaborator = (id: string, input: AddCollaboratorInput) =>
  apiSend('POST', `/editor/modules/${id}/collaborators`, editorModuleDetailSchema, input);

export const removeCollaborator = (id: string, userId: string) =>
  apiSend('DELETE', `/editor/modules/${id}/collaborators/${userId}`, noContent);

// ─── Approbation (responsable) ─────────────────────────────────────────────

export const submissionsQueryOptions = (query: SubmissionListQuery) =>
  queryOptions({
    queryKey: ['modules', 'review', 'submissions', query],
    queryFn: () =>
      apiFetch(`/admin/modules/submissions${toQueryString({ ...query })}`, submissionListSchema),
  });

export const moduleReviewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['modules', 'review', 'detail', id],
    queryFn: () => apiFetch(`/admin/modules/${id}/review`, moduleReviewSchema),
  });

export const publicationHistoryQueryOptions = (page: number) =>
  queryOptions({
    queryKey: ['modules', 'review', 'history', page],
    queryFn: () => apiFetch(`/admin/modules/history${toQueryString({ page })}`, historyPageSchema),
  });

export const approveModule = (id: string, input: ApproveModuleInput) =>
  apiSend('POST', `/admin/modules/${id}/approve`, noContent, input);

export const requestModuleChanges = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/modules/${id}/request-changes`, noContent, input);

export const rejectModule = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/modules/${id}/reject`, noContent, input);

export const publishModule = (id: string, versionId: string) =>
  apiSend('POST', `/admin/modules/${id}/publish`, noContent, { versionId });

export const purgeEmptyModule = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/modules/${id}/purge`, noContent, input);

export const archiveModule = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/modules/${id}/archive`, noContent, input);
