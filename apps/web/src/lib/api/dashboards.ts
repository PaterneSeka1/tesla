import { queryOptions } from '@tanstack/react-query';
import {
  chefDashboardSchema,
  myActivitiesSchema,
  myDashboardSchema,
  responsableDashboardSchema,
  type StatisticsQuery,
  statisticsSchema,
} from '@tesla/shared';
import { apiFetch, toQueryString } from './client';

export const statisticsQueryOptions = (query: StatisticsQuery) =>
  queryOptions({
    queryKey: ['dashboards', 'statistics', query],
    queryFn: () => apiFetch(`/statistics${toQueryString({ ...query })}`, statisticsSchema),
  });

export const responsableDashboardQueryOptions = queryOptions({
  queryKey: ['dashboards', 'responsable'],
  queryFn: () => apiFetch('/dashboard/responsable', responsableDashboardSchema),
});

export const chefDashboardQueryOptions = queryOptions({
  queryKey: ['dashboards', 'chef'],
  queryFn: () => apiFetch('/dashboard/chef', chefDashboardSchema),
});

export const myDashboardQueryOptions = queryOptions({
  queryKey: ['dashboards', 'me'],
  queryFn: () => apiFetch('/me/dashboard', myDashboardSchema),
});

export const myActivitiesQueryOptions = queryOptions({
  queryKey: ['dashboards', 'me', 'activities'],
  queryFn: () => apiFetch('/me/activities', myActivitiesSchema),
});
