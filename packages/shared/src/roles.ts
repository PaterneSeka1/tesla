/**
 * Rôles d'accès applicatifs, internes (D93, D132) : ils fixent les droits côté serveur et ne sont
 * jamais affichés comme tels. Doit rester synchronisé avec l'enum Prisma `Role`, qui conserve en plus
 * les valeurs historiques {@link LEGACY_ROLES} (vérifié par un test côté API).
 * La fonction exercée dans l'encadrement n'est pas un rôle : elle découle d'une désignation.
 */
export const ROLES = ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR'] as const;

export type Role = (typeof ROLES)[number];

/** Rôles antérieurs à la refonte, interdits en base (`users_role_current_check`), conservés dans `legacy_role`. */
export const LEGACY_ROLES = ['CHEF', 'RESPONSABLE'] as const;

export type LegacyRole = (typeof LEGACY_ROLES)[number];

/** Type de compte, en langage courant : choisi à la création d'un compte par l'administrateur. */
export const ROLE_LABELS: Record<Role, string> = {
  ROUTIER: 'Routier',
  ENCADREMENT: 'Membre de l’encadrement',
  ADMINISTRATEUR: 'Administrateur de la plateforme',
};

/** Fonctions exercées par les membres de l'encadrement (synchronisé avec l'enum Prisma `LeaderFunction`). */
export const LEADER_FUNCTIONS = ['PLEIN', 'ADJOINT', 'ASSISTANT'] as const;

export type LeaderFunction = (typeof LEADER_FUNCTIONS)[number];

export const LEADER_FUNCTION_LABELS: Record<LeaderFunction, string> = {
  PLEIN: 'Responsable plein',
  ADJOINT: 'Responsable adjoint',
  ASSISTANT: 'Responsable assistant',
};
