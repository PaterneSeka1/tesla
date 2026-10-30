# Nikola Tesla Académie

Plateforme pédagogique de la **Communauté Nikola Tesla** — Branche Route, District Requin de Sable, Abidjan — pour l'année scoute 2026–2027 : modules de formation, lecture hors ligne, évaluations encadrées et suivi de progression.

> **État (2026-10-30) : prêt pour un pilote encadré, pas pour la production générale.** Comptes, routiers et équipes, modules et publication, évaluations en ligne et sur papier, progression par l'âge, mandats, hors ligne et fichiers d'exploitation sont développés et testés localement. Restent : règles pédagogiques à valider (manuel SAPF-Route), contenus à rédiger et publier, installation et recette en préproduction. Décision et conditions : [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

## Prérequis
- Node.js ≥ 22.12 (`.nvmrc` : 22) et npm ≥ 10
- Docker (Docker Desktop avec intégration WSL sous Windows) pour PostgreSQL

## Installation
```bash
npm install                 # installe tout et génère le client Prisma
cp .env.example .env        # valeurs locales fictives, à adapter
npm run db:up               # démarre PostgreSQL 18 (Docker)
npm run db:deploy           # applique les migrations
npm run db:seed             # références (étapes, programme, référentiel d'âge) et modules en brouillon
```

Comptes de démonstration (développement seulement) : définir `DEMO_ACCOUNT_PASSWORD` dans `.env` avant `db:seed`. Sinon, créer le premier compte d'administration : `npm run build && npm run admin:create -w @tesla/api -- --email <adresse>` (lien d'activation à usage unique).

## Démarrage
```bash
npm run dev                 # API (http://localhost:4000/api/v1) + web (http://localhost:3000)
```
Swagger : http://localhost:4000/api/docs (désactivé par défaut en production).

## Variables d'environnement
Un seul fichier `.env` à la racine, lu par Docker Compose, l'API, Prisma et Next.js. Les variables du système priment.

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Conteneur PostgreSQL | voir `.env.example` |
| `NODE_ENV` | `development` \| `test` \| `production` | `development` |
| `API_PORT` / `API_HOST` | Port et interface d'écoute de l'API | `4000` / `0.0.0.0` (`127.0.0.1` en production) |
| `DATABASE_URL` | URL PostgreSQL (**obligatoire**) | — |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules | `http://localhost:3000` |
| `SWAGGER_ENABLED` | `true` \| `false` | `true` hors production |
| `SESSION_TTL_HOURS` | Durée de vie d'une session | `12` |
| `ACCOUNT_LINK_TTL_HOURS` | Validité d'un lien d'activation ou de réinitialisation | `72` |
| `TRUST_PROXY` | `true` derrière Nginx (adresse IP réelle) | `false` |
| `TEST_DATABASE_URL` | Base des tests d'intégration (nom en `_test`) | — |
| `NEXT_PUBLIC_API_URL` | URL de l'API vue du navigateur (**obligatoire**, intégrée au build) | — |

Les variables de l'API sont validées au démarrage (Zod) : une valeur invalide arrête l'application avec un message explicite.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` / `dev:web` / `dev:api` | Développement (les deux apps / web seul / API seule) |
| `npm run build` | Build de `shared`, de l'API et du web |
| `npm run lint` | ESLint dans chaque paquet |
| `npm run typecheck` | Vérification TypeScript (inclut la génération des types de routes Next) |
| `npm run test` | Tests unitaires Vitest (API et web, sans base) |
| `npm run test:int -w @tesla/api` | Tests d'intégration sur PostgreSQL (`TEST_DATABASE_URL`, base `*_test`) |
| `npm run audit:prod` | Vulnérabilités connues des dépendances de production |
| `npm run jobs:daily -w @tesla/api` | Traitement quotidien (sorties de branche, rattrapages, purge) |
| `npm run admin:create -w @tesla/api -- --email …` | Premier administrateur (ou `--recover`) |
| `npm run format` / `format:check` | Prettier |
| `npm run db:up` / `db:down` | Démarrer / arrêter PostgreSQL (Docker) |
| `npm run db:migrate -- --name <nom>` | Créer une migration (développement) |
| `npm run db:deploy` / `db:seed` / `db:generate` / `db:studio` | Migrations, seed, client, interface Prisma |

## Structure
```
apps/web          Next.js 16 (PWA) — interface
apps/api          NestJS 12 — API REST /api/v1, Prisma
packages/shared   Contrats partagés (Zod) et constantes métier
packages/config   Configurations TypeScript et ESLint
deploy/           Exploitation VPS : systemd, Nginx, scripts (déploiement, sauvegarde, restauration)
scripts/          Outils du dépôt (audit des dépendances)
docs/             Documentation (architecture, règles métier, API, base, exploitation…)
.claude/rules/    Règles pour les agents de développement
```
Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests
`npm run test` n'exige pas de base de données. Les tests d'intégration exigent une base dédiée dont le nom finit par `_test` (jamais la base de développement). Les recettes navigateur (`apps/web/test/*.browser.mjs`) s'exécutent sur les builds de production. La CI (`.github/workflows/ci.yml`) exécute formatage, lint, types, tests unitaires, build, audit des dépendances, migrations et intégration sur PostgreSQL éphémère, puis les recettes navigateur ; elle ne déploie rien. Détails : [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## Documentation
[Architecture](docs/ARCHITECTURE.md) · [Règles métier](docs/BUSINESS_RULES.md) · [Base de données](docs/DATABASE.md) · [API](docs/API.md) · [Hors ligne](docs/OFFLINE_FIRST.md) · [Gouvernance IA](docs/AI_GOVERNANCE.md) · [Feuille de route](docs/ROADMAP.md) · [Décisions](docs/DECISIONS.md) · [État d'avancement](docs/IMPLEMENTATION_STATUS.md)

Production : [Bilan](docs/PRODUCTION_READINESS.md) · [Audit](docs/PRODUCTION_AUDIT.md) · [Sécurité](docs/SECURITY_AUDIT.md) · [Déploiement](docs/DEPLOYMENT.md) · [Sauvegarde et restauration](docs/BACKUP_RESTORE.md) · [Plan de tests](docs/TEST_PLAN.md) · [Liste de contrôle de livraison](docs/RELEASE_CHECKLIST.md)
