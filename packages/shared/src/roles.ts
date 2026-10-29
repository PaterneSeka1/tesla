/**
 * Rôles d'accès applicatifs (D93). Doit rester synchronisé avec l'enum Prisma `Role`, qui conserve
 * en plus les valeurs historiques {@link LEGACY_ROLES} (vérifié par un test côté API).
 * La fonction exercée dans l'encadrement n'est pas un rôle : elle découle d'un mandat.
 */
export const ROLES = ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR'] as const;

export type Role = (typeof ROLES)[number];

/** Rôles antérieurs à la refonte, interdits en base (`users_role_current_check`), conservés dans `legacy_role`. */
export const LEGACY_ROLES = ['CHEF', 'RESPONSABLE'] as const;

export type LegacyRole = (typeof LEGACY_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ROUTIER: 'Routier',
  ENCADREMENT: 'Encadrement',
  ADMINISTRATEUR: 'Administration technique',
};

export const LEGACY_ROLE_LABELS: Record<LegacyRole, string> = {
  CHEF: 'Ancien rôle « Chef »',
  RESPONSABLE: 'Ancien rôle « Responsable »',
};

/** Fonctions exercées par les membres de l'encadrement (synchronisé avec l'enum Prisma `LeaderFunction`). */
export const LEADER_FUNCTIONS = ['PLEIN', 'ADJOINT', 'ASSISTANT'] as const;

export type LeaderFunction = (typeof LEADER_FUNCTIONS)[number];

export const LEADER_FUNCTION_LABELS: Record<LeaderFunction, string> = {
  PLEIN: 'Responsable plein',
  ADJOINT: 'Responsable adjoint',
  ASSISTANT: 'Responsable assistant',
};
