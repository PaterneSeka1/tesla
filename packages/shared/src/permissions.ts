import { type LeaderFunction, type Role } from './roles.js';

/**
 * Niveaux d'habilitation, internes au serveur et jamais affichés (D132) :
 * - `ROUTIER`, `ADULTE`, `ENCADREMENT`, `ADMINISTRATEUR` : rôle d'accès du compte (`ADULTE` : apprenant
 *   adulte, D185) ;
 * - `OFFICIEL` : décision officielle, réservée au responsable plein en fonction.
 * Le rôle `ENCADREMENT` seul n'accorde jamais une permission `OFFICIEL` ; l'adjoint et les
 * assistants ont les permissions de l'encadrement. Aucune délégation, aucun mandat.
 */
export type AccessLevel = 'ROUTIER' | 'ADULTE' | 'ENCADREMENT' | 'OFFICIEL' | 'ADMINISTRATEUR';

const ENCADREMENT = ['ENCADREMENT'] as const;
const OFFICIEL = ['OFFICIEL'] as const;
/** Gestion administrative des routiers : administrateur ou responsable plein en fonction (D173). */
const ADMINISTRATION = ['ADMINISTRATEUR', 'OFFICIEL'] as const;

/**
 * Matrice des permissions métier, vérifiée côté serveur par chaque service (`assertCan`) et utilisée
 * par le web pour l'affichage seulement. Les lignes « à confirmer » sont provisoires (docs/DECISIONS.md).
 */
