import { queryOptions } from '@tanstack/react-query';
import {
  type AccountListQuery,
  accountSchema,
  accountTokenInfoSchema,
  accountWithLinkSchema,
  type ChangePasswordInput,
  type CompleteAccountTokenInput,
  type CreateAccountInput,
  type DeactivateAccountInput,
  meResponseSchema,
  paginatedSchema,
  revokedSessionsSchema,
  sessionListSchema,
  type UpdateProfileInput,
} from '@tesla/shared';
import { z } from 'zod';
import { apiFetch, apiSend, toQueryString } from './client';

// Comptes (D118–D121). Aucune de ces routes n'est conservée sur l'appareil (`/auth/`, `/users`) :
// la gestion des comptes exige le serveur.

const accountPageSchema = paginatedSchema(accountSchema);

export const accountsQueryOptions = (query: AccountListQuery) =>
  queryOptions({
    queryKey: ['accounts', 'list', query],
    queryFn: () => apiFetch(`/users${toQueryString({ ...query })}`, accountPageSchema),
  });

export const createAccount = (input: CreateAccountInput) =>
  apiSend('POST', '/users', accountWithLinkSchema, input);

export const issueAccountLink = (id: string) =>
  apiSend('POST', `/users/${id}/link`, accountWithLinkSchema);

export const deactivateAccount = (id: string, input: DeactivateAccountInput) =>
  apiSend('POST', `/users/${id}/deactivate`, accountSchema, input);

export const reactivateAccount = (id: string) =>
  apiSend('POST', `/users/${id}/reactivate`, accountSchema);

export const revokeAccountSessions = (id: string) =>
  apiSend('POST', `/users/${id}/revoke-sessions`, revokedSessionsSchema);

/** Adresse du lien à transmettre : le jeton est dans le fragment, jamais envoyé au serveur web. */
export const accountLinkUrl = (token: string) =>
  `${window.location.origin}/activation#${encodeURIComponent(token)}`;

export const inspectAccountLink = (token: string) =>
  apiSend('POST', '/auth/account-link/inspect', accountTokenInfoSchema, { token });

export const completeAccountLink = (input: CompleteAccountTokenInput) =>
  apiSend('POST', '/auth/account-link/complete', z.null(), input);

export const sessionsQueryOptions = queryOptions({
  queryKey: ['auth', 'sessions'],
  queryFn: () => apiFetch('/auth/sessions', sessionListSchema),
});

export const changePassword = (input: ChangePasswordInput) =>
  apiSend('POST', '/auth/password', z.null(), input);

export const updateProfile = (input: UpdateProfileInput) =>
  apiSend('PATCH', '/auth/profile', meResponseSchema, input);

export const revokeSession = (id: string) =>
  apiSend('POST', `/auth/sessions/${id}/revoke`, z.null());

export const revokeOtherSessions = () =>
  apiSend('POST', '/auth/sessions/revoke-others', revokedSessionsSchema);
