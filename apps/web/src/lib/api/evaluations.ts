import { queryOptions } from '@tanstack/react-query';
import {
  type AcceptReviewInput,
  type ApproveModuleInput,
  type AttemptReasonInput,
  attemptSessionSchema,
  type AvailableEvaluationQuery,
  availableEvaluationSchema,
  correctionDetailSchema,
  correctionListItemSchema,
  type CorrectionListQuery,
  type CreateEvaluationInput,
  type CreateQuestionInput,
  editorEvaluationDetailSchema,
  editorEvaluationListItemSchema,
  type EditorEvaluationListQuery,
  evaluationReviewSchema,
  evaluationSubmissionListSchema,
  type EvaluationSubmissionQuery,
  type GrantWaiverInput,
  moduleOptionListSchema,
  type MotivatedDecisionInput,
  myAttemptSchema,
  type MyAttemptQuery,
  paginatedSchema,
  type PaperDocument,
  type PreparePaperAttemptInput,
  type SaveAnswersInput,
  type SaveCorrectionInput,
  type SubmitEvaluationInput,
  type UpdateEvaluationInput,
  type UpdateQuestionInput,
  type WaiverListQuery,
  waiverSchema,
} from '@tesla/shared';
import { z } from 'zod';
import { env } from '@/lib/env';
import { apiFetch, apiSend, toQueryString } from './client';

const noContent = z.null();
const idResponse = z.object({ id: z.uuid() });

// ─── Rédaction (chefs, responsable) ────────────────────────────────────────

export const editorEvaluationsQueryOptions = (query: EditorEvaluationListQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'editor', 'list', query],
    queryFn: () =>
      apiFetch(
        `/editor/evaluations${toQueryString({ ...query })}`,
        paginatedSchema(editorEvaluationListItemSchema),
      ),
  });

export const editorEvaluationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['evaluations', 'editor', 'detail', id],
    queryFn: () => apiFetch(`/editor/evaluations/${id}`, editorEvaluationDetailSchema),
  });

export const moduleOptionsQueryOptions = queryOptions({
  queryKey: ['evaluations', 'editor', 'module-options'],
  queryFn: () => apiFetch('/editor/evaluations/module-options', moduleOptionListSchema),
  staleTime: 60_000,
});

export const createEvaluation = (input: CreateEvaluationInput) =>
  apiSend('POST', '/editor/evaluations', editorEvaluationDetailSchema, input);

export const updateEvaluation = (id: string, input: UpdateEvaluationInput) =>
  apiSend('PATCH', `/editor/evaluations/${id}`, editorEvaluationDetailSchema, input);

export const addQuestion = (id: string, input: CreateQuestionInput) =>
  apiSend('POST', `/editor/evaluations/${id}/questions`, editorEvaluationDetailSchema, input);

export const updateQuestion = (id: string, questionId: string, input: UpdateQuestionInput) =>
  apiSend(
    'PATCH',
    `/editor/evaluations/${id}/questions/${questionId}`,
    editorEvaluationDetailSchema,
    input,
  );

export const deleteQuestion = (id: string, questionId: string, revision: number) =>
  apiSend(
    'DELETE',
    `/editor/evaluations/${id}/questions/${questionId}?revision=${revision}`,
    editorEvaluationDetailSchema,
  );

export const reorderQuestions = (id: string, versionId: string, questionIds: string[]) =>
  apiSend('POST', `/editor/evaluations/${id}/questions/reorder`, editorEvaluationDetailSchema, {
    versionId,
    questionIds,
  });

export const submitEvaluation = (id: string, input: SubmitEvaluationInput) =>
  apiSend('POST', `/editor/evaluations/${id}/submit`, editorEvaluationDetailSchema, input);

export const resumeEvaluation = (id: string, versionId: string) =>
  apiSend('POST', `/editor/evaluations/${id}/resume`, editorEvaluationDetailSchema, { versionId });

export const createEvaluationVersion = (id: string) =>
  apiSend('POST', `/editor/evaluations/${id}/versions`, editorEvaluationDetailSchema);

// ─── Approbation (responsable) ─────────────────────────────────────────────

export const evaluationSubmissionsQueryOptions = (query: EvaluationSubmissionQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'review', 'submissions', query],
    queryFn: () =>
      apiFetch(
        `/admin/evaluations/submissions${toQueryString({ ...query })}`,
        evaluationSubmissionListSchema,
      ),
  });

export const evaluationReviewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['evaluations', 'review', 'detail', id],
    queryFn: () => apiFetch(`/admin/evaluations/${id}/review`, evaluationReviewSchema),
  });

export const approveEvaluation = (id: string, input: ApproveModuleInput) =>
  apiSend('POST', `/admin/evaluations/${id}/approve`, noContent, input);

export const requestEvaluationChanges = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/evaluations/${id}/request-changes`, noContent, input);

export const rejectEvaluation = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/evaluations/${id}/reject`, noContent, input);

