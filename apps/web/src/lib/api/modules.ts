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
  editorModuleDetailSchema,
  editorModuleListItemSchema,
  type EditorModuleListQuery,
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
