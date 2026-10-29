import { queryOptions } from '@tanstack/react-query';
import {
  type CreateTeamInput,
  paginatedSchema,
  teamDetailSchema,
  type TeamListQuery,
  teamSchema,
  type UpdateTeamInput,
} from '@tesla/shared';
import { apiFetch, apiSend, toQueryString } from './client';

const teamPageSchema = paginatedSchema(teamSchema);

export const teamsQueryOptions = (query: TeamListQuery) =>
  queryOptions({
    queryKey: ['teams', 'list', query],
    queryFn: () => apiFetch(`/teams${toQueryString({ ...query })}`, teamPageSchema),
  });

export const teamQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['teams', 'detail', id],
    queryFn: () => apiFetch(`/teams/${id}`, teamDetailSchema),
  });

/** Équipes actives (sélecteurs d'affectation et filtres). */
export const activeTeamsQueryOptions = teamsQueryOptions({ status: 'active', pageSize: 100 });

export const createTeam = (input: CreateTeamInput) =>
  apiSend('POST', '/teams', teamDetailSchema, input);

export const updateTeam = (id: string, input: UpdateTeamInput) =>
  apiSend('PATCH', `/teams/${id}`, teamDetailSchema, input);

export const archiveTeam = (id: string) =>
  apiSend('POST', `/teams/${id}/archive`, teamDetailSchema);
