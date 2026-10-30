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
| `OFFICIEL` | **responsable plein en fonction** uniquement : approbations, publication, examen des résultats, déblocages, validations, fiches, équipes, étapes, rattrapages, comptes routiers |
| `ADMINISTRATEUR` | administrateur de la plateforme : comptes, désignation de l'encadrement ; aucun droit pédagogique |

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

## Menu unique (`NAVIGATION`)
Rubriques, dans l'ordre ; `navigationFor(user)` retire les entrées non autorisées et les rubriques vides :
*Accueil* · *Mon parcours* (progression, rattrapages, compétences, activités, résultats) · *Formations* (bibliothèque, évaluations) · *Suivi pédagogique* (statistiques, programme annuel, résultats à examiner, acquis et propositions, déblocages) · *Communauté* (encadrement, routiers, équipes, activités, présences) · *Contenus à approuver* · *Rédaction et correction* (repliable) · *Référentiels* (repliable) · *Administration* (comptes). « Mon compte » est dans le menu utilisateur.

Exemples : un routier voit Accueil, Mon parcours, Formations, Communauté (encadrement) ; un adjoint ou un assistant le même menu que tout l'encadrement ; le plein, en plus, les contenus à approuver et les décisions ; l'administrateur Accueil, Encadrement et Comptes.

Règles vérifiées par `navigation.test.ts` : aucune entrée vers une page inexistante ou inaccessible, aucune entrée en double, accueil toujours en tête et jamais replié, aucun libellé contenant un rôle technique, « mandat », « délégation », « espace », « rôle » ou « chef » ; anciennes pages absentes et redirigées. Barre inférieure mobile (4 accès) pour qui suit un parcours personnel. Groupes repliables : `<details>` natif (D92).

## Cadre
Un seul `DashboardShell`, monté par `(espaces)/layout.tsx` : il n'est plus remonté à chaque changement de section. Desktop : sidebar groupée, nom de l'utilisateur et déconnexion en pied (aucun état technique, D108). Mobile et tablette (< 1024 px) : en-tête compact (menu, logo, titre de la page), menu latéral (Radix Dialog : focus piégé, Échap, cibles de 44 px).
