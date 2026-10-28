# Nikola Tesla Académie

Plateforme pédagogique de la **Communauté Nikola Tesla** — Branche Route, District Requin de Sable, Abidjan — pour l'année scoute 2026–2027 : modules de formation, lecture hors ligne, évaluations encadrées et suivi de progression.

> **État : phase 0 (fondations).** Le socle technique fonctionne ; l'authentification, les modules et les évaluations ne sont pas encore développés. Voir [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Prérequis
- Node.js ≥ 22.12 (`.nvmrc` : 22) et npm ≥ 10
- Docker (Docker Desktop avec intégration WSL sous Windows) pour PostgreSQL

## Installation
```bash
npm install                 # installe tout et génère le client Prisma
cp .env.example .env        # valeurs locales fictives, à adapter
npm run db:up               # démarre PostgreSQL 18 (Docker)
npm run db:deploy           # applique les migrations
npm run db:seed             # charge les étapes de progression
```

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
| `API_PORT` | Port de l'API | `4000` |
| `DATABASE_URL` | URL PostgreSQL (**obligatoire**) | — |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules | `http://localhost:3000` |
| `SWAGGER_ENABLED` | `true` \| `false` | `true` hors production |
| `NEXT_PUBLIC_API_URL` | URL de l'API vue du navigateur (**obligatoire**, intégrée au build) | — |

Les variables de l'API sont validées au démarrage (Zod) : une valeur invalide arrête l'application avec un message explicite.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` / `dev:web` / `dev:api` | Développement (les deux apps / web seul / API seule) |
| `npm run build` | Build de `shared`, de l'API et du web |
| `npm run lint` | ESLint dans chaque paquet |
| `npm run typecheck` | Vérification TypeScript (inclut la génération des types de routes Next) |
| `npm run test` | Tests Vitest (API : unitaires + e2e avec base simulée ; web : client API) |
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
docs/             Documentation (architecture, règles métier, API, base…)
.claude/rules/    Règles pour les agents de développement
```
Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tests
`npm run test` n'exige pas de base de données : les tests e2e remplacent Prisma par un stub. La CI (`.github/workflows/ci.yml`) exécute installation, validation Prisma, lint, typecheck, tests et build, sans déploiement.

## Documentation
[Architecture](docs/ARCHITECTURE.md) · [Règles métier](docs/BUSINESS_RULES.md) · [Base de données](docs/DATABASE.md) · [API](docs/API.md) · [Hors ligne](docs/OFFLINE_FIRST.md) · [Gouvernance IA](docs/AI_GOVERNANCE.md) · [Feuille de route](docs/ROADMAP.md) · [Décisions](docs/DECISIONS.md) · [État d'avancement](docs/IMPLEMENTATION_STATUS.md)
