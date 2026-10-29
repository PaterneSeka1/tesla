import { ForbiddenException } from '@nestjs/common';
import { type Role } from '@tesla/shared';
import { type Actor } from './actor.js';

/**
 * Matrice des permissions métier, vérifiée côté serveur par chaque service.
 * Les lignes marquées « à confirmer » sont des choix provisoires (voir docs/DECISIONS.md).
 */
export const PERMISSIONS = {
  /** Consulter les fiches, équipes et historiques des routiers. */
  'scout.read': ['CHEF', 'RESPONSABLE'],
  /** Inscrire et modifier un routier (avec ou sans compte) — à confirmer (D32). */
  'scout.create': ['RESPONSABLE'],
  'scout.update': ['RESPONSABLE'],
  'scout.setMatricule': ['RESPONSABLE'],
  /** Activer ou désactiver un profil routier. */
  'scout.setActive': ['RESPONSABLE'],
  /** Changer l'étape de progression : acte officiel, exclusivement le responsable (RM-010). */
  'scout.setStage': ['RESPONSABLE'],
  /** Rattacher un compte à un profil : gestion des comptes (responsable, à confirmer). */
  'scout.linkAccount': ['RESPONSABLE'],
  'team.read': ['CHEF', 'RESPONSABLE'],
  /** Créer, modifier ou archiver une équipe — à confirmer. */
  'team.manage': ['RESPONSABLE'],
  /** Affecter un routier ou changer son équipe — à confirmer (D32). */
  'team.assign': ['RESPONSABLE'],
  /** Observations d'accompagnement : tous les chefs de la communauté (à confirmer). */
  'observation.create': ['CHEF', 'RESPONSABLE'],
  'observation.read': ['CHEF', 'RESPONSABLE'],
  /** Lire les observations de niveau « responsable » rédigées par d'autres. */
  'observation.readRestricted': ['RESPONSABLE'],
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
  /** Bibliothèque : tout utilisateur authentifié lit les modules publiés, sans condition d'étape. */
  'module.read': ['ROUTIER', 'CHEF', 'RESPONSABLE'],
  /** Rédaction : créer un module ; modifier ceux dont on est auteur ou collaborateur (périmètre vérifié par le service). */
  'module.write': ['CHEF', 'RESPONSABLE'],
  /** Intervenir sur tous les modules, quel qu'en soit l'auteur. */
  'module.writeAny': ['RESPONSABLE'],
  /** Approuver, demander des corrections, refuser, publier, archiver : exclusivement le responsable. */
  'module.review': ['RESPONSABLE'],
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
