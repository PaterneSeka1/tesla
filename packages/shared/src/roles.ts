/**
 * Rôles d'accès applicatifs, internes (D93, D132) : ils fixent les droits côté serveur et ne sont
 * jamais affichés comme tels. Doit rester synchronisé avec l'enum Prisma `Role`, qui conserve en plus
 * les valeurs historiques {@link LEGACY_ROLES} (vérifié par un test côté API).
 * La fonction exercée dans l'encadrement n'est pas un rôle : elle découle d'une désignation.
 */
/**
 * `ADULTE` (D185) : apprenant adulte, ni routier ni encadrement ; lit les cours et passe les
 * évaluations publiés, sans aucune progression Route.
 */
export const ROLES = ['ROUTIER', 'ADULTE', 'ENCADREMENT', 'ADMINISTRATEUR'] as const;

export type Role = (typeof ROLES)[number];

/** Rôles antérieurs à la refonte, interdits en base (`users_role_current_check`), conservés dans `legacy_role`. */
export const LEGACY_ROLES = ['CHEF', 'RESPONSABLE'] as const;

export type LegacyRole = (typeof LEGACY_ROLES)[number];

/** Type de compte, en langage courant : choisi à la création d'un compte par l'administrateur. */
export const ROLE_LABELS: Record<Role, string> = {
  ROUTIER: 'Routier',
  ADULTE: 'Adulte (apprenant)',
  ENCADREMENT: 'Membre de l’encadrement',
  ADMINISTRATEUR: 'Administrateur de la plateforme',
};

/**
 * Type de fiche d'apprenant (D185), synchronisé avec l'enum Prisma `LearnerKind`. Mêmes valeurs que
 * les rôles des comptes qui peuvent y être rattachés : une fiche `ADULTE` ne reçoit qu'un compte
 * `ADULTE`, une fiche `ROUTIER` qu'un compte `ROUTIER`.
 */
export const LEARNER_KINDS = ['ROUTIER', 'ADULTE'] as const;

export type LearnerKind = (typeof LEARNER_KINDS)[number];

export const LEARNER_KIND_LABELS: Record<LearnerKind, string> = {
  ROUTIER: 'Routier',
  ADULTE: 'Adulte',
};

/** Rôle d'un compte d'apprenant, rattachable à une fiche du même type. */
export function isLearnerRole(role: Role): role is LearnerKind {
  return (LEARNER_KINDS as readonly string[]).includes(role);
}

/** Fonctions exercées par les membres de l'encadrement (synchronisé avec l'enum Prisma `LeaderFunction`). */
export const LEADER_FUNCTIONS = ['PLEIN', 'ADJOINT', 'ASSISTANT'] as const;

export type LeaderFunction = (typeof LEADER_FUNCTIONS)[number];

export const LEADER_FUNCTION_LABELS: Record<LeaderFunction, string> = {
  PLEIN: 'Responsable plein',
  ADJOINT: 'Responsable adjoint',
  ASSISTANT: 'Responsable assistant',
};
