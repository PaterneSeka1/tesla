import { queryOptions } from '@tanstack/react-query';
import { type LoginInput, meResponseSchema } from '@tesla/shared';
import { z } from 'zod';
import { apiFetch, apiSend } from './client';

export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: () => apiFetch('/auth/me', meResponseSchema),
  retry: false,
  staleTime: 5 * 60_000,
});

export const login = (input: LoginInput) => apiSend('POST', '/auth/login', meResponseSchema, input);

/** 204 sans corps : `null` attendu. */
export const logout = () => apiFetch('/auth/logout', z.null(), { method: 'POST' });
