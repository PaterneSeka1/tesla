import { ForbiddenException } from '@nestjs/common';
import { type Role } from '@tesla/shared';
import { type Actor } from './actor.js';

/**
 * Matrice des permissions métier, vérifiée côté serveur par chaque service.
 * Les lignes marquées « à confirmer » sont des choix provisoires (voir docs/DECISIONS.md).
 */
export const PERMISSIONS = {
  /** Inscrire un routier (avec ou sans compte) — à confirmer. */
  'scout.create': ['CHEF', 'RESPONSABLE'],
  'scout.read': ['CHEF', 'RESPONSABLE'],
  'scout.setMatricule': ['CHEF', 'RESPONSABLE'],
  /** Rattacher un compte à un profil : gestion des comptes (responsable, à confirmer). */
  'scout.linkAccount': ['RESPONSABLE'],
  /** Créer ou archiver une équipe — à confirmer. */
  'team.manage': ['RESPONSABLE'],
  'team.assign': ['CHEF', 'RESPONSABLE'],
  'attempt.preparePaper': ['CHEF', 'RESPONSABLE'],
  'attempt.readAny': ['CHEF', 'RESPONSABLE'],
  'attempt.record': ['CHEF', 'RESPONSABLE'],
  'attempt.submit': ['CHEF', 'RESPONSABLE'],
  'attempt.cancel': ['CHEF', 'RESPONSABLE'],
  /** Décision pédagogique sur un résultat : exclusivement le responsable (RM-010). */
  'attempt.decide': ['RESPONSABLE'],
  'attempt.reopen': ['RESPONSABLE'],
  /** Dérogations : exclusivement le responsable (RM-009). */
  'waiver.manage': ['RESPONSABLE'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: Actor, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(actor.role);
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    });
  }
}
