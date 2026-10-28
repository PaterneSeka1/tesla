# État d'implémentation

Dernière mise à jour : 2026-10-28 — phase 1 bis (routiers sans compte, équipes, évaluations papier : modèle et services).

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo npm workspaces (`web`, `api`, `shared`, `config`) | `npm install` OK |
| Lint, typecheck, tests, build | Les quatre commandes racine passent |
| API NestJS : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `curl` sur `/health`, route inconnue (404 homogène), `/api/docs` |
| `GET /api/v1/health` avec test réel de la base | `ok/up` base active ; `degraded/down` base arrêtée |
| PostgreSQL 18 via Docker Compose (port hôte 5433) | Conteneur `tesla-postgres` démarré, état `healthy` |
| Prisma 7 : schéma (5 modèles), migration `init`, seed idempotent | `db:deploy` puis `db:seed` (deux fois, sans doublon) sur le conteneur Docker ; 5 tables + `_prisma_migrations` vérifiées |
| `npm run dev` avec base Docker | Healthcheck `ok` / `database: up`, accueil web en 200 |
| Web Next.js : accueil, connexion visuelle, espaces routier/chef/responsable, 404, erreur, chargement, hors ligne | Pages servies en 200 (404 pour une page inconnue) ; build statique |
| Client API typé + TanStack Query (`ApiStatus`) | Tests unitaires ; en-tête CORS vérifié pour `http://localhost:3000` |
| PWA : manifest, icônes, service worker, page hors ligne, structure IndexedDB | Fichiers servis ; voir limites ci-dessous |
| Règles Claude Code, AGENTS.md, documentation, CI, workspace VS Code | Créés |

## Phase 1 bis — routiers, équipes, évaluations papier

| Catégorie | État |
| --- | --- |
| **Modèles implémentés** | `ScoutProfile` modifié (compte facultatif, identité, matricule) ; nouveaux `Team`, `TeamAssignment`, `Evaluation`, `EvaluationVersion`, `EvaluationAttempt`, `EvaluationAttemptEvent`, `AttemptCodeCounter`, `EvaluationWaiver` ; enums `EvaluationMode`, `AttemptStatus` |
| **Migrations appliquées** | `20261028222140_matricule_official_format` (format officiel du matricule) ; `20261028212208_teams_matricule_evaluation_attempts` : rejouée sur une base jetable avec un profil existant (reprise vérifiée), appliquée sur la base de développement (`db:deploy`) et sur `tesla_test` ; diff base ↔ schéma vide |
| **Contraintes** | Unicité matricule + CHECK de format ; affectation ouverte unique + exclusion de chevauchement ; tentative ouverte unique ; code unique + CHECK ; triggers d'immutabilité et d'ajout seul ; FK composite version ↔ évaluation |
| **Services développés** | `ScoutProfilesService`, `TeamsService`, `EvaluationAttemptsService`, `EvaluationWaiversService` ; émission des codes, transitions, éligibilité, matrice des permissions |
| **Endpoints développés** | **Aucun** (attente de l'authentification) — contrats prévus dans `API.md` |
| **Uniquement documenté** | Routes HTTP, écrans, générateur PDF (support, questionnaire, corrigé), stockage des copies numériques, validation officielle d'acquis/étape, mode en ligne et hors ligne, archivage d'équipe, consultation des historiques |
| **Tests exécutés** | 26 tests unitaires (`npm run test`, sans base) ; 15 tests d'intégration (`npm run test:int`, PostgreSQL réel) couvrant les 17 cas demandés — tous réussis |

Correspondance avec les tests demandés : 1 création sans compte · 2 rattachement · 3 unicité matricule · 4 matricule facultatif · 5 affectation active unique · 6 historique d'équipe · 7–8 tentative papier sans compte et code · 9 concurrence (15 créations simultanées) · 10 réimpression et doublon · 11–12 recherche par code et refus · 13 version conservée · 14–15 décision réservée au responsable, étape inchangée · 16 éligibilité et dérogations · 17 conservation (suppression, modification de code et d'historique refusées, code jamais réutilisé). La « conservation après migration » des profils existants a été vérifiée manuellement sur une base jetable, pas par un test automatisé.

## Partiel ou non vérifié
- **Appel du healthcheck depuis le navigateur** : vérifié indirectement (CORS, tests du client), pas dans un vrai navigateur.
- **Service worker** : enregistré en production uniquement ; installation et mode hors ligne non testés dans un navigateur.
- **IndexedDB** : structure définie, utilisée par aucun écran.
- **CI GitHub Actions** : non exécutée (aucun push).
- **Audit de dépendances** (`npm audit`) : non exécuté.
- **Tests d'intégration en CI** : non configurés (exécutés localement sur `tesla_test`).
- **Base `tesla_migration_check`** : base jetable créée pour tester la migration sur le conteneur local ; peut être supprimée manuellement.

## Non développé
Authentification et sessions, gestion des comptes, protection des espaces par rôle, routes HTTP des routiers/équipes/tentatives, modules et leçons, workflow de publication (y compris des versions d'évaluation), moteur de quiz en ligne, lecture et téléchargement hors ligne, validation officielle des acquis, génération PDF, programme annuel, consultation du journal d'audit, déploiement. Voir [ROADMAP.md](ROADMAP.md).
