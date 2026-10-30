import { queryOptions } from '@tanstack/react-query';
import { type LoginInput, type MeResponse, meResponseSchema } from '@tesla/shared';
import { z } from 'zod';
import { confirmServerUser, localIdentity } from '@/lib/offline/vault';
import { ApiError, apiFetch, apiSend } from './client';

/** Session courante ; `local` : identité vérifiée lors d'une connexion précédente, sans réseau (D112). */
export type CurrentSession = MeResponse & { local?: true };

export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: async (): Promise<CurrentSession> => {
    try {
      const me = await apiFetch('/auth/me', meResponseSchema);
      void confirmServerUser(me.user).catch(() => {});
      return me;
    } catch (error) {
      // Hors connexion uniquement : un refus du serveur (401) n'ouvre jamais l'usage local.
      if (error instanceof ApiError && error.status === 0) {
        const user = await localIdentity();
        if (user) return { user, local: true };
      }
      throw error;
    }
  },
  retry: false,
  staleTime: 5 * 60_000,
});

export const login = (input: LoginInput) => apiSend('POST', '/auth/login', meResponseSchema, input);

/** 204 sans corps : `null` attendu. */
export const logout = () => apiFetch('/auth/logout', z.null(), { method: 'POST' });
