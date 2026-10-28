# Architecture

## Vue d'ensemble

```
Navigateur / PWA ──HTTPS──► apps/web (Next.js 16)
        │                        │
        └──── fetch JSON ───────►│ apps/api (NestJS 12)  /api/v1
                                 │        │ Prisma 7 + @prisma/adapter-pg
                                 │        ▼
                                 │   PostgreSQL 18
packages/shared ◄── importé par web et api (schémas Zod, constantes)
packages/config ◄── tsconfig de base, configuration ESLint
```

Le navigateur appelle directement l'API (CORS restreint aux origines déclarées). En production, Nginx servira les deux applications sous le même domaine (cible : VPS OVHcloud Ubuntu 24.04, 2 vCore, 4 Go RAM, partagé avec SCOUT-NDPST).

## Paquets

| Paquet | Rôle | Sortie |
| --- | --- | --- |
| `apps/web` (`@tesla/web`) | Interface PWA : accueil, connexion, espaces routier / chef / responsable | `.next/` |
| `apps/api` (`@tesla/api`) | API REST, configuration validée, accès base, Swagger | `dist/` |
| `packages/shared` (`@tesla/shared`) | Contrats partagés : `healthResponseSchema`, `apiErrorSchema`, `ROLES`, `PROGRESSION_STAGES` | `dist/` (ESM + `.d.ts`) |
| `packages/config` (`@tesla/config`) | `tsconfig.base.json`, `createTypeScriptConfig` (ESLint) | sources |

`@tesla/shared` est compilé (`npm run build:shared`) car l'API, en ESM Node, exécute du JavaScript. Les scripts racine `dev`, `typecheck` et `test` le compilent automatiquement.

## Web (`apps/web/src`)

| Dossier | Contenu |
| --- | --- |
| `app/` | Routes App Router : `/`, `/connexion`, `(espaces)/routier`, `/chef`, `/responsable`, `/hors-ligne`, `manifest.ts`, pages 404/erreur/chargement |
| `components/ui/` | Primitives shadcn/ui (button, card, badge, alert, input, label, skeleton) |
| `components/layout/` | `DashboardShell` (structure responsive des espaces), `SpaceNav` |
| `lib/api/` | `apiFetch` (client typé, erreurs normalisées) et `queryOptions` TanStack Query |
| `lib/offline/` | Structure IndexedDB (fondation PWA) |
| `lib/spaces.ts` | Configuration des espaces et de leur navigation |
| `public/sw.js` | Service worker (enregistré en production uniquement) |

## API (`apps/api/src`)

| Dossier | Contenu |
| --- | --- |
| `config/` | Validation Zod des variables, chargement du `.env` racine, version |
| `prisma/` | `PrismaService` (client unique, connexion paresseuse) |
| `health/` | `GET /api/v1/health` |
| `common/` | Filtre d'erreurs homogène, journalisation des requêtes |
| `modules/` | Modules réservés : `auth`, `users`, `pedagogy`, `progression`, `programmes`, `audit` (vides) |
| `app.setup.ts` | Configuration HTTP partagée entre `main.ts` et les tests e2e |

## Configuration

Un seul fichier `.env` à la racine (modèle : `.env.example`), lu par Docker Compose, l'API (`loadRootEnvFile`), Prisma (`prisma.config.ts`) et Next.js (`next.config.ts`). Les variables déjà définies dans l'environnement sont prioritaires.
