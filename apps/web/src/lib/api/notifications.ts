import { queryOptions } from '@tanstack/react-query';
import { markNotificationsReadResultSchema, notificationListSchema } from '@tesla/shared';
import { apiFetch, apiSend } from './client';

// Notifications personnelles (D192) : jamais conservées sur l'appareil (exclusion dans
// `offline/repository.ts`) ; l'accusé de lecture exige le serveur.

export const myNotificationsQueryOptions = queryOptions({
  queryKey: ['me', 'notifications'],
  queryFn: () => apiFetch('/me/notifications', notificationListSchema, { cache: 'no-store' }),
  staleTime: 5 * 60_000,
});

export const markNotificationsRead = (ids: string[]) =>
  apiSend('POST', '/me/notifications/read', markNotificationsReadResultSchema, { ids });
