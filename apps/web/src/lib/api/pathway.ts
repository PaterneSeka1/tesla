import { queryOptions } from '@tanstack/react-query';
import {
  type ActivateAgeRuleSetInput,
  ageRuleSetListSchema,
  ageRuleSetSchema,
  type CreateAgeRuleSetInput,
  catchUpObligationSchema,
  type DecideCatchUpInput,
  pathwayOverviewSchema,
  scoutPathwaySchema,
} from '@tesla/shared';
import { apiFetch, apiSend, toQueryString } from './client';

// Parcours : étape théorique selon l'âge, rattrapages, appartenance à la branche.

export const myPathwayQueryOptions = queryOptions({
  queryKey: ['pathway', 'me'],
  queryFn: () => apiFetch('/me/pathway', scoutPathwaySchema),
});

export const scoutPathwayQueryOptions = (scoutId: string) =>
  queryOptions({
    queryKey: ['pathway', 'scout', scoutId],
    queryFn: () => apiFetch(`/scouts/${scoutId}/pathway`, scoutPathwaySchema),
  });

export const pathwayOverviewQueryOptions = (teamId?: string) =>
  queryOptions({
    queryKey: ['pathway', 'overview', teamId ?? null],
    queryFn: () =>
      apiFetch(`/statistics/pathways${toQueryString({ teamId })}`, pathwayOverviewSchema),
  });

export const ageRuleSetsQueryOptions = queryOptions({
  queryKey: ['pathway', 'age-rules'],
  queryFn: () => apiFetch('/age-rules', ageRuleSetListSchema),
});

/** Référentiel d'âge (décision du plein, D173) : brouillon, puis mise en vigueur explicite. */
export const createAgeRuleSet = (input: CreateAgeRuleSetInput) =>
  apiSend('POST', '/age-rules', ageRuleSetSchema, input);

export const activateAgeRuleSet = (id: string, input: ActivateAgeRuleSetInput) =>
  apiSend('POST', `/age-rules/${id}/activate`, ageRuleSetSchema, input);

export const decideCatchUp = (obligationId: string, input: DecideCatchUpInput) =>
  apiSend('POST', `/catch-ups/${obligationId}/decision`, catchUpObligationSchema, input);
