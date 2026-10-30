import { type LeaderFunction, type Role } from './roles.js';

/**
 * Niveaux d'habilitation (D94) :
 * - `ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR` : rôle d'accès du compte ;
 * - `OFFICIEL` : décision officielle — responsable plein en exercice, ou membre de l'encadrement
 *   titulaire d'une délégation active portant sur cette permission ;
 * - `PLEIN` : réservé au responsable plein en exercice, jamais délégable.
 * Le rôle `ENCADREMENT` seul n'accorde jamais une permission `OFFICIEL`.
 */
export type AccessLevel = 'ROUTIER' | 'ENCADREMENT' | 'OFFICIEL' | 'PLEIN' | 'ADMINISTRATEUR';

const ENCADREMENT = ['ENCADREMENT'] as const;
const OFFICIEL = ['OFFICIEL'] as const;

/**
 * Matrice des permissions métier, vérifiée côté serveur par chaque service (`assertCan`) et utilisée
 * par le web pour l'affichage seulement. Les lignes « à confirmer » sont provisoires (docs/DECISIONS.md).
 */
export const PERMISSIONS = {
  /** Consulter les fiches, équipes et historiques des routiers. */
  'scout.read': ENCADREMENT,
  /** Inscrire et modifier un routier (avec ou sans compte) — à confirmer (D32). */
  'scout.create': OFFICIEL,
  'scout.update': OFFICIEL,
  'scout.setMatricule': OFFICIEL,
  'scout.setActive': OFFICIEL,
  /** Changer l'étape officielle : acte officiel (RM-010). */
  'scout.setStage': OFFICIEL,
  'scout.linkAccount': OFFICIEL,
  'team.read': ENCADREMENT,
  'team.manage': OFFICIEL,
  'team.assign': OFFICIEL,
  /** Observations d'accompagnement : tout l'encadrement (à confirmer). */
  'observation.create': ENCADREMENT,
  'observation.read': ENCADREMENT,
  /** Lire les observations de niveau « responsable » rédigées par d'autres. */
  'observation.readRestricted': OFFICIEL,
  'attempt.preparePaper': ENCADREMENT,
  /** Copies, corrigés, grilles de correction : jamais les routiers. */
  'attempt.readAny': ENCADREMENT,
  'attempt.record': ENCADREMENT,
  'attempt.submit': ENCADREMENT,
  'attempt.cancel': ENCADREMENT,
  /** Examen d'un résultat corrigé : décision officielle. */
  'attempt.decide': OFFICIEL,
  'attempt.reopen': OFFICIEL,
  /** Dérogations (RM-009). */
  'waiver.manage': OFFICIEL,
  /** Bibliothèque : tout utilisateur pédagogique lit les modules publiés, sans condition d'étape. */
  'module.read': ['ROUTIER', 'ENCADREMENT'],
  'module.write': ENCADREMENT,
  'module.writeAny': OFFICIEL,
  /** Approuver, demander des corrections, refuser, publier, archiver. */
  'module.review': OFFICIEL,
  'evaluation.read': ['ROUTIER', 'ENCADREMENT'],
  'evaluation.take': ['ROUTIER'],
  'evaluation.write': ENCADREMENT,
  'evaluation.writeAny': OFFICIEL,
  'evaluation.review': OFFICIEL,
  'progression.read': ENCADREMENT,
  'progression.readOwn': ['ROUTIER'],
  'competency.read': ENCADREMENT,
  'competency.manage': OFFICIEL,
  'competency.propose': ENCADREMENT,
  'competency.decide': OFFICIEL,
  'moduleStudy.record': ENCADREMENT,
  'moduleStudy.declare': ['ROUTIER'],
  'activity.read': ENCADREMENT,
  'activity.manage': ENCADREMENT,
  'attendance.record': ENCADREMENT,
  'programme.configure': OFFICIEL,
  'statistics.read': ENCADREMENT,
  /** Indicateurs et file de décisions officielles du tableau de bord. */
  'dashboard.official': OFFICIEL,
  /** Référentiel d'âge : consultation par l'encadrement, versions et mise en vigueur officielles. */
  'ageRules.read': ENCADREMENT,
  'ageRules.manage': OFFICIEL,
  /** Rattrapages : suivi par l'encadrement ; acquis ou non-applicabilité décidés officiellement. */
  'catchUp.read': ENCADREMENT,
  'catchUp.decide': OFFICIEL,
  /** Appliquer les sorties de branche échues (traitement idempotent, aussi exécuté par la tâche quotidienne). */
  'membership.apply': OFFICIEL,
  /** Mandats : consultation par l'encadrement et l'administration technique. */
  'mandate.read': ['ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Enregistrer la nomination, la reconduction ou la fin d'un responsable plein : l'autorité de
   * nomination est extérieure (référencée sur le mandat) ; l'administration technique la consigne.
   * Le plein ne se nomme ni ne se reconduit lui-même (D101, à confirmer).
   */
  'mandate.recordPlein': ['ADMINISTRATEUR'],
  /** Adjoints et assistants : le plein en exercice ou l'administration technique (D101, à confirmer). */
  'mandate.recordTeam': ['PLEIN', 'ADMINISTRATEUR'],
  'scoutYear.manage': ['ADMINISTRATEUR'],
  'delegation.read': ['ENCADREMENT', 'ADMINISTRATEUR'],
  'delegation.manage': ['PLEIN'],
  /**
   * Comptes (D119, à confirmer) : l'administration technique gère tous les comptes ; la décision
   * officielle (plein ou délégation) couvre les seuls comptes routiers (périmètre vérifié par le service).
   */
  'account.read': ['ADMINISTRATEUR', 'OFFICIEL'],
  'account.manage': ['ADMINISTRATEUR', 'OFFICIEL'],
} as const satisfies Record<string, readonly AccessLevel[]>;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions pouvant faire l'objet d'une délégation (niveau `OFFICIEL`). */
export const DELEGABLE_PERMISSIONS = PERMISSION_KEYS.filter((key) =>
  (PERMISSIONS[key] as readonly AccessLevel[]).includes('OFFICIEL'),
);

export const PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  'scout.create': 'Inscrire un routier',
  'scout.update': 'Modifier une fiche',
  'scout.setMatricule': 'Renseigner un matricule',
  'scout.setActive': 'Activer ou désactiver une fiche',
  'scout.setStage': 'Décider d’une étape officielle',
  'scout.linkAccount': 'Rattacher un compte',
  'team.manage': 'Gérer les équipes',
  'team.assign': 'Affecter aux équipes',
  'observation.readRestricted': 'Lire les observations réservées',
  'attempt.decide': 'Examiner les résultats',
  'attempt.reopen': 'Rouvrir un résultat',
  'waiver.manage': 'Accorder des déblocages',
  'module.writeAny': 'Modifier tous les modules',
  'module.review': 'Approuver et publier les modules',
  'evaluation.writeAny': 'Modifier tous les questionnaires',
  'evaluation.review': 'Approuver et publier les questionnaires',
  'competency.manage': 'Administrer les compétences',
  'competency.decide': 'Valider les acquis',
  'programme.configure': 'Configurer le programme annuel',
  'dashboard.official': 'Tableau de bord des décisions',
  'ageRules.manage': 'Gérer le référentiel d’âge',
  'catchUp.decide': 'Statuer sur les rattrapages',
  'membership.apply': 'Appliquer les sorties de branche',
  'account.read': 'Consulter les comptes routiers',
  'account.manage': 'Créer et gérer les comptes routiers',
};

/** Habilitations effectives d'un utilisateur, calculées par l'API à chaque requête. */
export interface Authority {
  role: Role;
  /** Fonction du mandat en vigueur aujourd'hui (date civile d'Abidjan), null sinon. */
  leaderFunction: LeaderFunction | null;
  /** Permissions déléguées actives aujourd'hui. */
  delegated: readonly Permission[];
}

export function hasPermission(authority: Authority, permission: Permission): boolean {
  const levels = PERMISSIONS[permission] as readonly AccessLevel[];
  const { role, leaderFunction } = authority;
  return levels.some((level) => {
    switch (level) {
      case 'ROUTIER':
      case 'ENCADREMENT':
      case 'ADMINISTRATEUR':
        return role === level;
      case 'PLEIN':
        return role === 'ENCADREMENT' && leaderFunction === 'PLEIN';
      case 'OFFICIEL':
        return (
          role === 'ENCADREMENT' &&
          (leaderFunction === 'PLEIN' || authority.delegated.includes(permission))
        );
    }
  });
}

export function effectivePermissions(authority: Authority): Permission[] {
  return PERMISSION_KEYS.filter((key) => hasPermission(authority, key));
}
