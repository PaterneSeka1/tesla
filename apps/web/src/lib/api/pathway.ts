import { queryOptions } from '@tanstack/react-query';
import {
  type ActivateAgeRuleSetInput,
  ageRuleSetListSchema,
  ageRuleSetSchema,
  type CreateAgeRuleSetInput,
  catchUpObligationSchema,
  type DecideCatchUpInput,
  type CreateStageOverrideInput,
  type LiftStageOverrideInput,
  pathwayOverviewSchema,
  type PreviewStageOverrideInput,
  scoutPathwaySchema,
  stageOverridePreviewSchema,
  stageOverrideSchema,
  stageSupervisionSchema,
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

// Supervision de la progression et exception de secours : responsable plein en fonction (D176).
// Jamais conservées sur l'appareil (voir `lib/offline/repository.ts`).

export const stageSupervisionQueryOptions = (scoutId: string) =>
  queryOptions({
    queryKey: ['pathway', 'supervision', scoutId],
    queryFn: () => apiFetch(`/scouts/${scoutId}/stage-supervision`, stageSupervisionSchema),
  });

export const previewStageOverride = (scoutId: string, input: PreviewStageOverrideInput) =>
  apiSend('POST', `/scouts/${scoutId}/stage-overrides/preview`, stageOverridePreviewSchema, input);

export const createStageOverride = (scoutId: string, input: CreateStageOverrideInput) =>
  apiSend('POST', `/scouts/${scoutId}/stage-overrides`, stageOverrideSchema, input);

export const liftStageOverride = (overrideId: string, input: LiftStageOverrideInput) =>
  apiSend('POST', `/stage-overrides/${overrideId}/lift`, stageOverrideSchema, input);
