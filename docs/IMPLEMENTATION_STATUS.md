# État d'implémentation

Dernière mise à jour : 2026-10-30 — **gouvernance simplifiée et application unique** (mandats supprimés, encadrement désigné par l'administrateur, menu et accueil uniques), voir [§ Gouvernance](#gouvernance-simplifiée-et-application-unique-2026-10-30) ; 2026-10-30 — **bibliothèque de formation à la Route** (catalogue initial, textes fondamentaux, duplication), voir [§ Bibliothèque](#bibliothèque-de-formation-à-la-route-2026-10-30) et [CATALOGUE_PEDAGOGIQUE_INITIAL.md](CATALOGUE_PEDAGOGIQUE_INITIAL.md) ; 2026-10-30 — **préparation à la production** (comptes, sécurité, exploitation, CI), voir [§ Préparation à la production](#préparation-à-la-production-2026-10-30) et [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; 2026-10-30 — **offline-first global** (une seule application avec ou sans réseau, préparation de l'appareil, file de synchronisation, conflits), voir [§ Offline-first](#offline-first-global-2026-10-30) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; 2026-10-29 — **sobriété des interfaces** (textes, libellés et état serveur), voir [§ Sobriété](#sobriété-des-interfaces-2026-10-29) ; **refonte parcours Route et mandats** (âge, rattrapages, sortie à 21 ans ; mandats remplacés le 2026-10-30), voir [§ Refonte](#refonte--parcours-route-et-mandats-2026-10-29) ; parcours de l'encadrement (file « À faire », frise de l'année, menu allégé), voir [§ Parcours encadrement](#parcours-du-responsable-et-des-chefs-2026-10-29) ; phase 6 (navigation par rôle, UX, audit ESLint), voir [§ Phase 6](#phase-6--navigation-par-rôle-ux-et-stabilisation-2026-10-29) ; seed des modules « Bases du scoutisme » (brouillons), voir [§ Seed pédagogique](#seed-pédagogique--bases-du-scoutisme-2026-10-29) ; phase 5 (hors ligne) livrée, voir [§ Phase 5](#phase-5--pwa-hors-ligne-2026-10-29) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; phase 4 livrée en complément de la phase 3 ; voir [rapport de livraison](FEATURES/PHASE_4_REPORT.md). Phase 3 (évaluations : questionnaires, passation en ligne, papier, correction, examen des résultats). Détails fonctionnels : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md), [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo, lint, typecheck, tests, build | Les quatre commandes racine passent (2026-10-29, après la phase 3) |
| API : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `/health` |
| PostgreSQL 18 (Docker, port 5433), Prisma 7, 6 migrations | `db:deploy` sur la base de développement et `tesla_test` ; diff base ↔ schéma vide ; migration 6 rejouée sur une base jetable avec données historiques |
| **Authentification** : login/logout/me, Argon2id, sessions httpOnly, expiration, révocation, limitation, CSRF, garde globale | Tests unitaires + intégration HTTP ; recette navigateur |
| **Équipes, routiers, affectations, observations** (phase 1) | Intégration HTTP ; recette navigateur (phase 1) |
| **Modules, rédaction, workflow, bibliothèque** (phase 2) | Intégration HTTP ; recette navigateur (phase 2) ; suite rejouée sans régression |
| **Questionnaires** : 5 types de questions, barèmes, crédit partiel, versions, workflow d'approbation, publication atomique, cohérence avec le module (migration `20261030090000_evaluation_engine`) | Intégration HTTP + triggers ; recette navigateur |
| **Passation en ligne** : éligibilité serveur, déblocages, démarrage idempotent, sauvegarde, remise unique, correction objective | Intégration HTTP (dont requêtes concurrentes) ; recette mobile 390 px |
| **Papier** : routier sans compte, codes `NT-AAAA-NNNNNN` sous concurrence, réimpression sans tentative, PDF questionnaire / corrigé / grille | Intégration HTTP (texte des PDF contrôlé) ; recette ; rendu visuel des trois PDF |
| **Correction et examen** : notation humaine, révision optimiste, soumission, acceptation, nouvelle correction motivée, aucun changement d'étape | Intégration HTTP ; recette |
| **Historique du routier** (`/mes-resultats`) et résultats conservés après une nouvelle publication | Intégration HTTP ; recette |

### Tests exécutés (2026-10-29)
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 81 tests (15 fichiers, dont 27 pour les évaluations : contrats, moteur de correction, éligibilité), web 9 tests (2 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (base `tesla_test`) : 47 tests (4 fichiers) — réussis. Nouveau fichier `test/evaluations.int-spec.ts` (5 tests couvrant les 20 exigences de la phase et les deux parcours) ; `test/scouts-evaluations.int-spec.ts` adapté au nouveau modèle (15 tests, mêmes garanties).
- Recette navigateur (script hors dépôt, Chromium headless, API et web de production locaux sur la base jetable `tesla_test`, comptes fictifs) — 23 contrôles réussis : création d'un questionnaire et de deux questions par un chef, soumission, approbation refusée au chef (403), approbation et publication par le responsable ; routier : liste, éligibilité, passation mobile 390 px sans corrigé dans la page, remise ; correction automatique de la question objective, notation de la réponse libre, soumission ; examen et acceptation ; résultat visible dans « Mes résultats » ; papier : routier sans compte, code unique, PDF téléchargé et réimprimé sans nouvelle tentative, corrigé refusé à un routier, saisie et correction, examen, étape inchangée ; trois écrans sans défilement horizontal à 390 px. Deux défauts trouvés par la recette et corrigés (changement de type de question, relance du démarrage après remise). Aucune donnée ajoutée à la base de développement.

## Partiel ou non vérifié
- **Lecteurs d'écran, contraste mesuré** : non audités avec un outil dédié.
- **Navigateurs réels (Safari iOS, Android)** : non testés ; seulement Chromium headless.
- **Swagger** : documentation générée ; rendu de `/api/docs` non revu manuellement.
- **PDF** : caractères hors Windows-1252 remplacés par « ? » ; questionnaire de plusieurs pages non recetté visuellement.
- **Avertissement `pg`** « client.query() when the client is already executing a query » émis pendant certains tests d'intégration (interpréteur de requêtes de Prisma 7) ; sans effet aujourd'hui ; à surveiller avant `pg@9`.
- **CI GitHub Actions** : intégration, migrations et recettes configurées (2026-10-30) ; non exécutée (aucun push).
- `REFUSEE` et la réouverture d'un résultat examiné : disponibles dans l'API, sans bouton dans les écrans.

## Non développé
Envoi des liens de compte par e-mail, changement de rôle d'accès d'un compte, téléversement des copies numérisées, support de cours en PDF serveur, progression de lecture synchronisée avec le serveur, consultation du journal d'audit complet, déploiement. Voir [ROADMAP.md](ROADMAP.md).

## Phase 4 — progression, compétences, activités et pilotage (2026-10-29)

- Dossier pédagogique complet et historique immuable des étapes, avec décisions transactionnelles du responsable et corrections tracées.
- Référentiel de compétences administrable, propositions justifiées, complément/refus/approbation réservés au responsable, révocation motivée. Aucun acquis automatique.
- Modules étudiés (papier, collectif et numérique), routiers avec ou sans compte ; déclarations personnelles explicites.
- Programme annuel : catégories distinctes des étapes, correspondances à confirmer, import Markdown prévisualisé et idempotent, conservation des modifications manuelles.
- Activités : préparation, réalisation/report/annulation, compte rendu, liens vers modules et compétences, historique ; présences groupées, sans absence implicite.
- Tableaux de bord par rôle, statistiques filtrées par équipe, étape et période ; parcours personnels progression/compétences/activités.
- Sept migrations synchronisées sur les bases locales `tesla` et `tesla_test` ; aucune réinitialisation de la base de développement. Références initialisées sans compte de démonstration. Diff Prisma/base vide.

Détails fonctionnels et vérifications : [rapport de livraison](FEATURES/PHASE_4_REPORT.md), [progression](FEATURES/PROGRESSION.md), [compétences](FEATURES/COMPETENCES.md), [programme](FEATURES/PROGRAMME_ANNUEL.md), [activités](FEATURES/SUIVI_ACTIVITES.md), [tableaux de bord](FEATURES/DASHBOARDS.md).

Limites : source officielle des séances absente du dépôt ; référentiel de compétences et correspondances à valider humainement. Gestion structurée séparée des actions d'accompagnement à échéance (les observations et propositions restent utilisables). Le build Turbopack est bloqué par l'environnement ; compilation Webpack vérifiée. Le seuil d'affichage des absences reste provisoire (D74).

Vérifications phase 4 : lint et types réussis ; 106 tests API et 9 web réussis ; suite PostgreSQL 61 tests réussis, puis 14 scénarios phase 4 rejoués après le correctif du compte rendu ; build API et web Webpack réussis ; recette Chromium mobile : 19 contrôles réussis. Détails et limites dans le rapport.

## Phase 5 — PWA hors ligne (2026-10-29)

Implémenté (détails : [OFFLINE_FIRST.md](OFFLINE_FIRST.md), décisions D76–D83) :
- Coffre IndexedDB v2 chiffré (AES-GCM, phrase locale), un enregistrement par module et par tentative, révision optimiste entre onglets, verrouillage à la déconnexion et entre onglets.
- Téléchargement de tout module publié : paquet versionné avec empreinte SHA-256, images bornées, ressources externes signalées indisponibles, écriture atomique, suppression locale, vérification et mise à jour explicite des versions.
- Lecture hors ligne : leçons, navigation, images, références, position de lecture.
- Évaluations : préparation serveur (éligibilité, dérogation, limite, tentative ouverte), réservation `HORS_LIGNE` de 24 h sans corrigé, saisie et reprise locales, remise locale immuable.
- Synchronisation : file persistante bornée (6 envois automatiques, 5 s × 2ⁿ ≤ 30 min), déclenchements réseau/ouverture/premier plan/manuel ; réception transactionnelle et idempotente, revérification des droits, correction serveur, conflits et rejets motivés ; écrans de statut.
- Service worker `v2` : coquille `/hors-ligne` pré-cachée, `/api` et `/connexion` exclus. Relance des requêtes en erreur au retour du réseau (défaut trouvé par la recette).
- Migration additive `20261101090000_offline_reservations`, appliquée sur `tesla` et `tesla_test` ; diff schéma ↔ base vide.

Vérifications exécutées :
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web, Turbopack) : réussis. `prettier --check` : seul `apps/api/prisma/seed.ts` signalé, fichier antérieur non modifié.
- `npm run test` : API 106 tests (16 fichiers), web 13 tests (3 fichiers, dont 4 hors ligne : schéma strict refusant un score, extraction d'images, SHA-256, temporisation) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 65 tests (5 fichiers) réussis, dont 3 scénarios hors ligne (+1 paquet de module) : préparations concurrentes, absence de corrigé, chef refusé, autre routier refusé, passation en ligne refusée, schéma invalide, conflit de paquet, double envoi concurrent sans doublon, autre copie refusée, correction serveur, étape inchangée, statut personnel, session expirée (401), hors progression refusé, dérogation valide puis révoquée, autorisation expirée, nouvelle publication sans effet sur la version réservée.
- Recette navigateur `apps/web/test/offline.browser.mjs` (fixture `apps/api/test/offline-browser-fixture.mts`, API et web de production locaux sur `tesla_test`, Chromium headless Playwright 1.64.1, fenêtre 390 px) : **13 contrôles réussis** — activation du coffre, téléchargement, préparation, cache sans API ni connexion, saisie sans réseau, fermeture puis réouverture hors réseau, remise locale immuable, lecture et position conservées, verrouillage et mauvaise phrase, reconnexion et synchronisation répétée sans doublon, absence de texte en clair dans IndexedDB, suppression du module sans perte de copie, déconnexion verrouillant les données, pas de défilement horizontal.

Non vérifié ou non couvert par un test automatisé :
- Appareils réels et navigateurs autres que Chromium headless (Chrome Android, Safari iOS, Edge, Firefox) ; installation PWA ; éviction du stockage ; redémarrage complet du navigateur (seule la fermeture/réouverture d'onglet est testée).
- Téléchargement interrompu, image en échec, quota insuffisant et erreur serveur 5xx temporaire : logique implémentée, sans test automatisé dédié.
- Proposition de mise à jour d'un module téléchargé : non recettée dans le navigateur.
- Arbitrages D78 (durée, rejet ou mise en attente, conservation serveur des copies rejetées) et ouverture du mode hors ligne aux chefs.
- Playwright n'est pas une dépendance du dépôt (exécutable fourni par variable d'environnement) ; recette non intégrée à la CI.

## Seed pédagogique « Bases du scoutisme » (2026-10-29)

Implémenté (détails : [SEEDS_PEDAGOGIQUES.md](SEEDS_PEDAGOGIQUES.md), décisions D84–D85) :
- Quatre modules `NT-SCOUT-M01` à `M04`, 21 leçons (8 vides, à rédiger), étapes recommandées Noviciat/Apprentissage, tous en `BROUILLON`, créés par le système (auteur nul), jamais approuvés ni publiés ; aucun questionnaire créé.
- Import transactionnel par module, réexécution sans écriture avec rapport d'écarts, prévisualisation `--dry-run`, commandes `npm run db:seed` et `npm run db:seed:pedagogy`.
- Migration additive `20261102090000_module_source_imports` appliquée sur `tesla` et `tesla_test` ; diff schéma ↔ base vide. Seed exécuté sur `tesla` (4 créations), puis réexécuté (aucune écriture).
- Provenance et notes éditoriales visibles dans l'éditeur et la révision, absentes de la bibliothèque, du paquet hors ligne et de l'impression.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 115 tests (17 fichiers, dont 9 pour la définition du seed), web 13 tests — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis, dont 6 nouveaux (`test/pedagogy-seed.int-spec.ts`) : quatre modules en brouillon et ordre des leçons, aucun accès routier, prévisualisation sans écriture, réexécution sans doublon ni écriture, modification du responsable conservée, leçon vide bloquant la soumission, publication humaine non remplacée et écarts de source signalés, slug occupé, CHECK et trigger d'ajout seul.
- Contrôle ponctuel (hors dépôt) : chaque texte de leçon retrouvé dans le texte extrait du PDF, hors ajouts éditoriaux listés.

Non vérifié : rendu visuel de l'encart de provenance (pas de recette navigateur) ; transcription de l'alphabet Morse relue à l'œil uniquement ; manuel SAPF-Route et programme annuel absents du dépôt.

## Phase 6 — navigation par rôle, UX et stabilisation (2026-10-29)

Implémenté (détails : [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md), [QUALITY/UX_UI_AUDIT.md](QUALITY/UX_UI_AUDIT.md), [QUALITY/ESLINT_AUDIT.md](QUALITY/ESLINT_AUDIT.md), décisions D86–D90) :
- Orientation automatique par rôle (`lib/navigation.ts`) : connexion, `/`, `/connexion` déjà connecté, rechargement, session restaurée ; `?suivant=` limité aux pages internes autorisées ; route non autorisée → notification et tableau de bord ; session expirée en cours d'usage → connexion avec retour.
- Menu unique groupé par rôle et cadre commun (`(espaces)/layout.tsx`) : sidebar desktop, menu latéral mobile, barre d'accès rapides du routier. Écran de choix d'espace supprimé.
- Aucun modèle multirôle : le responsable dispose déjà de toutes les permissions des chefs (D86).
- Tableaux de bord refondus sur les données réelles de l'API ; titres de page en `h1` ; service worker `v3`.
- Lint : 1 erreur → 0 (aucune règle désactivée).
- Aucune modification de l'API ni du schéma ; aucune migration.

Vérifications exécutées :
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 115 tests (17 fichiers), web 40 tests (4 fichiers, dont 27 nouveaux dans `navigation.test.ts` : destination par rôle, absence de boucle, accès par chemin, redirections externes refusées, entrées de menu existantes, autorisées et sans doublon).
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis.
- Recette navigateur (script hors dépôt, Chromium headless, API et web de production sur `tesla_test`, comptes fictifs) : **21 contrôles réussis** — accueil sans choix d'espace ; routier, chef et responsable dirigés vers leur tableau de bord ; rechargement ; `/` et `/connexion` déjà connecté ; route interdite ; menu mobile et barre d'accès rapides ; retour navigateur ; écran hors ligne ; déconnexion puis accès direct ; `?suivant=` interdit ignoré, autorisé conservé ; responsable sur les écrans des chefs sans changement de menu ; accès direct par URL ; 390 px et 820 px sans défilement horizontal ; session révoquée côté serveur puis reconnexion vers la page demandée ; aucune erreur JavaScript.
- Recette hors ligne `apps/web/test/offline.browser.mjs` rejouée : 13 contrôles réussis (étape de déconnexion adaptée au menu latéral mobile).

Non vérifié : appareils réels (Android, iOS), lecteurs d'écran, contraste mesuré ; parcours métier complets (création de module, approbation, correction) seulement couverts par les tests d'intégration API et non rejoués dans le navigateur pendant cette phase ; « Mon profil », « Utilisateurs et accès » et « Paramètres » non développés.

## Parcours du responsable et des chefs (2026-10-29)

Implémenté (détails : [FEATURES/DASHBOARDS.md](FEATURES/DASHBOARDS.md), [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md), décisions D91–D92) :
- `/responsable` et `/chef` : bandeau d'accueil, actions rapides, file « À faire maintenant » (éléments réels avec ancienneté et lien vers l'écran qui porte l'action), frise de l'année (programme, jalons, prochaine activité) ; indicateurs en bas de page.
- API : champs `tasks`, `taskTotal` et `year` ajoutés aux deux tableaux de bord (ajout compatible ; aucune migration, aucune nouvelle permission).
- Menu : groupes secondaires repliables ; séparation contenus / personnes conservée.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 115 tests (17 fichiers), web 44 tests (4 fichiers, dont `formatWaiting` et le groupe du tableau de bord jamais repliable) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis, dont les nouvelles assertions sur `tasks` (types, tri, périmètre du chef) et `year` (activités hors programme exclues des jalons, prochaine activité).

Non vérifié :
- Recette navigateur (rendu desktop et 390 px, repli du menu au clavier) : non exécutée.
- Tâches « module / questionnaire renvoyé » et « copie papier » : couvertes par le typage, sans test d'intégration dédié.
- Frise avec un programme réel importé : non recettée visuellement.

## Accueil, connexion et animations (2026-10-29)

Implémenté : accueil et connexion refondus ; animations CSS (`globals.css` : `animate-rise`, `animate-halo`, `animate-drift`, `animate-shake`, `animate-pop`, `animate-grow`, conteneur `.stagger`) sur toutes les tailles d'écran ; `PageTransition` dans le cadre connecté ; menu, barre du routier, boutons, alertes, lignes de tableau et états vides animés. `PasswordInput` (afficher/masquer) sur la connexion et la phrase du coffre hors ligne. Aucune modification de l'API.

Vérifications exécutées : `npm run lint`, `npm run typecheck`, tests web (44) et build web réussis. Captures Chromium headless (serveur de production local, sans API) de l'accueil et de la connexion en 390 px et 1366 px : aucun défilement horizontal, bascule d'affichage du mot de passe fonctionnelle, alerte affichée lorsque l'API est injoignable ; bascule afficher/masquer contrôlée sur `/connexion` et `/hors-ligne` (type du champ et `aria-pressed`).

Non vérifié : animations des écrans connectés (cadre, tableaux de bord, menu latéral) dans un navigateur ; appareils réels ; fluidité sur téléphone d'entrée de gamme.

## Refonte — parcours Route et mandats (2026-10-29)

Branche `feat/refonte-parcours-route-mandats`. Détails : [REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) (audit, matrice de traçabilité), [FEATURES/PROGRESSION_PAR_AGE.md](FEATURES/PROGRESSION_PAR_AGE.md), [FEATURES/RATTRAPAGE.md](FEATURES/RATTRAPAGE.md), [FEATURES/MANDATS_RESPONSABLES.md](FEATURES/MANDATS_RESPONSABLES.md), décisions D93–D107.

Implémenté :
- Moteur d'âge pur et déterministe (Abidjan, 29 février, mois calendaires), référentiel d'âge versionné et figé, version `2026.1` limitée aux deux règles fournies.
- Étape théorique, étape officielle et écart distincts ; échéances ; sortie à 21 ans calculée à la lecture et enregistrée par un traitement idempotent (`MembershipService`, `npm run jobs:daily -w @tesla/api`), historique intégralement conservé.
- Plans de rattrapage idempotents, statuts calculés, décision humaine motivée ; éligibilité `ELIGIBLE_RATTRAPAGE` et `SORTI_BRANCHE`.
- Rôles d'accès `ROUTIER`/`ENCADREMENT`/`ADMINISTRATEUR`, fonctions par mandats annuels (un seul plein, reconductions illimitées et explicites, fins anticipées, changements de fonction), délégations ; permissions recalculées à chaque requête, exposées par `/auth/me`.
- Typologie des modules (catégorie, obligation, source officielle) dans le workflow existant ; catalogue « Découvrir la Route » (21 brouillons, aucun contenu inventé).
- Web : espace unique `/encadrement` (anciennes URL redirigées), menu filtré par permissions, `/mandats`, `/mes-rattrapages`, `/administration/referentiel-age`, bloc « Mon parcours », section parcours de la fiche, indicateurs de parcours, filtre de catégorie de la bibliothèque, formulaire de typologie.
- Deux migrations additives appliquées sur une copie (`tesla_refonte_check`), puis `tesla_test` et `tesla` ; diff schéma ↔ base vide. Seed exécuté sur `tesla` (référentiel `2026.1`, 21 brouillons), réexécution sans écriture vérifiée.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 146 tests (18 fichiers ; nouveaux : moteur d'âge, statut et origine des rattrapages, écart d'étapes, éligibilité, fonctions et délégations, synchronisation des enums), web 57 tests (4 fichiers ; navigation réécrite pour les nouveaux profils) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **79 tests (7 fichiers) réussis**, dont 71 existants adaptés au nouveau modèle et 8 nouveaux (`test/refonte.int-spec.ts`) : reprise des anciens comptes sans droit officiel, un seul plein (service et contrainte), auto-nomination refusée, dix reconductions successives, retour d'un ancien plein, immutabilité, fin anticipée et perte immédiate des droits, changement de fonction, délégation limitée et révocation, étape théorique sans et avec référentiel, inscription tardive et rattrapage idempotent, décision humaine, sortie à 21 ans (veille/jour, idempotence, historique conservé), typologie et catalogue sans doublon ni exposition aux routiers.

Non vérifié :
- **Recette navigateur** des nouveaux écrans (`/mandats`, `/mes-rattrapages`, fiche, tableau de bord, bibliothèque) : non exécutée ; rendu mobile non contrôlé visuellement.
- Traitement `jobs:daily` : non exécuté en conditions réelles (logique couverte par les tests d'intégration via `MembershipService` et `PathwayService`) ; aucune planification (cron) installée.
- Création d'un référentiel d'âge par l'interface : API seulement (pas de formulaire web).
- Libellés « chef » / « responsable » subsistant dans certains textes d'écrans antérieurs (sens inchangé : encadrement / personne habilitée).
- Base jetable `tesla_refonte_check` laissée en place (suppression non effectuée sans autorisation).

### Mise en service
1. Sauvegarder la base, puis `npm run db:deploy -w @tesla/api` (deux migrations, additives).
2. Créer le premier compte d'administration technique : `admin:create` (lien d'activation à usage unique, voir [DEPLOYMENT.md](DEPLOYMENT.md) § 3).
3. Dans `/mandats` (administration technique) : déclarer l'année scoute en cours, puis consigner la nomination du responsable plein avec l'autorité de nomination. **Jusque-là, aucune décision officielle n'est possible** (D107).
4. Le responsable plein consigne l'adjoint et les assistants, résout les comptes « sans mandat », et délègue si nécessaire.
5. Renseigner les dates de naissance manquantes (indicateur du tableau de bord).
6. Planifier `npm run jobs:daily -w @tesla/api` une fois par jour (après `npm run build`).
7. Faire valider les points `A_VALIDER` et fournir les références manquantes ([REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) § 4).

## Sobriété des interfaces (2026-10-29)

Nettoyage du frontend, sans changement de règle, de workflow, de permission ni d'API (D108) :
- Badge « Serveur opérationnel · vX » retiré de la sidebar, de l'en-tête mobile et de l'accueil (composant `ApiStatus` et requête `health` côté web supprimés ; endpoint `/api/v1/health` inchangé).
- `PageHeading` et `EmptyState` : description facultative. ~30 descriptions de page supprimées ou réduites à la règle utile ; ~25 états vides « … apparaîtront ici » allégés.
- Menu : libellés courts (« Progression », « Résultats », « Responsables », « Décisions »…), rôle interne retiré du pied de menu.
- Tableaux de bord : sous-titres de cartes, surtitre décoratif et indications redondantes retirés ; files d'action, échéances, alertes et indicateurs conservés.
- Hors ligne : statuts de synchronisation traduits (plus de code brut), jargon technique retiré ; avertissements de délai, d'effacement et de confidentialité conservés.
- Erreurs réseau génériques : « Connexion impossible. Vérifiez votre réseau, puis réessayez. » / « Une erreur est survenue. Réessayez. »

Conservé volontairement : règles de validation humaine, avertissements d'irréversibilité, confidentialité des observations et des corrigés, échéances, conflits d'édition, formats de saisie (matricule, code de tentative).

Vérifications : lint, typecheck, `npm run test` (API 146, web 57) et build web réussis. Accueil et connexion contrôlés en Chromium headless à 390 et 1280 px (aucun défilement horizontal). **Non exécuté** : recette visuelle des écrans connectés (identifiants de démonstration non disponibles dans cette session).

## Offline-first global (2026-10-30)

Branche `feat/offline-first-global` (non commitée, non poussée). Référence : [OFFLINE_FIRST.md](OFFLINE_FIRST.md) (matrice des fonctionnalités § 2), décisions D109–D117.

Implémenté :
- Lecture offline-first de tous les écrans par `apiFetch` (copie chiffrée par compte, date des données affichée) ; session sans réseau par identité locale bornée (14 jours, fin de mandat) ; déverrouillage local sur la connexion et dans le cadre.
- Coffres par compte (tous les rôles), compatibles avec le coffre de la phase 5 ; déverrouillage conservé 12 h ; changement de compte.
- Préparation de l'appareil (`/appareil`) par rôle : données autorisées, pages et segments RSC, rapport « Prêt » / « Préparation incomplète », vérification sans réseau.
- Service worker `v4` : pages, charges RSC, ressources statiques ; repli `/hors-ligne` réservé aux pages jamais préparées ; mise à jour proposée.
- File d'opérations globale (présences, activités, observations, fiches, affectations) : identifiants provisoires, dépendances, fusion, rebasage, affichage provisoire, conflits, réessai et abandon confirmé.
- API : idempotence générique (`client_operations`, migration additive `20261030085910_client_operations` appliquée sur `tesla` et `tesla_test`), versions de référence facultatives (fiche, équipe, présences), `authorityValidUntil` dans `/auth/me`.
- Évaluations : préparation et passation hors ligne dans les écrans habituels ; onglet « Hors ligne », `OfflineHub` et `OfflineReader` supprimés (`/telechargements`, `/synchronisation` → `/appareil`).

Vérifications exécutées (2026-10-30) :
- `npm run lint`, `npm run typecheck`, `npm run build` (API, web) : réussis.
- `npm run test` : API 146 tests (18 fichiers), web 69 tests (5 fichiers, dont 13 offline-first : clés du dépôt, exclusions, identité locale et fin de mandat, identifiants provisoires, classement des échecs, fusion, rebasage, affichage provisoire, absence de décision officielle différable) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 85 tests (8 fichiers) réussis, dont `offline-sync.int-spec.ts` (6) : rejeu sans doublon, identifiant réutilisé ou d'un autre compte refusé, permissions revérifiées et réservation libérée, réception non confirmée, conflits de présence, de fiche et d'équipe, échéance des habilitations.
- Recette navigateur `apps/web/test/offline-first.browser.mjs` (Chromium headless Playwright, profil persistant, API et web de production sur `tesla_test`, comptes fictifs) : **28 contrôles réussis à 390 px et à 1280 px**, aucune erreur JavaScript — scénarios 1 à 25 de la mission (hors 26–27), sans aucune redirection vers `/hors-ligne`.

Non vérifié :
- Appareils réels (Android, iOS), Safari, Firefox, Edge ; installation PWA depuis l'écran d'accueil ; éviction réelle du stockage.
- Scénarios 26 (21 ans) et 27 (fin de mandat) hors connexion : couverts par tests unitaires (identité locale) et règles serveur existantes, pas par la recette navigateur.
- Création d'activité et de fiche hors ligne, changement d'équipe hors ligne : couverts par la logique commune et les tests d'intégration de conflits, non recettés dans le navigateur.
- Bouton « Mettre à jour » lui-même : le mécanisme (activation, repli de rechargement, conservation des opérations) est recetté, le clic sur le bouton non.
- Recette non intégrée à la CI (Playwright hors dépôt).

À arbitrer : durées D111 (12 h), D112 (14 jours), D117/D78 (24 h) ; purge des `client_operations`.

## Préparation à la production (2026-10-30)

Branche `chore/preparation-production` (commits atomiques, non poussée). Audit : [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) ; bilan et décision : [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; décisions D118–D123.

Implémenté :
- **Comptes** (API `/users`, `/auth/account-link/*`, `/auth/password`, `/auth/profile`, `/auth/sessions*` ; écrans `/activation`, `/compte`, `/administration/comptes`, « Créer son compte » sur la fiche) ; commande `admin:create` ; migration additive `20261104090000_account_lifecycle` (`account_tokens`, `auth_throttles`) appliquée sur `tesla_test` uniquement.
- **Sécurité** : limitation persistante, en-têtes, `no-store`, journaux sans chaîne de requête, `API_HOST`, délégation liée au mandat du délégataire, coffre d'un autre compte verrouillé avant lecture.
- **Offline-first** : lectures strictes (préparation, téléchargement), pas de fusion après envoi interrompu, pages de fiche préparées, boucle de redirection supprimée, pas de rechargement à la première installation du service worker.
- **Exploitation** : `deploy/` (systemd, Nginx, scripts), [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
- **CI** : jobs `quality` (+ formatage, audit), `integration`, `browser` ; [TEST_PLAN.md](TEST_PLAN.md).

Vérifications exécutées : format, lint, types, build réussis ; tests unitaires API 144 et web 74 ; intégration 94 (9 fichiers) ; dérive migrations nulle ; `audit:prod` 0 vulnérabilité (532 paquets) ; recettes Chromium offline-first 28/28 et comptes 9/9 à 390 et 1280 px ; sauvegarde, restauration d'essai, restauration, refus d'écrasement et détection d'altération sur `tesla_test`.

Non exécuté : workflow GitHub, VPS (systemd, Nginx, Certbot, rclone), appareils réels, Safari, Firefox.

**À faire sur la base de développement** : `npm run db:deploy` (migration additive des comptes, non appliquée sur `tesla` par cet audit).

## Bibliothèque de formation à la Route (2026-10-30)

Branche `feat/bibliotheque-route` (créée depuis `chore/preparation-production`, non poussée). Décisions D124–D128.

### Audit initial (avant modification)
- **Fonctionnel** : modules versionnés et workflow d'approbation, leçons (JSON liste blanche), ressources par URL, collaborateurs, archivage, historique ; bibliothèque (filtres étape, thème, catégorie), lecteur, impression A4 navigateur, téléchargement hors ligne ; questionnaires, papier, routiers sans compte ; référentiel d'âge `2026.1`, rattrapages, sortie à 21 ans ; import documentaire idempotent (`--dry-run`, provenance en ajout seul).
- **Contenus existants** : 4 modules « Bases du scoutisme » (`NT-SCOUT-M01–M04`, 8 leçons vides) et 21 brouillons vides « Découvrir la Route », tous non modifiés depuis l'import.
- **Manquant** : manuel SAPF-Route exploité, contenus de formation à la Route, textes fondamentaux, liens entre modules, duplication.
- **Bloqué par une règle non validée** : âges des étapes après le noviciat, sens du tableau synoptique, modules obligatoires, conditions de cérémonie (voir [REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) § 5).

### Implémenté
- Manuel `SAPF-Route (2).pdf` versé dans `docs/sources/` ; matrice manuel ↔ moteur ; aucun changement du référentiel d'âge (D124).
- Seed `route-bibliotheque.seed.ts` : Prière de la Route (texte fondamental, version rédactionnelle à valider, original en provenance) et modules `NT-ROUTE-M03` à `M12` (71 leçons rédigées d'après les sources) en brouillon ; modules 01–02 = `NT-SCOUT-M01/M02` (D126).
- Catégorie `TEXTE_FONDAMENTAL` et liens `module_text_links` (API `GET /editor/texts`, `PUT /editor/modules/:id/texts` ; carte dans l'éditeur ; « Textes fondamentaux » sur la fiche publique ; recopie dans les nouvelles versions) (D125).
- Duplication d'un module (`POST /editor/modules/:id/duplicate`, bouton « Dupliquer ») (D127).
- Migration additive `20261105090000_fundamental_texts` appliquée sur `tesla_test`, puis sur `tesla` après sauvegarde ; dérive nulle sur les deux bases. Seed exécuté sur `tesla` (11 créations) puis réexécuté sans écriture.

### Vérifications exécutées
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web) : réussis. Le build web échoue au prérendu si `NODE_ENV=development` est exporté depuis `.env` dans le shell ; réussi sans cette variable (comportement antérieur, sans lien avec cette phase).
- `npm run test` : API 152 tests (19 fichiers, dont 8 nouveaux sur la définition du catalogue), web 74 tests — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **100 tests (10 fichiers) réussis**, dont 6 nouveaux (`test/bibliotheque-route.int-spec.ts`) : import en brouillon sans publication, sans questionnaire ni obligation, prière liée et stockée une seule fois, aucun contenu de Charte ; prévisualisation sans écriture, réexécution sans doublon, modification humaine conservée ; module citant un texte non importé ignoré ; texte cité invisible avant sa publication puis visible, rubrique par catégorie, lien figé hors brouillon (trigger) et recopié dans la version 2 ; création d'un texte « Charte » par l'administration, association, refus (module ordinaire, auto-citation, chef non autorisé, routier) ; duplication (original inchangé, obligation non reprise, audit).
- Correction d'un test existant (`modules.int-spec.ts`) qui supposait un code module à exactement 3 chiffres alors que la séquence de `tesla_test` dépasse 999 (format réel : 3 chiffres au moins).

### Non vérifié / non développé
- **Recette navigateur** des nouveaux écrans (carte « Textes fondamentaux cités », bouton « Dupliquer », fiche publique) : non exécutée.
- Dépôt du PDF de la Charte, extraction et prévisualisation automatiques (D128) ; textes cités absents de l'aperçu, de l'écran de révision et de la version imprimable ; mention des textes cités dans le paquet hors ligne (volontairement inchangé).
- Questionnaires d'entraînement : aucun créé (à construire dans le workflow des évaluations).
- Améliorations d'interface de la phase 10 (vue « modules recommandés / antérieurs / facultatifs / déjà étudiés », file « contenus sans source validée ») : non développées ; l'existant (badge « Recommandé pour votre étape », filtres, études déclarées, `/mes-rattrapages`) est inchangé.
- Contenus à compléter et points à valider : [CATALOGUE_PEDAGOGIQUE_INITIAL.md](CATALOGUE_PEDAGOGIQUE_INITIAL.md) § 3.

### Complément — mise en service, questionnaires, PDF (2026-10-30, D129–D131)
Demande du responsable : supprimer les modules vides, rendre les autres utilisables, un questionnaire pour chacun, cours téléchargeable aux couleurs de la communauté.
- Migration `20261106090000_purge_empty_module_drafts` (fonctions et triggers uniquement, aucune donnée modifiée) : suppression d'un brouillon vide par `purge_empty_module_draft` ; API `POST /admin/modules/:id/purge`, bouton « Supprimer ce brouillon vide », audit `module.purged`.
- Commande `npm run pedagogy:release` (`prisma/seeds/release-catalog.ts`) : brouillons importés vides supprimés, leçons vides retirées, modules soumis, approuvés et publiés, 14 questionnaires d'entraînement publiés — au nom du responsable plein en exercice, via les services de l'API. Catalogue « Découvrir la Route » retiré du seed.
- Support de cours PDF (`GET /modules/:slug/pdf`, bouton « Télécharger le cours (PDF) ») : page de garde au logo et au nom de la communauté, en-tête et pied de page sur chaque page. Identité PDF commune extraite dans `src/common/pdf-brand.ts` (réutilisée par les feuilles papier). `resolveAuthority` exporté pour les commandes serveur.

Vérifications exécutées : `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` (sans `NODE_ENV` exporté) réussis ; `npm run test` : API 155 tests (21 fichiers, dont rendu PDF et validité des 14 questionnaires), web 74 — réussis. Contrôle du texte extrait d'un PDF réel du module 04 (9 pages, en-tête et pied de page présents).

Migration `20261106090000_purge_empty_module_drafts` appliquée sur `tesla_test`, puis sur `tesla` après sauvegarde ; dérive nulle sur les deux bases. `npm run test:int` : **104 tests (11 fichiers) réussis**, dont `test/mise-en-service.int-spec.ts` (4) : suppression motivée et refusée, protections actives hors suppression, publication complète au nom du responsable, questionnaires rattachés à la version publiée, réexécution sans écriture, refus sans responsable habilité, PDF réservé aux modules publiés.

**Non exécuté** : `pedagogy:release` sur `tesla` — aucun responsable plein en exercice n'y est consigné (prévisualisation refusée, comportement attendu) ; à lancer après la nomination dans `/mandats`, ou avec `--acteur`. Rendu visuel du PDF non contrôlé (aucun outil de rendu disponible).

## Gouvernance simplifiée et application unique (2026-10-30)

Décisions D132–D134. Détails : [FEATURES/ENCADREMENT.md](FEATURES/ENCADREMENT.md), [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md).

Audit des dépendances (avant modification) : mandats, années scoutes et délégations utilisés par le schéma (3 modèles, 2 contraintes d'exclusion, 3 triggers), `AuthService.resolveAuthority` et `authorityValidUntil`, le module `leadership` (9 routes), la matrice partagée (niveaux `OFFICIEL`/`PLEIN`, 6 permissions), le web (écran `/mandats` de 801 lignes, navigation par rôle avec trois tableaux de bord, identité hors ligne bornée par l'échéance du mandat, préparation hors ligne), le seed de mise en service, 6 fichiers de tests, la documentation. Aucun job ni seed ne créait de mandat.

Réalisé :
- **Données** : migration additive `20261107090000_leadership_assignments` (fonctions sans année ni échéance ; un plein et une fonction par personne par index uniques partiels ; trigger d'immutabilité) ; mandats en vigueur repris ; `leadership_mandates`, `delegations`, `scout_years` gelées en lecture seule, rien supprimé. Testée sur une base jetable (`tesla_gouvernance_check`, copie de `tesla_test` avec un mandat en vigueur), appliquée sur `tesla_test` et `tesla` ; diff schéma ↔ base vide. Base `tesla` : 26 comptes conservés, aucun mandat préexistant, donc **aucun responsable plein désigné** à ce jour.
- **API** : décisions officielles = plein en fonction ; délégations retirées du calcul ; `leadership.read` (tous) / `leadership.manage` (administrateur) ; désignation, remplacement confirmé (transaction sérialisée, audit), fin de fonction, historique ; anciennes routes supprimées ; `authorityValidUntil` retiré.
- **Web** : menu unique filtré par permissions, accès par permission (plus aucun rôle dans la navigation), accueil commun `/accueil` réutilisant les tableaux de bord existants, page `/communaute` (composition pour tous, gestion pour l'administrateur), redirections des anciennes URL, relecture de session sur 403, « Mon compte » affiche la fonction et plus le rôle, « Type de compte » en langage courant, textes « chef » / « responsable pédagogique » / « délégation » remplacés ; accueil public sans « Un espace pour chacun ».
- **Hors ligne** : identité locale sans échéance d'autorité (D133) ; opération rejouée par une personne qui n'est plus habilitée → `403` → `REJETE`, conservée.
- Correctif mobile trouvé par la recette : débordement horizontal (badge d'écart d'étape non sécable, grille sans colonne explicite) sur l'accueil d'un routier sans date de naissance.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 154 tests (21 fichiers), web 61 tests (5 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 106 tests (11 fichiers) réussis, dont 6 nouveaux scénarios de gouvernance (accès directs refusés, désignation, remplacement confirmé et atomique, retrait immédiat des droits, historique et audit, unicité en base et sous concurrence, adjoint et assistants, changement et fin de fonction, immutabilité, tables gelées, anciennes routes en 404), fin de fonction du plein (comptes) et opération hors ligne rejouée après remplacement (refusée, sans effet).
- Recette navigateur hors dépôt (Chromium headless, 390 px, API et web de production sur `tesla_test`, comptes fictifs) : **15 contrôles réussis** — connexion sans choix d'espace pour administrateur, plein et routier ; menus par permissions ; aucun libellé technique (rôle, mandat, délégation, espace) ni défilement horizontal ; redirections `/mandats`, `/encadrement`, `/routier` ; désignation puis remplacement du plein avec confirmation ; ancien plein renvoyé à l'accueil, menu sans décisions, accès encadrement conservé ; routier voyant le nouveau plein sans contrôle de gestion ; accès direct refusé ; aucune erreur JavaScript.

Non vérifié :
- Recettes navigateur du dépôt (`apps/web/test/*.browser.mjs`) : URL d'arrivée mises à jour, non rejouées (fixtures et serveurs dédiés).
- Appareils réels ; scénario hors ligne complet en navigateur avec changement de responsable (couvert côté API et par test unitaire de classification).
- Les points d'API historiques `/dashboard/chef`, `/dashboard/responsable`, `/editor/chefs` gardent leur nom technique (non affiché, protégé par permissions).
- **Mise en service** : l'administrateur doit désigner le responsable plein depuis « Encadrement » ; d'ici là, les décisions officielles restent suspendues.
