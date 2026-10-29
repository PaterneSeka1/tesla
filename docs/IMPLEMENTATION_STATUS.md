# État d'implémentation

Dernière mise à jour : 2026-10-29 — phase 3 (évaluations : questionnaires, passation en ligne, papier, correction, examen des résultats). Détails fonctionnels : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md), [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

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
- **Service worker / hors ligne** : inchangés ; passation et lecture exigent une connexion.
- **CI GitHub Actions** : non exécutée (aucun push) ; tests d'intégration non configurés en CI.
- **Audit de dépendances** : non exécuté après l'ajout de `pdfkit`.
- `REFUSEE` et la réouverture d'un résultat examiné : disponibles dans l'API, sans bouton dans les écrans.

## Non développé
Validation officielle des acquis (phase 4), historique structuré des étapes, gestion des comptes (création, activation, mot de passe), téléversement des copies numérisées, support de cours en PDF serveur, passation hors ligne, progression de lecture, lecture hors ligne des modules, consultation du journal d'audit complet, programme annuel, déploiement. Voir [ROADMAP.md](ROADMAP.md).
