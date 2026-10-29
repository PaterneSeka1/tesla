import { queryOptions } from '@tanstack/react-query';
import {
  type CreateDelegationInput,
  type CreateScoutYearInput,
  delegationSchema,
  type EndMandateInput,
  leadershipOverviewSchema,
  mandateHistorySchema,
  mandateSchema,
  reconductionDraftSchema,
  type RecordMandateInput,
  type RevokeDelegationInput,
  scoutYearSchema,
} from '@tesla/shared';
import { apiFetch, apiSend, toQueryString } from './client';

// Encadrement : années scoutes, mandats annuels, délégations.

export const leadershipOverviewQueryOptions = queryOptions({
  queryKey: ['leadership', 'overview'],
  queryFn: () => apiFetch('/leadership', leadershipOverviewSchema),
});

export const mandateHistoryQueryOptions = (scoutYearId?: string) =>
  queryOptions({
    queryKey: ['leadership', 'mandates', scoutYearId ?? null],
    queryFn: () => apiFetch(`/mandates${toQueryString({ scoutYearId })}`, mandateHistorySchema),
  });

export const reconductionDraftQueryOptions = (mandateId: string) =>
  queryOptions({
    queryKey: ['leadership', 'reconduction', mandateId],
    queryFn: () => apiFetch(`/mandates/${mandateId}/reconduction`, reconductionDraftSchema),
  });

export const recordMandate = (input: RecordMandateInput) =>
  apiSend('POST', '/mandates', mandateSchema, input);

export const endMandate = (mandateId: string, input: EndMandateInput) =>
  apiSend('POST', `/mandates/${mandateId}/end`, mandateSchema, input);

export const createScoutYear = (input: CreateScoutYearInput) =>
  apiSend('POST', '/scout-years', scoutYearSchema, input);

export const createDelegation = (input: CreateDelegationInput) =>
  apiSend('POST', '/delegations', delegationSchema, input);

export const revokeDelegation = (delegationId: string, input: RevokeDelegationInput) =>
  apiSend('POST', `/delegations/${delegationId}/revoke`, delegationSchema, input);
