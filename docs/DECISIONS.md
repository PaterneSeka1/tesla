# Décisions techniques

Format : contexte → décision → conséquence. Ajouter une entrée pour chaque choix structurant.

## 2026-10-28 — Phase 0

| # | Décision | Motif / conséquence |
| --- | --- | --- |
| D1 | **npm workspaces**, sans Turborepo/Nx | Quatre paquets seulement ; scripts racine suffisants. |
| D2 | **TypeScript 6.0** (et non 7.0) | `typescript-eslint` 8 exige TypeScript < 6.1 ; NestJS CLI 12 utilise TypeScript 6. |
| D3 | **Prisma 7.10.1** (et non 8.0) | Le tag npm `latest` de Prisma pointe sur une RC 8.0 ; on retient la dernière stable. Prisma 7 impose un adaptateur (`@prisma/adapter-pg`) et `prisma.config.ts`. |
| D4 | **NestJS 12 en ESM** | NestJS 12 est publié en ESM uniquement : imports relatifs avec extension `.js`. |
| D5 | **Vitest** pour l'API et le web | Gabarit officiel NestJS 12 ; ESM natif. ESLint conservé (au lieu d'oxlint du gabarit Nest) pour un outil unique. |
| D6 | **Zod partagé** (`@tesla/shared`) | Un seul contrat pour la validation API et le typage du client web. Validation des DTO par Zod à généraliser à partir de la phase 1 (pas de class-validator). La documentation OpenAPI utilise des classes DTO qui `implements` le type Zod. |
| D7 | **`.env` unique à la racine** | Chargé par `process.loadEnvFile` (Node ≥ 20.12) dans l'API, Prisma et `next.config.ts` ; pas de dépendance `dotenv`. Variables système prioritaires. |
| D8 | **Healthcheck toujours 200** | Le processus est vivant ; l'état de la base est dans le corps (`degraded`). Permet au web d'afficher l'état. |
| D9 | **Composants shadcn/ui écrits à la main** (style new-york, `radix-ui`) | Le CLI shadcn nécessite le registre réseau, instable lors de l'initialisation. `components.json` permet d'utiliser le CLI ensuite. |
| D10 | **Polices système** | Pas de Google Fonts : build sans réseau, page plus légère. |
| D11 | **Service worker écrit à la main** (pas de Serwist/next-pwa) | Besoin limité (page hors ligne, cache statique) ; aucune dépendance. Enregistré en production uniquement. |
| D12 | **Pas de Redis, file de messages, microservices** | Contraintes du VPS (2 vCore, 4 Go, partagé avec SCOUT-NDPST). |
| D13 | **Rôles : `ROUTIER`, `CHEF`, `RESPONSABLE`** | Pas de rôle administrateur distinct pour l'instant (à confirmer). Synchronisation enum Prisma ↔ `@tesla/shared` vérifiée par un test. |
| D14 | **Étape courante sur `ScoutProfile`** | Historique détaillé des étapes reporté à la phase 4 ; dans l'intervalle, les changements passeront par `AuditLog`. |
| D15 | **Pas de comptes de développement** | L'authentification n'est pas opérationnelle ; le seed ne crée que les étapes de progression. |
| D16 | **`agentRules: false`** dans Next | Évite la génération d'un `apps/web/AGENTS.md` en doublon ; l'information utile est dans `.claude/rules/frontend.md`. |
| D17 | **Espaces non protégés en phase 0** | Ils n'affichent aucune donnée personnelle ; un bandeau l'indique. Protection par rôle en phase 1. |
| D18 | **PostgreSQL exposé sur le port hôte 5433** | Le port 5432 est déjà utilisé par un autre projet sur le poste de développement ; 5433 évite le conflit. Modifiable via `POSTGRES_PORT` et `DATABASE_URL`. |

## Décisions pédagogiques en attente (responsable)
Voir [BUSINESS_RULES.md](BUSINESS_RULES.md#points-en-attente-darbitrage-ne-pas-coder-de-valeur-définitive) : durées d'étape selon l'âge, conditions d'accès aux évaluations, seuils, gestion des comptes, conservation des données.