export const PERMISSIONS = {
  /**
   * Consulter les fiches (identité, données administratives, équipe, étape calculée) : tout
   * l'encadrement et l'administrateur, qui en assure la gestion administrative (D173). Les données
   * pédagogiques de la fiche relèvent d'autres permissions (`progression.read`…).
   */
  'scout.read': ['ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Gestion administrative d'un routier (D173) : inscrire, compléter ou corriger nom, prénoms,
   * matricule, date de naissance et date d'entrée, désactiver, rattacher un compte. Administrateur et
   * responsable plein **en fonction** seulement (désignation revérifiée au moment de l'écriture).
   * Aucune permission ne permet de choisir l'étape : elle est calculée selon l'âge.
   */
  'scout.create': ADMINISTRATION,
  'scout.update': ADMINISTRATION,
  /**
   * Correction directe d'une donnée administrative (D188) : le responsable plein en fonction
   * corrige sans motif ni confirmation ; la correction reste journalisée (ancienne et nouvelle
   * valeurs, auteur, date). L'administrateur garde le motif et la confirmation (D173).
   */
  'scout.correctDirectly': OFFICIEL,
  'scout.setMatricule': ADMINISTRATION,
  'scout.setActive': ADMINISTRATION,
  'scout.linkAccount': ADMINISTRATION,
  'team.read': ENCADREMENT,
  'team.manage': OFFICIEL,
  'team.assign': OFFICIEL,
  /** Observations d'accompagnement : tout l'encadrement (à confirmer). */
  'observation.create': ENCADREMENT,
  'observation.read': ENCADREMENT,
  /** Lire les observations de niveau « responsable » rédigées par d'autres. */
  'observation.readRestricted': OFFICIEL,
  /** Préparer, distribuer et réimprimer les copies papier (individuelles ou collectives). */
  'attempt.preparePaper': ENCADREMENT,
  /** Copies et réponses saisies, sans corrigé ni note non publiée (D161) : jamais les routiers. */
  'attempt.readAny': ENCADREMENT,
  /** Saisir (transcrire) les réponses d'une copie papier, puis la transmettre pour correction. */
  'attempt.record': ENCADREMENT,
  'attempt.transmit': ENCADREMENT,
  /**
   * Corrigé confidentiel, barèmes, notes non publiées, corrigé et grille PDF (D161) : responsable
   * plein seulement, y compris par appel direct à l'API.
   */
  'attempt.answerKey': OFFICIEL,
  /** Corriger (notes, appréciations) et valider le score final : responsable plein seulement. */
  'attempt.grade': OFFICIEL,
  'attempt.submit': OFFICIEL,
  'attempt.cancel': ENCADREMENT,
  /** Examen d'un résultat corrigé : décision officielle. */
  'attempt.decide': OFFICIEL,
  'attempt.reopen': OFFICIEL,
  /** Dérogations (RM-009). */
  'waiver.manage': OFFICIEL,
  /** Bibliothèque : tout utilisateur pédagogique lit les modules publiés, sans condition d'étape. */
  'module.read': ['ROUTIER', 'ADULTE', 'ENCADREMENT'],
  'module.write': ENCADREMENT,
  'module.writeAny': OFFICIEL,
  /** Approuver, demander des corrections, refuser, publier, archiver. */
  'module.review': OFFICIEL,
  /**
   * Référentiel scout (D220) : créer, renommer, ordonner et retirer les rubriques. Lecture : celle
   * de la bibliothèque (`module.read`) ; ranger une ressource : rédacteur du module (`module.write`).
   */
  'reference.manage': OFFICIEL,
  'evaluation.read': ['ROUTIER', 'ADULTE', 'ENCADREMENT'],
  /** Passer une évaluation : routier (selon son étape) ou adulte (toute évaluation publiée, D185). */
  'evaluation.take': ['ROUTIER', 'ADULTE'],
  /** Ses propres résultats (« Mes résultats »), distincts du parcours Route (D185). */
  'results.readOwn': ['ROUTIER', 'ADULTE'],
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
  /**
   * Référentiel d'âge : règles internes du calcul, réservées au responsable plein en fonction
   * (D176) ; l'adjoint, les assistants, l'administrateur et les routiers n'en voient que le résultat
   * (étape, échéances, sortie prévue).
   */
  'ageRules.read': OFFICIEL,
  'ageRules.manage': OFFICIEL,
  /**
   * Supervision de la progression (D176) : explications internes du calcul, correction
   * exceptionnelle et temporaire de l'étape (créer, lever, historique, motifs). Responsable plein
   * en fonction seulement, revérifié à l'écriture ; jamais l'administrateur technique.
   */
  'progression.supervise': OFFICIEL,
  /** Rattrapages : suivi par l'encadrement ; acquis ou non-applicabilité décidés officiellement. */
  'catchUp.read': ENCADREMENT,
  'catchUp.decide': OFFICIEL,
  /** Appliquer les sorties de branche échues (traitement idempotent, aussi exécuté par la tâche quotidienne). */
  'membership.apply': OFFICIEL,
  /** Composition actuelle de l'encadrement (noms et fonctions) : tout membre connecté. */
  'leadership.read': ['ROUTIER', 'ADULTE', 'ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Désigner le responsable plein, l'adjoint et les assistants, mettre fin à une fonction, consulter
   * l'historique : l'administrateur seul (D132). Jamais le plein pour lui-même.
   */
  'leadership.manage': ['ADMINISTRATEUR'],
  /**
   * Comptes (D119, à confirmer) : l'administrateur gère tous les comptes ; le responsable plein
   * couvre les seuls comptes routiers et adultes (périmètre vérifié par le service, D185).
   */
  /**
   * Fiche médicale personnelle (D135, D191) : tout compte (routier, adulte, encadrement,
   * administrateur) gère la sienne, et seulement la sienne. Distincte de toute permission
   * pédagogique ou administrative : aucune ne donne accès à la fiche d'autrui.
   */
  'medicalRecord.own': ['ROUTIER', 'ADULTE', 'ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Notifications personnelles (D192) : chaque compte consulte et marque lues les siennes, et
   * seulement les siennes (routes `/me/notifications`, aucun identifiant de destinataire).
   */
  'notification.own': ['ROUTIER', 'ADULTE', 'ENCADREMENT', 'ADMINISTRATEUR'],
  /**
   * Entraînement libre (D194) : jouer avec les activités des modules publiés. L'encadrement joue
   * en aperçu, sans rien enregistrer.
   */
  'practice.play': ['ROUTIER', 'ADULTE', 'ENCADREMENT'],
  /**
   * Progression ludique personnelle (D196, D197) : enregistrer ses entraînements et lectures,
   * consulter son carnet (XP, badges, révisions). Titulaire seul, routes `/me/...`.
   */
  'practice.own': ['ROUTIER', 'ADULTE'],
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
      case 'ADULTE':
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
