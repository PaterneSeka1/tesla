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
  /** Copies, corrigés, grilles de correction : jamais les routiers. */
  'attempt.readAny': ['CHEF', 'RESPONSABLE'],
  /** Saisir ou corriger un résultat (tous les chefs de la communauté, à confirmer). */
  'attempt.record': ['CHEF', 'RESPONSABLE'],
  'attempt.submit': ['CHEF', 'RESPONSABLE'],
  'attempt.cancel': ['CHEF', 'RESPONSABLE'],
  /** Examen d'un résultat corrigé (accepter, demander une nouvelle correction) : exclusivement le responsable. */
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
  /** Liste des évaluations publiées (sans corrigé). L'accès au questionnaire dépend de l'éligibilité. */
  'evaluation.read': ['ROUTIER', 'CHEF', 'RESPONSABLE'],
  /** Passer une évaluation en ligne : routier avec profil, après contrôle d'éligibilité. */
  'evaluation.take': ['ROUTIER'],
  /** Rédiger un questionnaire ; modifier ceux dont on est auteur ou rédacteur du module évalué. */
  'evaluation.write': ['CHEF', 'RESPONSABLE'],
  'evaluation.writeAny': ['RESPONSABLE'],
  /** Approuver, demander des corrections, refuser, publier, archiver un questionnaire. */
  'evaluation.review': ['RESPONSABLE'],
  /** Dossier de progression d'un routier (étapes, compétences, études, présences). */
  'progression.read': ['CHEF', 'RESPONSABLE'],
  /** Sa propre progression et son tableau de bord (routier avec profil rattaché). */
  'progression.readOwn': ['ROUTIER'],
  /** Référentiel de compétences : consultation par l'encadrement, administration par le responsable. */
  'competency.read': ['CHEF', 'RESPONSABLE'],
  'competency.manage': ['RESPONSABLE'],
  /** Proposer la validation d'une compétence et suivre les réponses (tous les chefs, à confirmer). */
  'competency.propose': ['CHEF', 'RESPONSABLE'],
  /** Décision officielle (approbation, complément, refus, révocation) : exclusivement le responsable. */
  'competency.decide': ['RESPONSABLE'],
  /** Enregistrer l'étude d'un module pour un routier (avec ou sans compte). */
  'moduleStudy.record': ['CHEF', 'RESPONSABLE'],
  /** Déclarer sa propre lecture d'un module publié. */
  'moduleStudy.declare': ['ROUTIER'],
  /** Activités et présences : organisées par les chefs et le responsable. */
  'activity.read': ['CHEF', 'RESPONSABLE'],
  'activity.manage': ['CHEF', 'RESPONSABLE'],
  'attendance.record': ['CHEF', 'RESPONSABLE'],
  /** Correspondance catégories ↔ étapes et import du programme annuel. */
  'programme.configure': ['RESPONSABLE'],
  /** Indicateurs agrégés et tableau de bord de l'encadrement. */
  'statistics.read': ['CHEF', 'RESPONSABLE'],
  'dashboard.responsable': ['RESPONSABLE'],
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
