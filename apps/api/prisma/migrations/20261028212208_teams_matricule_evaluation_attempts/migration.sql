-- CreateEnum
CREATE TYPE "EvaluationMode" AS ENUM ('EN_LIGNE', 'HORS_LIGNE', 'PAPIER');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('PREPAREE', 'EN_COURS', 'A_CORRIGER', 'SOUMISE', 'VALIDEE', 'REFUSEE', 'ANNULEE');

-- AlterTable : le profil routier porte sa propre identité et ne dépend plus d'un compte (RM-001).
-- Colonnes ajoutées nullables, reprises depuis le compte lié, puis rendues obligatoires :
-- migration compatible avec des profils existants (aucune donnée supprimée).
ALTER TABLE "scout_profiles" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "matricule" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

UPDATE "scout_profiles" AS sp
SET "first_name" = u."first_name", "last_name" = u."last_name"
FROM "users" AS u
WHERE u."id" = sp."user_id";

ALTER TABLE "scout_profiles" ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_assignments" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "assigned_by_id" UUID,
    "ended_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "stage_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_versions" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "answer_key" JSONB,
    "published_at" TIMESTAMPTZ(3),
    "published_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_attempts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "evaluation_version_id" UUID NOT NULL,
    "mode" "EvaluationMode" NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'PREPAREE',
    "planned_for" DATE,
    "completed_at" TIMESTAMPTZ(3),
    "recorded_at" TIMESTAMPTZ(3),
    "answers" JSONB,
    "score" DECIMAL(7,2),
    "max_score" DECIMAL(7,2),
    "observations" TEXT,
    "evidence_file_key" TEXT,
    "waiver_id" UUID,
    "created_by_id" UUID NOT NULL,
    "recorded_by_id" UUID,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_comment" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evaluation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_attempt_events" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_status" "AttemptStatus",
    "to_status" "AttemptStatus" NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_attempt_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_code_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attempt_code_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "evaluation_waivers" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "revocation_reason" TEXT,

    CONSTRAINT "evaluation_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE INDEX "team_assignments_scout_profile_id_started_at_idx" ON "team_assignments"("scout_profile_id", "started_at");

-- CreateIndex
CREATE INDEX "team_assignments_team_id_idx" ON "team_assignments"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_assignments_one_open_per_scout" ON "team_assignments"("scout_profile_id") WHERE (ended_at IS NULL);

-- CreateIndex
CREATE INDEX "evaluations_stage_id_idx" ON "evaluations"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_evaluation_id_version_key" ON "evaluation_versions"("evaluation_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_id_evaluation_id_key" ON "evaluation_versions"("id", "evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_attempts_code_key" ON "evaluation_attempts"("code");

