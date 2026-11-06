import { queryOptions } from '@tanstack/react-query';
import {
  type AccountCredential,
  type AccountListQuery,
  type AccountTokenPurpose,
  accountSchema,
  accountTokenInfoSchema,
  accountWithLinkSchema,
  type ChangePasswordInput,
  type CompleteAccountCredentialInput,
  type CompleteAccountTokenInput,
  type CreateAccountInput,
  type DeactivateAccountInput,
  myProfileSchema,
  paginatedSchema,
  type PasswordResetRequestInput,
  passwordResetRequestResultSchema,
  revokedSessionsSchema,
  sessionListSchema,
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

/** Page qui reçoit chaque type de lien (D162, D166). */
export const ACCOUNT_LINK_PAGES: Record<AccountTokenPurpose, string> = {
  ACTIVATION: '/inscription',
  REINITIALISATION: '/reinitialiser-mot-de-passe',
};

/** Adresse du lien à transmettre : le jeton est dans le fragment, jamais envoyé au serveur web. */
export const accountLinkUrl = (token: string, purpose: AccountTokenPurpose) =>
  `${window.location.origin}${ACCOUNT_LINK_PAGES[purpose]}#${encodeURIComponent(token)}`;

export const inspectAccountLink = (token: string) =>
  apiSend('POST', '/auth/account-link/inspect', accountTokenInfoSchema, { token });

export const completeAccountLink = (input: CompleteAccountTokenInput) =>
  apiSend('POST', '/auth/account-link/complete', z.null(), input);

/** Routes distinctes par finalité : un jeton d'activation n'ouvre jamais la récupération. */
const CREDENTIAL_ROUTES: Record<AccountTokenPurpose, string> = {
  ACTIVATION: '/auth/activation',
  REINITIALISATION: '/auth/password-reset',
};

export const verifyAccountCredential = (purpose: AccountTokenPurpose, input: AccountCredential) =>
  apiSend('POST', `${CREDENTIAL_ROUTES[purpose]}/verify`, accountTokenInfoSchema, input);

export const completeAccountCredential = (
  purpose: AccountTokenPurpose,
  input: CompleteAccountCredentialInput,
) => apiSend('POST', `${CREDENTIAL_ROUTES[purpose]}/complete`, z.null(), input);

export const requestPasswordReset = (input: PasswordResetRequestInput) =>
  apiSend('POST', '/auth/password-reset/request', passwordResetRequestResultSchema, input);

export const sessionsQueryOptions = queryOptions({
  queryKey: ['auth', 'sessions'],
  queryFn: () => apiFetch('/auth/sessions', sessionListSchema),
});

export const changePassword = (input: ChangePasswordInput) =>
  apiSend('POST', '/auth/password', z.null(), input);

/** « Mon profil » : lecture seule, valeurs calculées par l'API (D173). */
export const myProfileQueryOptions = queryOptions({
  queryKey: ['auth', 'profile'],
  queryFn: () => apiFetch('/auth/profile', myProfileSchema),
});

export const revokeSession = (id: string) =>
  apiSend('POST', `/auth/sessions/${id}/revoke`, z.null());

export const revokeOtherSessions = () =>
  apiSend('POST', '/auth/sessions/revoke-others', revokedSessionsSchema);
