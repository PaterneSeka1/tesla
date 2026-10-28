-- Phase 1: routiers sans compte, matricules et équipes (migration additive).
ALTER TABLE "scout_profiles" ADD COLUMN "first_name" TEXT;
ALTER TABLE "scout_profiles" ADD COLUMN "last_name" TEXT;
ALTER TABLE "scout_profiles" ADD COLUMN "matricule" TEXT;
ALTER TABLE "scout_profiles" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
-- Backfill des noms depuis les comptes existants, avant de rendre les colonnes obligatoires.
UPDATE "scout_profiles" p SET "first_name" = u."first_name", "last_name" = u."last_name" FROM "users" u WHERE p."user_id" = u."id";
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "scout_profiles" WHERE "first_name" IS NULL OR "last_name" IS NULL) THEN RAISE EXCEPTION 'Profil existant sans nom : migration arrêtée'; END IF; END $$;
ALTER TABLE "scout_profiles" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "scout_profiles" ALTER COLUMN "last_name" SET NOT NULL;
ALTER TABLE "scout_profiles" ALTER COLUMN "user_id" DROP NOT NULL;
CREATE UNIQUE INDEX "scout_profiles_matricule_key" ON "scout_profiles"("matricule");
CREATE INDEX "scout_profiles_last_name_first_name_idx" ON "scout_profiles"("last_name", "first_name");
CREATE INDEX "scout_profiles_is_active_idx" ON "scout_profiles"("is_active");
CREATE TABLE "teams" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "teams_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");
CREATE TABLE "team_assignments" ("id" UUID NOT NULL, "scout_id" UUID NOT NULL, "team_id" UUID NOT NULL, "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ended_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "team_assignments_pkey" PRIMARY KEY ("id"), CONSTRAINT "team_assignments_valid_dates" CHECK ("ended_at" IS NULL OR "ended_at" > "started_at"));
CREATE INDEX "team_assignments_scout_id_started_at_idx" ON "team_assignments"("scout_id","started_at");
CREATE INDEX "team_assignments_team_id_ended_at_idx" ON "team_assignments"("team_id","ended_at");
CREATE UNIQUE INDEX "team_assignments_one_active_per_scout" ON "team_assignments"("scout_id") WHERE "ended_at" IS NULL;
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_scout_id_fkey" FOREIGN KEY ("scout_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
