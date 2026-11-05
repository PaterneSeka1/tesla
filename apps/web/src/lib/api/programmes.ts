import { queryOptions } from '@tanstack/react-query';
import {
  activityDetailSchema,
  type ActivityListQuery,
  activitySummarySchema,
  attendanceSheetSchema,
  type ChangeActivityStatusInput,
  type CreateActivityInput,
  type ImportDecision,
  paginatedSchema,
  programmeCategoryListSchema,
  type ProgrammeExcelImportInput,
  programmeImportHistorySchema,
  programmeImportReportSchema,
  type ProgrammeInput,
  programmeListSchema,
  type SaveAttendanceInput,
  type UpdateActivityInput,
  type UpdateProgrammeCategoryInput,
  type UpdateProgrammeInput,
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

export const programmeImportsQueryOptions = (programmeId: string) =>
  queryOptions({
    queryKey: ['programmes', 'imports', programmeId],
    queryFn: () => apiFetch(`/programmes/${programmeId}/imports`, programmeImportHistorySchema),
  });

// Décisions officielles : jamais différées hors connexion (aucune `OfflineWrite`).
export const createProgramme = (input: ProgrammeInput) =>
  apiSend('POST', '/programmes', programmeListSchema, input);

export const updateProgramme = (id: string, input: UpdateProgrammeInput) =>
  apiSend('PATCH', `/programmes/${id}`, programmeListSchema, input);

export const importProgramme = (
  programmeId: string,
  content: string,
  apply: boolean,
  extra: { decisions?: ImportDecision[]; fingerprint?: string } = {},
) =>
  apiSend(
    'POST',
    `/programmes/${programmeId}/import${apply ? '' : '/preview'}`,
    programmeImportReportSchema,
    { content, ...extra },
  );

/** Classeur .xlsx : analyse (aucune écriture) ou confirmation avec l'empreinte examinée. */
export const importProgrammeExcel = (
  programmeId: string,
  input: ProgrammeExcelImportInput,
  apply: boolean,
) =>
  apiSend(
    'POST',
    `/programmes/${programmeId}/import/excel${apply ? '' : '/preview'}`,
    programmeImportReportSchema,
    input,
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
