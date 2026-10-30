import { queryOptions } from '@tanstack/react-query';
import {
  activityDetailSchema,
  type ActivityListQuery,
  activitySummarySchema,
  attendanceSheetSchema,
  type ChangeActivityStatusInput,
  type CreateActivityInput,
  paginatedSchema,
  programmeCategoryListSchema,
  programmeImportReportSchema,
  programmeListSchema,
  type SaveAttendanceInput,
  type UpdateActivityInput,
  type UpdateProgrammeCategoryInput,
} from '@tesla/shared';
import { apiFetch, apiSend, toQueryString } from './client';

const activityPageSchema = paginatedSchema(activitySummarySchema);

export const programmesQueryOptions = queryOptions({
  queryKey: ['programmes', 'list'],
  queryFn: () => apiFetch('/programmes', programmeListSchema),
});

export const programmeCategoriesQueryOptions = queryOptions({
  queryKey: ['programmes', 'categories'],
  queryFn: () => apiFetch('/programmes/categories', programmeCategoryListSchema),
});

export const activitiesQueryOptions = (query: ActivityListQuery) =>
  queryOptions({
    queryKey: ['activities', 'list', query],
    queryFn: () => apiFetch(`/activities${toQueryString({ ...query })}`, activityPageSchema),
  });

export const activityQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['activities', 'detail', id],
    queryFn: () => apiFetch(`/activities/${id}`, activityDetailSchema),
  });

export const attendanceQueryOptions = (id: string, teamId = '') =>
  queryOptions({
    queryKey: ['activities', 'detail', id, 'attendance', teamId],
    queryFn: () =>
      apiFetch(`/activities/${id}/attendance${toQueryString({ teamId })}`, attendanceSheetSchema),
  });

export const updateProgrammeCategory = (id: string, input: UpdateProgrammeCategoryInput) =>
  apiSend('PATCH', `/programmes/categories/${id}`, programmeCategoryListSchema, input);

export const importProgramme = (programmeId: string, content: string, apply: boolean) =>
  apiSend(
    'POST',
    `/programmes/${programmeId}/import${apply ? '' : '/preview'}`,
    programmeImportReportSchema,
    { content },
  );

// Écritures différables hors connexion (D110) : rejouées par la file de l'appareil.
export const createActivity = (input: CreateActivityInput) =>
  apiSend('POST', '/activities', activityDetailSchema, input, {
    type: 'activity.create',
    label: `Nouvelle activité « ${input.title} »`,
    entity: { kind: 'activity', id: crypto.randomUUID() },
    creates: true,
  });

export const updateActivity = (id: string, input: UpdateActivityInput, label = 'Activité') =>
  apiSend('PATCH', `/activities/${id}`, activityDetailSchema, input, {
    type: 'activity.update',
    label: `${label} : modification`,
    entity: { kind: 'activity', id },
  });

export const changeActivityStatus = (
  id: string,
  input: ChangeActivityStatusInput,
  label = 'Activité',
) =>
  apiSend('POST', `/activities/${id}/status`, activityDetailSchema, input, {
    type: 'activity.status',
    label: `${label} : changement de statut`,
    entity: { kind: 'activity', id },
  });

export const saveAttendance = (id: string, input: SaveAttendanceInput, label = 'Activité') =>
  apiSend('PUT', `/activities/${id}/attendance`, attendanceSheetSchema, input, {
    type: 'attendance.save',
    label: `${label} : présences`,
    entity: { kind: 'activity', id },
  });