-- CreateIndex
CREATE INDEX "evaluation_attempts_scout_profile_id_created_at_idx" ON "evaluation_attempts"("scout_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_attempts_evaluation_id_idx" ON "evaluation_attempts"("evaluation_id");

-- CreateIndex
CREATE INDEX "evaluation_attempts_evaluation_version_id_evaluation_id_idx" ON "evaluation_attempts"("evaluation_version_id", "evaluation_id");

-- CreateIndex
CREATE INDEX "evaluation_attempts_status_idx" ON "evaluation_attempts"("status");

-- CreateIndex
CREATE INDEX "evaluation_attempts_waiver_id_idx" ON "evaluation_attempts"("waiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_attempts_one_open_per_scout" ON "evaluation_attempts"("scout_profile_id", "evaluation_id") WHERE (status IN ('PREPAREE', 'EN_COURS', 'A_CORRIGER', 'SOUMISE'));

-- CreateIndex
CREATE INDEX "evaluation_attempt_events_attempt_id_created_at_idx" ON "evaluation_attempt_events"("attempt_id", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_attempt_events_actor_id_idx" ON "evaluation_attempt_events"("actor_id");

-- CreateIndex
CREATE INDEX "evaluation_waivers_scout_profile_id_evaluation_id_idx" ON "evaluation_waivers"("scout_profile_id", "evaluation_id");

-- CreateIndex
CREATE INDEX "evaluation_waivers_evaluation_id_idx" ON "evaluation_waivers"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "scout_profiles_matricule_key" ON "scout_profiles"("matricule");

-- CreateIndex
CREATE INDEX "scout_profiles_last_name_first_name_idx" ON "scout_profiles"("last_name", "first_name");

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_evaluation_version_id_evaluation_id_fkey" FOREIGN KEY ("evaluation_version_id", "evaluation_id") REFERENCES "evaluation_versions"("id", "evaluation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_waiver_id_fkey" FOREIGN KEY ("waiver_id") REFERENCES "evaluation_waivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempt_events" ADD CONSTRAINT "evaluation_attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "evaluation_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_attempt_events" ADD CONSTRAINT "evaluation_attempt_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_waivers" ADD CONSTRAINT "evaluation_waivers_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_waivers" ADD CONSTRAINT "evaluation_waivers_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_waivers" ADD CONSTRAINT "evaluation_waivers_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_waivers" ADD CONSTRAINT "evaluation_waivers_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Contraintes d'intégrité non exprimables dans schema.prisma (ignorées par le diff Prisma).
-- Voir docs/DATABASE.md, section « Contraintes SQL complémentaires ».
-- ─────────────────────────────────────────────────────────────────────────────

-- Matricule (RM-002) : forme normalisée imposée en base (majuscules, sans espace, zéros initiaux conservés),
-- pour que l'unicité ne puisse pas être contournée par la casse ou les espaces.
ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_matricule_format_check"
  CHECK ("matricule" IS NULL OR "matricule" ~ '^[A-Z0-9][A-Z0-9./-]{0,31}$');

-- Affectations d'équipe (RM-003, RM-004) : période valide et aucun chevauchement pour un même routier.
-- L'index unique partiel « team_assignments_one_open_per_scout » garantit une seule affectation ouverte ;
-- la contrainte d'exclusion couvre aussi les périodes closes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_period_check"
  CHECK ("ended_at" IS NULL OR "ended_at" > "started_at");

ALTER TABLE "team_assignments" ADD CONSTRAINT "team_assignments_no_overlap"
  EXCLUDE USING gist (
    "scout_profile_id" WITH =,
    tstzrange("started_at", "ended_at", '[)') WITH &&
  );

-- Versions d'évaluation.
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_version_check"
  CHECK ("version" > 0);

-- Tentatives (RM-007, RM-011). La table est créée par cette migration : aucune tentative historique
-- sans code n'existe, donc aucune reprise de données n'est nécessaire.
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_code_format_check"
  CHECK ("code" ~ '^NT-[0-9]{4}-[0-9]{6}$');

ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_score_check"
  CHECK (
    ("score" IS NULL OR "score" >= 0)
    AND ("max_score" IS NULL OR "max_score" > 0)
    AND ("score" IS NULL OR "max_score" IS NULL OR "score" <= "max_score")
  );

-- Références immuables : le code, le routier, l'évaluation, la version, le mode et l'auteur
-- d'une tentative ne changent jamais après émission ; une tentative n'est jamais supprimée.
CREATE FUNCTION "evaluation_attempts_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une tentative d''évaluation ne peut pas être supprimée (annuler la tentative).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."code" IS DISTINCT FROM OLD."code"
    OR NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
    OR NEW."evaluation_id" IS DISTINCT FROM OLD."evaluation_id"
    OR NEW."evaluation_version_id" IS DISTINCT FROM OLD."evaluation_version_id"
    OR NEW."mode" IS DISTINCT FROM OLD."mode"
    OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Les références d''une tentative d''évaluation sont immuables.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "evaluation_attempts_guard"
  BEFORE UPDATE OR DELETE ON "evaluation_attempts"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_attempts_guard"();

-- Historique des tentatives en ajout seul.
CREATE FUNCTION "evaluation_attempt_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'L''historique des tentatives est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "evaluation_attempt_events_append_only"
  BEFORE UPDATE OR DELETE ON "evaluation_attempt_events"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_attempt_events_append_only"();

-- Compteur annuel des codes.
ALTER TABLE "attempt_code_counters" ADD CONSTRAINT "attempt_code_counters_check"
  CHECK ("year" BETWEEN 2000 AND 9999 AND "last_value" BETWEEN 1 AND 999999);

-- Dérogations.
ALTER TABLE "evaluation_waivers" ADD CONSTRAINT "evaluation_waivers_period_check"
  CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at");
