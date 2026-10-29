# État d'implémentation

Dernière mise à jour : 2026-10-29 — seed des modules « Bases du scoutisme » (brouillons), voir [§ Seed pédagogique](#seed-pédagogique--bases-du-scoutisme-2026-10-29) ; phase 5 (hors ligne) livrée, voir [§ Phase 5](#phase-5--pwa-hors-ligne-2026-10-29) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; phase 4 livrée en complément de la phase 3 ; voir [rapport de livraison](FEATURES/PHASE_4_REPORT.md). Phase 3 (évaluations : questionnaires, passation en ligne, papier, correction, examen des résultats). Détails fonctionnels : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md), [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

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
- **Limitation des tentatives de connexion** : en mémoire, réinitialisée au redémarrage.
- **CI GitHub Actions** : non exécutée (aucun push) ; tests d'intégration non configurés en CI.
- **Audit de dépendances** : non exécuté après l'ajout de `pdfkit`.
- `REFUSEE` et la réouverture d'un résultat examiné : disponibles dans l'API, sans bouton dans les écrans.

## Non développé
Gestion des comptes (création, activation, mot de passe), téléversement des copies numérisées, support de cours en PDF serveur, progression de lecture synchronisée avec le serveur, consultation du journal d'audit complet, déploiement. Voir [ROADMAP.md](ROADMAP.md).

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

Non vérifié : rendu visuel de l'encart de provenance (pas de recette navigateur) ; transcription de l'alphabet Morse relue à l'œil uniquement ; sources `docs/sources/` non versionnées ; manuel SAPF-Route et programme annuel absents du dépôt.
