# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon SemVer.

## [Non publié]

### Modifié — 2026-10-28
- Matricule : format officiel imposé (7 chiffres suivis d'une lettre, ex. `0000001A`) dans `@tesla/shared` et en base (migration `20261028222140_matricule_official_format`).

### Ajouté — phase 1 bis (routiers, équipes, évaluations papier), 2026-10-28
- Profil routier indépendant du compte : `scout_profiles.user_id` facultatif, nom et prénom sur le profil, matricule facultatif unique et normalisé.
- Équipes et historique des affectations (une affectation ouverte, périodes sans chevauchement).
- Évaluations, versions, tentatives multimodes (`EN_LIGNE`, `HORS_LIGNE`, `PAPIER`), historique en ajout seul, dérogations.
- Code unique de tentative `NT-AAAA-NNNNNN` émis par compteur annuel transactionnel.
- Migration `20261028212208_teams_matricule_evaluation_attempts` (additive, contraintes SQL et triggers).
- Services `scouts` et `evaluations` (sans routes HTTP), matrice des permissions, contrats Zod partagés.
- Tests unitaires et suite d'intégration PostgreSQL (`npm run test:int -w @tesla/api`).
- Règles RM-001 à RM-012 et documentation associée.

### Ajouté — phase 0 (fondations), 2026-10-28
- Monorepo npm workspaces : `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- API NestJS 12 : préfixe `/api/v1`, validation de l'environnement, Swagger, format d'erreur homogène, journalisation des requêtes, CORS, `GET /api/v1/health`, modules réservés.
- Prisma 7 / PostgreSQL : modèles `User`, `Session`, `ScoutProfile`, `ProgressionStage`, `AuditLog`, migration initiale, seed des étapes de progression.
- Web Next.js 16 : identité visuelle de la Communauté Nikola Tesla, accueil, connexion (visuelle), espaces routier / chef / responsable, pages 404, erreur, chargement, hors ligne.
- PWA : manifest, icônes, service worker, structure IndexedDB.
- Outillage : ESLint, Prettier, Vitest, Docker Compose (PostgreSQL), GitHub Actions, workspace VS Code.
- Documentation : `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `docs/`.