export const publishEvaluation = (id: string, versionId: string) =>
  apiSend('POST', `/admin/evaluations/${id}/publish`, noContent, { versionId });

export const archiveEvaluation = (id: string, input: MotivatedDecisionInput) =>
  apiSend('POST', `/admin/evaluations/${id}/archive`, noContent, input);

// ─── Évaluations publiées et passation (routiers) ──────────────────────────

export const availableEvaluationsQueryOptions = (query: AvailableEvaluationQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'available', query],
    queryFn: () =>
      apiFetch(
        `/evaluations${toQueryString({ ...query })}`,
        paginatedSchema(availableEvaluationSchema),
      ),
  });

export const availableEvaluationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['evaluations', 'available', 'detail', id],
    queryFn: () => apiFetch(`/evaluations/${id}`, availableEvaluationSchema),
  });

export const myAttemptsQueryOptions = (query: MyAttemptQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'me', query],
    queryFn: () =>
      apiFetch(`/me/attempts${toQueryString({ ...query })}`, paginatedSchema(myAttemptSchema)),
  });

export const startAttempt = (evaluationId: string) =>
  apiSend('POST', `/evaluations/${evaluationId}/attempts`, attemptSessionSchema);

export const saveAnswers = (attemptId: string, input: SaveAnswersInput) =>
  apiSend('POST', `/attempts/${attemptId}/answers`, attemptSessionSchema, input);

export const submitAttempt = (attemptId: string, input: SaveAnswersInput) =>
  apiSend('POST', `/attempts/${attemptId}/submit`, attemptSessionSchema, input);

// ─── Papier, corrections, examen ───────────────────────────────────────────

export const correctionsQueryOptions = (query: CorrectionListQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'corrections', query],
    queryFn: () =>
      apiFetch(
        `/corrections${toQueryString({ ...query })}`,
        paginatedSchema(correctionListItemSchema),
      ),
  });

export const correctionQueryOptions = (code: string) =>
  queryOptions({
    queryKey: ['evaluations', 'corrections', 'detail', code],
    queryFn: () => apiFetch(`/corrections/${encodeURIComponent(code)}`, correctionDetailSchema),
  });

export const pendingReviewQueryOptions = (query: CorrectionListQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'pending-review', query],
    queryFn: () =>
      apiFetch(
        `/admin/attempts/pending-review${toQueryString({ ...query })}`,
        paginatedSchema(correctionListItemSchema),
      ),
  });

export const reviewAttemptQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['evaluations', 'pending-review', 'detail', id],
    queryFn: () => apiFetch(`/admin/attempts/${id}`, correctionDetailSchema),
  });

export const preparePaperAttempt = (input: PreparePaperAttemptInput) =>
  apiSend('POST', '/paper-attempts', correctionDetailSchema, input);

/** URL du PDF (session par cookie) : ouverture dans un nouvel onglet, sans nouvelle tentative. */
export const paperPdfUrl = (code: string, document: PaperDocument) =>
  `${env.NEXT_PUBLIC_API_URL}/paper-attempts/${encodeURIComponent(code)}/pdf?document=${document}`;

export const saveCorrection = (code: string, input: SaveCorrectionInput) =>
  apiSend(
    'POST',
    `/corrections/${encodeURIComponent(code)}/answers`,
    correctionDetailSchema,
    input,
  );

export const submitCorrection = (code: string, correctionRevision: number) =>
  apiSend(
    'POST',
    `/corrections/${encodeURIComponent(code)}/submit-review`,
    correctionDetailSchema,
    {
      correctionRevision,
    },
  );

export const cancelAttempt = (code: string, input: AttemptReasonInput) =>
  apiSend('POST', `/corrections/${encodeURIComponent(code)}/cancel`, correctionDetailSchema, input);

export const acceptReview = (id: string, input: AcceptReviewInput) =>
  apiSend('POST', `/admin/attempts/${id}/accept-review`, correctionDetailSchema, input);

export const requestCorrection = (id: string, input: AttemptReasonInput) =>
  apiSend('POST', `/admin/attempts/${id}/request-correction`, correctionDetailSchema, input);

// ─── Dérogations (responsable) ─────────────────────────────────────────────

export const waiversQueryOptions = (query: WaiverListQuery) =>
  queryOptions({
    queryKey: ['evaluations', 'waivers', query],
    queryFn: () =>
      apiFetch(`/admin/waivers${toQueryString({ ...query })}`, paginatedSchema(waiverSchema)),
  });

export const grantWaiver = (input: GrantWaiverInput) =>
  apiSend('POST', '/admin/waivers', idResponse, input);

export const revokeWaiver = (id: string, input: AttemptReasonInput) =>
  apiSend('POST', `/admin/waivers/${id}/revoke`, idResponse, input);
