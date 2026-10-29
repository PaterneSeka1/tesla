import { queryOptions } from '@tanstack/react-query';
import {
  type AddEvidenceInput,
  type CancelModuleStudyInput,
  type ChangeStageInput,
  type CompetencyListQuery,
  competencySchema,
  competencyValidationSchema,
  type CreateCompetencyInput,
  type CreateProposalInput,
  moduleStudySchema,
  myProgressionSchema,
  paginatedSchema,
  type ProposalAuthorActionInput,
  type ProposalDecisionInput,
  type ProposalListQuery,
  proposalSchema,
  type RecordModuleStudyInput,
  scoutProgressionSchema,
  scoutTimelineSchema,
  stageChangeSchema,
  type UpdateCompetencyInput,
} from '@tesla/shared';
import { z } from 'zod';
import { apiFetch, apiSend, toQueryString } from './client';

const competencyPageSchema = paginatedSchema(competencySchema);
const proposalPageSchema = paginatedSchema(proposalSchema);
const moduleOptionsSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), code: z.string(), title: z.string() })),
});

export const scoutProgressionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['progression', 'scout', id],
    queryFn: () => apiFetch(`/scouts/${id}/progression`, scoutProgressionSchema),
  });

export const scoutTimelineQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['progression', 'scout', id, 'timeline'],
    queryFn: () => apiFetch(`/scouts/${id}/timeline`, scoutTimelineSchema),
  });

export const myProgressionQueryOptions = queryOptions({
  queryKey: ['progression', 'me'],
  queryFn: () => apiFetch('/me/progression', myProgressionSchema),
});

export const competenciesQueryOptions = (query: CompetencyListQuery) =>
  queryOptions({
    queryKey: ['progression', 'competencies', query],
    queryFn: () => apiFetch(`/competencies${toQueryString({ ...query })}`, competencyPageSchema),
  });

export const proposalsQueryOptions = (query: ProposalListQuery) =>
  queryOptions({
    queryKey: ['progression', 'proposals', query],
    queryFn: () =>
      apiFetch(`/competency-proposals${toQueryString({ ...query })}`, proposalPageSchema),
  });

export const proposalQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['progression', 'proposals', 'detail', id],
    queryFn: () => apiFetch(`/competency-proposals/${id}`, proposalSchema),
  });

/** Modules publiés (choix d'un module étudié ou associé). */
export const publishedModulesQueryOptions = queryOptions({
  queryKey: ['progression', 'published-modules'],
  queryFn: () => apiFetch('/progression/published-modules', moduleOptionsSchema),
  staleTime: 5 * 60_000,
});

export const changeStage = (scoutId: string, input: ChangeStageInput) =>
  apiSend('POST', `/scouts/${scoutId}/stage-changes`, stageChangeSchema, input);

export const recordModuleStudy = (scoutId: string, input: RecordModuleStudyInput) =>
  apiSend('POST', `/scouts/${scoutId}/module-studies`, moduleStudySchema, input);

export const declareModuleStudy = (moduleId: string) =>
  apiSend('POST', '/me/module-studies', moduleStudySchema, { moduleId });

export const cancelModuleStudy = (studyId: string, input: CancelModuleStudyInput) =>
  apiSend('POST', `/module-studies/${studyId}/cancel`, moduleStudySchema, input);

export const createCompetency = (input: CreateCompetencyInput) =>
  apiSend('POST', '/competencies', competencySchema, input);

export const updateCompetency = (id: string, input: UpdateCompetencyInput) =>
  apiSend('PATCH', `/competencies/${id}`, competencySchema, input);

export const createProposal = (input: CreateProposalInput) =>
  apiSend('POST', '/competency-proposals', proposalSchema, input);

export const addEvidence = (id: string, input: AddEvidenceInput) =>
  apiSend('POST', `/competency-proposals/${id}/evidences`, proposalSchema, input);

export const proposalAuthorAction = (
  id: string,
  action: 'resubmit' | 'withdraw',
  input: ProposalAuthorActionInput,
) => apiSend('POST', `/competency-proposals/${id}/${action}`, proposalSchema, input);

export const decideProposal = (
  id: string,
  action: 'approve' | 'reject' | 'request-complement',
  input: ProposalDecisionInput,
) => apiSend('POST', `/competency-proposals/${id}/${action}`, proposalSchema, input);

export const revokeValidation = (id: string, reason: string) =>
  apiSend('POST', `/competency-validations/${id}/revoke`, competencyValidationSchema, { reason });
