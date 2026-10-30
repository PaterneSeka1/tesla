# État d'implémentation

Dernière mise à jour : 2026-10-30 — **préparation à la production** (comptes, sécurité, exploitation, CI), voir [§ Préparation à la production](#préparation-à-la-production-2026-10-30) et [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; 2026-10-30 — **offline-first global** (une seule application avec ou sans réseau, préparation de l'appareil, file de synchronisation, conflits), voir [§ Offline-first](#offline-first-global-2026-10-30) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; 2026-10-29 — **sobriété des interfaces** (textes, libellés et état serveur), voir [§ Sobriété](#sobriété-des-interfaces-2026-10-29) ; **refonte parcours Route et mandats** (âge, rattrapages, sortie à 21 ans, fonctions plein / adjoint / assistant, espace d'encadrement unique), voir [§ Refonte](#refonte--parcours-route-et-mandats-2026-10-29) ; parcours de l'encadrement (file « À faire », frise de l'année, menu allégé), voir [§ Parcours encadrement](#parcours-du-responsable-et-des-chefs-2026-10-29) ; phase 6 (navigation par rôle, UX, audit ESLint), voir [§ Phase 6](#phase-6--navigation-par-rôle-ux-et-stabilisation-2026-10-29) ; seed des modules « Bases du scoutisme » (brouillons), voir [§ Seed pédagogique](#seed-pédagogique--bases-du-scoutisme-2026-10-29) ; phase 5 (hors ligne) livrée, voir [§ Phase 5](#phase-5--pwa-hors-ligne-2026-10-29) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; phase 4 livrée en complément de la phase 3 ; voir [rapport de livraison](FEATURES/PHASE_4_REPORT.md). Phase 3 (évaluations : questionnaires, passation en ligne, papier, correction, examen des résultats). Détails fonctionnels : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md), [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

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
