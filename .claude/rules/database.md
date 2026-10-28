---
paths:
  - "apps/api/prisma/**"
  - "apps/api/prisma.config.ts"
  - "apps/api/src/prisma/**"
---
# Règles base de données (Prisma / PostgreSQL)

## Conventions de schéma
- Identifiants `String @id @default(uuid(7)) @db.Uuid`.
- Modèles en PascalCase, tables en snake_case pluriel (`@@map`), colonnes en snake_case (`@map`).
- Dates `@db.Timestamptz(3)` (UTC) ; dates calendaires `@db.Date`.
- Toujours `createdAt` ; `updatedAt` sur les données modifiables.

## Relations et index
- `onDelete` explicite sur chaque relation. Par défaut `Restrict` ; `Cascade` seulement pour des données dépendantes sans valeur propre (ex. sessions).
- Index sur chaque clé étrangère filtrée et sur les colonnes de tri/filtre fréquentes.

## Transactions
- `prisma.$transaction` pour toute opération multi-écritures, notamment action métier + `AuditLog`.

## Intégrité et historisation
- Comptes jamais supprimés : `isActive = false`.
- `AuditLog` en ajout seul (aucune mise à jour, aucune suppression).
- Les changements d'état pédagogiques (publication, validation, déblocage) doivent rester traçables.

## Migrations
- Créer : `npm run db:migrate -- --name <nom_explicite>` ; relire le SQL avant de le conserver.
- Ne jamais modifier une migration déjà appliquée ailleurs ; en créer une nouvelle.
- **Interdit sans autorisation explicite** : `migrate reset`, `db push --force-reset`, `DROP`, suppression de colonne ou de table, `deleteMany` sans filtre.
- Production : `npm run db:deploy` uniquement, après sauvegarde.

## Seed
- `prisma/seed.ts` idempotent (`upsert`). Données de référence ou synthétiques uniquement, jamais de données réelles ni de mot de passe réel.
