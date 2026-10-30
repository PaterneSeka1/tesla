import { queryOptions } from '@tanstack/react-query';
import {
  type AssignLeaderInput,
  type EndLeaderInput,
  leadershipAdminSchema,
  leadershipAssignmentSchema,
  leadershipTeamSchema,
} from '@tesla/shared';
import { apiFetch, apiSend } from './client';

// Encadrement : responsable plein, adjoint et assistants, désignés par l'administrateur (D132).

export const leadershipTeamQueryOptions = queryOptions({
  queryKey: ['leadership', 'team'],
  queryFn: () => apiFetch('/leadership', leadershipTeamSchema),
});

export const leadershipAdminQueryOptions = queryOptions({
  queryKey: ['leadership', 'admin'],
  queryFn: () => apiFetch('/leadership/admin', leadershipAdminSchema),
});

export const assignLeader = (input: AssignLeaderInput) =>
  apiSend('POST', '/leadership/assignments', leadershipAssignmentSchema, input);

export const endLeader = (assignmentId: string, input: EndLeaderInput) =>
  apiSend('POST', `/leadership/assignments/${assignmentId}/end`, leadershipAssignmentSchema, input);
