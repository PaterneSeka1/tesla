# Base de données

PostgreSQL 18 (Docker Compose en développement) · Prisma 7 avec `@prisma/adapter-pg` · schéma : `apps/api/prisma/schema.prisma`.

## Modèles actuels

| Modèle (table) | Rôle | Points notables |
| --- | --- | --- |
| `User` (`users`) | Compte | `email` unique (minuscules), `role` (`ROUTIER`/`CHEF`/`RESPONSABLE`), `passwordHash` nullable, jamais supprimé (`isActive`) |
| `Session` (`sessions`) | Session serveur | Seul `tokenHash` est stocké ; `expiresAt`, `revokedAt` ; supprimée avec l'utilisateur (`Cascade`) |
| `ScoutProfile` (`scout_profiles`) | Profil d'un routier | 1–1 avec `User` ; `joinedAt`, `birthDate` optionnelle (durées dépendant de l'âge), `currentStageId` |
| `ProgressionStage` (`progression_stages`) | Référentiel des étapes | `code` et `position` uniques ; alimenté par le seed |
| `AuditLog` (`audit_logs`) | Journal | Ajout seul ; `actorId` null = action système ; index `(entityType, entityId)`, `actorId`, `createdAt` |

## Conventions
- UUID v7 (`@default(uuid(7)) @db.Uuid`), tables et colonnes en snake_case.
- Dates `timestamptz(3)` en UTC ; dates calendaires en `date`.
- `onDelete` explicite ; `Restrict` par défaut.
- Client généré dans `apps/api/src/generated/prisma` (ignoré par Git, régénéré au `npm install`).

## Migrations

| Commande | Usage |
| --- | --- |
| `npm run db:migrate -- --name <nom>` | Créer et appliquer une migration (développement) |
| `npm run db:deploy` | Appliquer les migrations existantes (CI/production) |
| `npm run db:seed` | Seed idempotent (étapes de progression uniquement) |
| `npm run db:generate` | Régénérer le client |

Migration initiale : `prisma/migrations/20261028204443_init` (vérifiée : création des 5 tables, de l'enum `Role`, des index et clés étrangères, aucun `DROP`).

Les UUID v7 sont générés par le client Prisma (pas de valeur par défaut SQL) : toute insertion SQL directe doit fournir l'`id`. Aucune migration destructive sans plan validé (voir `.claude/rules/database.md`).

## Extensions prévues (non créées)
Modules, versions de module, leçons, évaluations, questions, tentatives/réponses, validations d'acquis, déblocages exceptionnels, programme annuel et séances, historique des étapes. Chacune sera ajoutée dans la phase qui l'utilise.
