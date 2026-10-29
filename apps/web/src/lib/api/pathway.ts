import { queryOptions } from '@tanstack/react-query';
import {
  ageRuleSetListSchema,
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

export const decideCatchUp = (obligationId: string, input: DecideCatchUpInput) =>
  apiSend('POST', `/catch-ups/${obligationId}/decision`, catchUpObligationSchema, input);
