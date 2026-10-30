import { queryOptions } from '@tanstack/react-query';
import {
  type AssignTeamBody,
  type CreateObservationInput,
  type CreateScoutProfileInput,
  type LinkAccountInput,
  observationSchema,
  paginatedSchema,
  scoutDetailSchema,
  scoutListItemSchema,
  type ScoutListQuery,
  stageListResponseSchema,
  teamAssignmentListSchema,
  type UpdateObservationInput,
  type UpdateScoutProfileInput,
} from '@tesla/shared';
import { apiFetch, apiSend, toQueryString } from './client';

const scoutPageSchema = paginatedSchema(scoutListItemSchema);
const observationPageSchema = paginatedSchema(observationSchema);

export const scoutsQueryOptions = (query: ScoutListQuery) =>
  queryOptions({
    queryKey: ['scouts', 'list', query],
    queryFn: () => apiFetch(`/scouts${toQueryString({ ...query })}`, scoutPageSchema),
  });

export const scoutQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['scouts', 'detail', id],
    queryFn: () => apiFetch(`/scouts/${id}`, scoutDetailSchema),
  });

export const teamHistoryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['scouts', 'detail', id, 'teams'],
    queryFn: () => apiFetch(`/scouts/${id}/teams/history`, teamAssignmentListSchema),
  });

export const observationsQueryOptions = (id: string, page: number) =>
  queryOptions({
    queryKey: ['scouts', 'detail', id, 'observations', page],
    queryFn: () =>
      apiFetch(
        `/scouts/${id}/observations${toQueryString({ page, pageSize: 10 })}`,
        observationPageSchema,
      ),
  });

/** Référentiel des étapes : stable, mis en cache longtemps. */
export const stagesQueryOptions = queryOptions({
  queryKey: ['progression', 'stages'],
  queryFn: () => apiFetch('/progression/stages', stageListResponseSchema),
  staleTime: 60 * 60_000,
});

// Écritures différables hors connexion (D110) : rejouées par la file de l'appareil.
export const createScout = (input: CreateScoutProfileInput) =>
  apiSend('POST', '/scouts', scoutDetailSchema, input, {
    type: 'scout.create',
    label: `Nouvelle fiche : ${input.firstName} ${input.lastName}`,
    entity: { kind: 'scout', id: crypto.randomUUID() },
    creates: true,
  });

export const updateScout = (id: string, input: UpdateScoutProfileInput, name = 'Fiche') =>
  apiSend('PATCH', `/scouts/${id}`, scoutDetailSchema, input, {
    type: 'scout.update',
    label: `${name} : modification de la fiche`,
    entity: { kind: 'scout', id },
  });

export const setScoutActive = (id: string, active: boolean) =>
  apiSend('POST', `/scouts/${id}/${active ? 'activate' : 'deactivate'}`, scoutDetailSchema);

export const linkAccount = (id: string, input: LinkAccountInput) =>
  apiSend('POST', `/scouts/${id}/link-account`, scoutDetailSchema, input);

export const assignTeam = (id: string, input: AssignTeamBody, label = 'Affectation d’équipe') =>
  apiSend('POST', `/scouts/${id}/teams/assign`, teamAssignmentListSchema, input, {
    type: 'team.assign',
    label,
    entity: { kind: 'scout', id },
  });

export const unassignTeam = (id: string) =>
  apiSend('POST', `/scouts/${id}/teams/unassign`, teamAssignmentListSchema);

export const createObservation = (id: string, input: CreateObservationInput, name = 'Routier') =>
  apiSend('POST', `/scouts/${id}/observations`, observationSchema, input, {
    type: 'observation.create',
    label: `${name} : nouvelle observation`,
    entity: { kind: 'observation', id: crypto.randomUUID() },
  });

export const updateObservation = (
  id: string,
  observationId: string,
  input: UpdateObservationInput,
) => apiSend('PATCH', `/scouts/${id}/observations/${observationId}`, observationSchema, input);
