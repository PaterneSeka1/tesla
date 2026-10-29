# Navigation et permissions (phase 6)

## Principe
L'utilisateur ne choisit jamais d'espace : son rôle (`User.role`, lu par `/auth/me`) détermine son tableau de bord et son menu. La navigation web n'est qu'un confort d'affichage ; l'API reste l'autorité (garde de session globale + `assertCan`, `apps/api/src/common/permissions.ts`).

Source unique côté web : `apps/web/src/lib/navigation.ts` (tests : `navigation.test.ts`).

## Destination par rôle
| Rôle | Tableau de bord (`DEFAULT_ROUTES`) |
| --- | --- |
| ROUTIER | `/routier` |
| CHEF | `/chef` |
| RESPONSABLE | `/responsable` |

`getDefaultRouteForUser(user)` et `resolvePostLoginPath(user, suivant)` : la page demandée (`?suivant=`) n'est conservée que si elle est interne (`safeInternalPath`) **et** autorisée au rôle (`canAccessPath`) ; sinon, tableau de bord du rôle.

## Redirections
| Situation | Comportement |
| --- | --- |
| Connexion réussie | `resolvePostLoginPath` (page demandée autorisée, sinon tableau de bord) |
| `/` avec cookie de session | Proxy → `/connexion`, qui oriente un utilisateur connecté vers son tableau de bord |
| `/` sans cookie | Accueil public (aucun lien vers des espaces, un seul bouton « Se connecter ») |
| `/connexion` avec session valide | Redirection immédiate (squelette de chargement pendant la vérification) |
| `/connexion` avec session expirée ou API injoignable | Formulaire affiché (jamais redirigée par le proxy : pas de boucle) |
| Page connectée sans cookie | Proxy → `/connexion?suivant=<page>` |
| Session expirée en cours d'usage | Toute réponse 401 d'une requête ou mutation relit `/auth/me` (`Providers`) ; `SessionGate` renvoie vers `/connexion?suivant=<page>` |
| Chemin non autorisé au rôle | `SessionGate` affiche une notification « Page non accessible avec votre rôle » et renvoie au tableau de bord (jamais vers un chemin lui-même refusé : testé) |
| Réseau indisponible | `SessionGate` affiche l'erreur, « Réessayer » et un lien vers les contenus hors ligne |

## Accès par chemin (`ACCESS_RULES`)
La règle la plus précise l'emporte (règle exacte, puis préfixe le plus long ; `/evaluations` n'ouvre pas `/evaluations-a-valider`).

| Chemin | Rôles |
| --- | --- |
| `/modules` | tous |
| `/routier`, `/evaluations`, `/mes-resultats`, `/progression`, `/mes-competences`, `/mes-activites`, `/hors-ligne` (+ alias `/telechargements`, `/synchronisation`) | ROUTIER |
| `/chef/*`, `/administration/*` | CHEF, RESPONSABLE |
| `/chef` (exact) | CHEF (le responsable a son propre tableau de bord) |
| `/responsable`, `/administration/{modules-a-valider, modules, historique-publications, evaluations, evaluations-a-valider, deblocages}` | RESPONSABLE |

## Utilisateurs à plusieurs responsabilités
Analyse du modèle : `User.role` est unique, mais la matrice API est **hiérarchique** : RESPONSABLE détient toutes les permissions de CHEF (`module.write`, `evaluation.write`, `attempt.preparePaper`, `attempt.record`, `observation.create`, `activity.manage`, `competency.propose`, etc.). Un responsable qui rédige, prépare une évaluation papier ou corrige le fait donc avec son unique compte et son unique menu, sans changer d'espace.

Aucun modèle multirôle n'est introduit (D86). Il ne deviendrait nécessaire que pour un cas non couvert par la hiérarchie, par exemple un chef qui serait aussi routier évalué. Migration proposée dans ce cas, **non réalisée** : table `UserRole(userId, role)`, `Actor.roles[]`, `can()` testant l'intersection. Conséquences : session et `/auth/me` à faire évoluer, contrat `meResponseSchema` modifié, tests de permissions à réécrire, menu fusionné. À valider par le responsable avant toute réalisation.

## Menus (`NAVIGATION`)
- **Routier** : *Mon parcours* (tableau de bord, progression, compétences, activités) · *Apprendre* (modules, évaluations, résultats, hors ligne). Mobile : barre inférieure de 4 accès rapides + menu latéral.
- **Chef** : *Pilotage* (tableau de bord, statistiques, programme) · *Suivi des routiers* (routiers, équipes, activités, présences, propositions de validation) · *Rédaction et correction*, repliable (rédaction, questionnaires, papier, corrections, soumissions, bibliothèque).
- **Responsable** : *Pilotage* · *Validation des contenus* (modules, questionnaires) · *Décisions sur les routiers* (résultats, acquis, déblocages) · *Communauté* · *Rédaction et correction*, repliable · *Référentiels*, repliable (tous les modules, compétences, publications, bibliothèque). Les validations de contenus et de personnes sont deux groupes distincts.
- Groupes repliables (D92) : `<details>` natif, repliés par défaut, ouverts lorsqu'ils contiennent la page affichée. Le groupe du tableau de bord n'est jamais repliable (vérifié par `navigation.test.ts`).

Entrées demandées mais absentes faute d'écran (règle : aucune entrée vers un écran inexistant) : « Mon profil », « Utilisateurs et accès », « Paramètres ». Les entrées « Téléchargements » et « Synchronisation » (même page) sont fusionnées en « Hors ligne » ; les anciennes URL restent valides.

## Cadre
Un seul `DashboardShell`, monté par `(espaces)/layout.tsx` : il n'est plus remonté à chaque changement de section. Desktop : sidebar groupée, état du serveur, profil et déconnexion en pied. Mobile et tablette (< 1024 px) : en-tête compact (menu, logo, titre de la page), menu latéral (Radix Dialog : focus piégé, Échap, cibles de 44 px).
