import { type LeaderFunction, type Role } from './roles.js';

/**
 * Niveaux d'habilitation, internes au serveur et jamais affichés (D132) :
 * - `ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR` : rôle d'accès du compte ;
 * - `OFFICIEL` : décision officielle, réservée au responsable plein en fonction.
 * Le rôle `ENCADREMENT` seul n'accorde jamais une permission `OFFICIEL` ; l'adjoint et les
 * assistants ont les permissions de l'encadrement. Aucune délégation, aucun mandat.
 */
export type AccessLevel = 'ROUTIER' | 'ENCADREMENT' | 'OFFICIEL' | 'ADMINISTRATEUR';

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
  /** Composition actuelle de l'encadrement (noms et fonctions) : tout membre connecté. */
  'leadership.read': ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Désigner le responsable plein, l'adjoint et les assistants, mettre fin à une fonction, consulter
   * l'historique : l'administrateur seul (D132). Jamais le plein pour lui-même.
   */
  'leadership.manage': ['ADMINISTRATEUR'],
  /**
   * Comptes (D119, à confirmer) : l'administrateur gère tous les comptes ; le responsable plein
   * couvre les seuls comptes routiers (périmètre vérifié par le service).
   */
  'account.read': ['ADMINISTRATEUR', 'OFFICIEL'],
  'account.manage': ['ADMINISTRATEUR', 'OFFICIEL'],
} as const satisfies Record<string, readonly AccessLevel[]>;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Habilitations effectives d'un utilisateur, calculées par l'API à chaque requête. */
export interface Authority {
  role: Role;
  /** Fonction d'encadrement en cours, null sinon. */
  leaderFunction: LeaderFunction | null;
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
      case 'OFFICIEL':
        return role === 'ENCADREMENT' && leaderFunction === 'PLEIN';
    }
  });
}

export function effectivePermissions(authority: Authority): Permission[] {
  return PERMISSION_KEYS.filter((key) => hasPermission(authority, key));
}
