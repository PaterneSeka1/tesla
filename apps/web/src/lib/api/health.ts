import { queryOptions } from '@tanstack/react-query';
import { healthResponseSchema } from '@tesla/shared';
import { apiFetch } from './client';

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiFetch('/health', healthResponseSchema),
  refetchInterval: 30_000,
  retry: false,
});
