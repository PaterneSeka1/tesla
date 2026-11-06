# Navigation et permissions (application unique, 2026-10-30)

Décisions : D132–D134 (remplacent D105 et la partie « délégations » de D94). Encadrement : [ENCADREMENT.md](ENCADREMENT.md).

## Principe
TESLA est **une seule application**. L'utilisateur ne choisit jamais d'espace et ne voit jamais de rôle technique (`ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR`), de libellé de permission, de mandat ni de délégation. Ce qu'il voit — entrées du menu, pages, blocs de l'accueil — découle uniquement de ses **permissions effectives** (`/auth/me` → `permissions`), calculées par l'API à chaque requête à partir du rôle d'accès interne et de la fonction d'encadrement en cours.

La navigation web n'est qu'un confort d'affichage ; l'API reste l'autorité (garde de session globale + `assertCan`, `apps/api/src/common/permissions.ts`, matrice `packages/shared/src/permissions.ts`).

Source unique côté web : `apps/web/src/lib/navigation.ts` (tests : `navigation.test.ts`).

## Permissions internes
| Niveau (jamais affiché) | Qui |
| --- | --- |
| `ROUTIER` | compte routier : parcours personnel, bibliothèque, passation |
| `ENCADREMENT` | tout membre de l'encadrement (plein, adjoint, assistant, ou sans fonction) : consultation, rédaction, correction, observations, propositions, activités |
| `OFFICIEL` | **responsable plein en fonction** uniquement : approbations, publication, examen des résultats, déblocages, validations, équipes, rattrapages, comptes routiers ; gestion administrative des fiches routiers (avec l'administrateur) |
| `ADMINISTRATEUR` | administrateur de la plateforme : comptes (dont les chefs), désignation de l'encadrement, **gestion administrative des fiches routiers** (D173 : consultation, inscription, complétion, correction) ; aucun droit pédagogique |

Aucune permission ne permet de choisir une étape : elle est calculée selon l'âge (D173). Les écritures réservées au plein revérifient sa désignation dans leur transaction (`assertCanAtWrite`).

`leadership.read` (composition de l'encadrement) : tout membre connecté. `leadership.manage` : administrateur.

## Destination
Une seule page d'arrivée, `HOME_ROUTE = '/accueil'`, pour tous. `resolvePostLoginPath(user, suivant)` conserve la page demandée si elle est interne (`safeInternalPath`) **et** autorisée (`canAccessPath`), sinon l'accueil.

Anciennes adresses (`next.config.ts`) : `/routier`, `/encadrement`, `/chef`, `/responsable` → `/accueil` ; `/chef/*` → `/encadrement/*` ; `/mandats` → `/communaute` ; `/telechargements`, `/synchronisation` → `/appareil`.

## Accueil (`HomeDashboard`)
Blocs composés selon les permissions, à partir des composants existants :
- parcours personnel (`progression.readOwn`) : progression, modules recommandés, évaluations, rattrapages, résultats ;
- suivi de l'encadrement (`progression.read`) : routiers à accompagner, corrections, activités, observations — enrichi, pour le plein (`dashboard.official`), des contenus à approuver, résultats à examiner, validations et décisions en attente ;
- administration (`leadership.manage`) : composition de l'encadrement (alerte si aucun plein), accès à la gestion de l'encadrement et aux comptes.

## Redirections
| Situation | Comportement |
| --- | --- |
| Connexion réussie | `resolvePostLoginPath` (page demandée autorisée, sinon accueil) — aucun écran de choix |
| `/` avec cookie de session | Proxy → `/connexion`, qui oriente un utilisateur connecté vers l'accueil |
| `/` sans cookie | Accueil public, un seul bouton « Se connecter » |
| Page connectée sans cookie | Proxy → `/connexion?suivant=<page>` |
| Session expirée en cours d'usage (401) | `/auth/me` relu (`Providers`) ; `SessionGate` renvoie vers `/connexion?suivant=<page>` |
| Droit retiré en cours d'usage (403, ex. remplacement du plein) | `/auth/me` relu : menu et pages suivent immédiatement les nouvelles permissions |
| Chemin non autorisé | `SessionGate` : « Cette page ne vous est pas accessible », retour à l'accueil |
| Réseau indisponible | Identité locale (voir [OFFLINE_FIRST.md](../OFFLINE_FIRST.md)), menu du parcours personnel |

## Accès par chemin (`ACCESS_RULES`)
Règle la plus précise (exacte, puis préfixe le plus long). Un chemin sans règle est refusé. Aucune règle par rôle : uniquement « au moins une de ces permissions ».

| Chemin | Permission |
| --- | --- |
| `/accueil`, `/communaute`, `/compte`, `/appareil` | tout utilisateur connecté |
| `/modules` | `module.read` |
| `/evaluations` | `evaluation.take` |
| `/progression`, `/mes-resultats`, `/mes-rattrapages`, `/mes-competences`, `/mes-activites` | `progression.readOwn` |
| `/encadrement/*` | `module.write` ; `/encadrement/evaluations` : `evaluation.write` ; `…/papier` : `attempt.preparePaper` ; `/encadrement/corrections` : `attempt.record` |
| `/administration/*` | `scout.read` ; statistiques `statistics.read` ; activités `activity.read` ; présences `attendance.record` ; compétences et validations `competency.read` ; référentiel d'âge `ageRules.read` ; comptes `account.read` |
| `/administration/{modules-a-valider, modules, historique-publications}` | `module.review` |
| `/administration/evaluations` | `evaluation.review` |
| `/administration/evaluations-a-valider` | `attempt.decide` |
| `/administration/deblocages` | `waiver.manage` |

Les préfixes d'URL `/encadrement` et `/administration` sont techniques et ne sont présentés nulle part comme des espaces (D134).

## Menu unique (`NAVIGATION`, D141)
Rubriques, dans l'ordre ; `navigationFor(user)` retire les pages non autorisées et les rubriques vides. Chaque rubrique est **une seule entrée** du menu, vers sa première page autorisée ; ses autres pages s'affichent en dessous lorsque la page affichée lui appartient (`findActiveGroup`).

| Rubrique | Pages (selon permissions) |
| --- | --- |
| Accueil | accueil commun |
| Routiers | routiers, équipes, activités, présences, acquis et propositions, statistiques, programme annuel, référentiel de compétences, référentiel d'âge |
| Cours | bibliothèque, rédaction, mes soumissions, cours à approuver, tous les cours, publications |
| Évaluations | évaluations (routier), questionnaires (dont « Résultats »), corrections, évaluations papier, résultats à examiner, questionnaires à approuver, déblocages |
| Mon parcours | progression, rattrapages, résultats, compétences, activités |
| Mon profil | mon profil (identité, progression, connexion et mot de passe, **fiche médicale** sauf administrateur), encadrement (sauf administrateur) |
| Administration | comptes, encadrement (administrateur : désignation, D142) |

Résultat : routier — Accueil, Cours, Évaluations, Mon parcours, Mon profil ; encadrement (adjoint, assistants compris) — Accueil, Routiers, Cours, Évaluations, Mon profil ; plein — idem + Administration (comptes routiers) ; administrateur — Accueil, Mon profil (compte seul), Administration (comptes, encadrement). Une entrée peut être masquée pour qui détient une permission (`hiddenWith`) afin de ranger une page dans une autre rubrique.

Règles vérifiées par `navigation.test.ts` : rubriques exactes par profil, aucune entrée vers une page inexistante ou inaccessible, aucune entrée en double par personne, accueil toujours en tête, rubrique active, aucun libellé contenant un rôle technique, « mandat », « délégation », « espace », « rôle » ou « chef » ; anciennes pages absentes et redirigées. Barre inférieure mobile du routier : 5 accès (Accueil, Cours, Évaluations, Parcours, Profil).

## Cadre
Un seul `DashboardShell`, monté par `(espaces)/layout.tsx` : il n'est plus remonté à chaque changement de section. Desktop : sidebar groupée, nom de l'utilisateur et déconnexion en pied (aucun état technique, D108). Mobile et tablette (< 1024 px) : en-tête compact (menu, logo, titre de la page), menu latéral (Radix Dialog : focus piégé, Échap, cibles de 44 px).
