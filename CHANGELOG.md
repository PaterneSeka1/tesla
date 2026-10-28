# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon SemVer.

## [Non publié]

### Ajouté — phase 0 (fondations), 2026-10-28
- Monorepo npm workspaces : `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- API NestJS 12 : préfixe `/api/v1`, validation de l'environnement, Swagger, format d'erreur homogène, journalisation des requêtes, CORS, `GET /api/v1/health`, modules réservés.
- Prisma 7 / PostgreSQL : modèles `User`, `Session`, `ScoutProfile`, `ProgressionStage`, `AuditLog`, migration initiale, seed des étapes de progression.
- Web Next.js 16 : identité visuelle de la Communauté Nikola Tesla, accueil, connexion (visuelle), espaces routier / chef / responsable, pages 404, erreur, chargement, hors ligne.
- PWA : manifest, icônes, service worker, structure IndexedDB.
- Outillage : ESLint, Prettier, Vitest, Docker Compose (PostgreSQL), GitHub Actions, workspace VS Code.
- Documentation : `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `docs/`.
