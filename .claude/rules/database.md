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

## Profil routier et compte
- `ScoutProfile` = identité métier (nom, matricule, équipe, progression, résultats) ; `User` = connexion. `scout_profiles.user_id` est **facultatif et unique** (1–1).
- Toute donnée pédagogique (tentatives, dérogations, futures validations) référence `scout_profile_id`, jamais seulement `user_id`.
- Rattacher un compte = renseigner `user_id` sur le profil existant (mise à jour conditionnelle `user_id IS NULL`), jamais créer un profil.

## Contraintes métier en base
- **Matricule** : `TEXT` (jamais entier), unique si non nul, forme normalisée imposée par `scout_profiles_matricule_format_check` (même motif que `MATRICULE_PATTERN` de `@tesla/shared`).
- **Affectations d'équipe** : index unique partiel `team_assignments_one_open_per_scout` (`ended_at IS NULL`) + exclusion `team_assignments_no_overlap` (`btree_gist`) ; on clôt l'affectation précédente au lieu de la modifier ou de la supprimer.
- **Codes de tentative** : émis uniquement par `issueAttemptCode` (compteur `attempt_code_counters`, `INSERT … ON CONFLICT DO UPDATE … RETURNING`) dans la transaction de création. Jamais `count()`, jamais `Math.random()`, jamais côté web.
- **Immutabilité** : le trigger `evaluation_attempts_guard` interdit la suppression d'une tentative et la modification de `code`, `scout_profile_id`, `evaluation_id`, `evaluation_version_id`, `mode`, `created_by_id`, `created_at`. `evaluation_attempt_events` est en ajout seul (trigger).
- **Doublons** : index unique partiel `evaluation_attempts_one_open_per_scout`. Prédicat écrit sous la forme canonique PostgreSQL (`status = ANY (ARRAY[...])`) dans `schema.prisma`, sinon le diff Prisma signale une fausse dérive.
- Les CHECK, exclusions et triggers sont ajoutés en SQL à la fin de la migration ; Prisma les ignore (vérifier l'absence de dérive avec `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`).

## Migrations
- Créer : `npm run db:migrate -- --name <nom_explicite>` ; relire le SQL avant de le conserver.
- Ne jamais modifier une migration déjà appliquée ailleurs ; en créer une nouvelle.
- **Interdit sans autorisation explicite** : `migrate reset`, `db push --force-reset`, `DROP`, suppression de colonne ou de table, `deleteMany` sans filtre.
- Production : `npm run db:deploy` uniquement, après sauvegarde.
- Politique additive : ajouter une colonne obligatoire en trois temps (nullable → reprise des données → `SET NOT NULL`). Ne jamais réécrire scores, décisions ou versions de tentatives existantes ; une nouvelle colonne obligatoire de tentative (ex. code) doit être renseignée pour l'historique **avant** la contrainte `NOT NULL`.
- Environnement non interactif : `migrate dev` est refusé ; générer le SQL avec `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, le relire, l'enregistrer dans un dossier horodaté, puis `db:deploy`. Tester d'abord sur une base jetable.
- Tests d'intégration : base dédiée dont le nom finit par `_test` (`TEST_DATABASE_URL`), garde-fou dans `test/int-database.ts`.

## Seed
- `prisma/seed.ts` idempotent (`upsert`). Données de référence ou synthétiques uniquement, jamais de données réelles ni de mot de passe réel.
