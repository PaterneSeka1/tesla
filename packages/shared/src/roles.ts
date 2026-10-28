/**
 * Rôles applicatifs. Doit rester synchronisé avec l'enum Prisma `Role`
 * (vérifié par un test côté API).
 */
export const ROLES = ['ROUTIER', 'CHEF', 'RESPONSABLE'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ROUTIER: 'Routier',
  CHEF: 'Chef',
  RESPONSABLE: 'Responsable pédagogique',
};
