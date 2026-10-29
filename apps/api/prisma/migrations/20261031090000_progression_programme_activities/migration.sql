-- CreateEnum
CREATE TYPE "StageChangeKind" AS ENUM ('INSCRIPTION', 'DECISION', 'CORRECTION', 'REPRISE');

-- CreateEnum
CREATE TYPE "CompetencyProposalStatus" AS ENUM ('EN_ATTENTE', 'COMPLEMENT_DEMANDE', 'APPROUVEE', 'REFUSEE', 'RETIREE');

-- CreateEnum
CREATE TYPE "CompetencyProposalAction" AS ENUM ('SOUMISE', 'PREUVE_AJOUTEE', 'COMPLEMENT_DEMANDE', 'RESOUMISE', 'APPROUVEE', 'REFUSEE', 'RETIREE');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('OBSERVATION', 'EVALUATION', 'ACTIVITE', 'ETUDE_MODULE', 'AUTRE');

-- CreateEnum
CREATE TYPE "CompetencyDecision" AS ENUM ('ACQUIS', 'A_RETRAVAILLER');

-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('LECTURE_NUMERIQUE', 'LECTURE_HORS_LIGNE', 'COURS_PAPIER', 'FORMATION_COLLECTIVE');

-- CreateEnum
CREATE TYPE "ActivityOrigin" AS ENUM ('PROGRAMME', 'SUPPLEMENTAIRE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANIFIEE', 'REPORTEE', 'REALISEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREEE', 'IMPORTEE', 'MODIFIEE', 'STATUT_MODIFIE', 'PRESENCES_ENREGISTREES');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSE');

-- AlterTable
ALTER TABLE "scout_profiles" ADD COLUMN     "current_stage_since" DATE;

-- CreateTable
CREATE TABLE "scout_stage_changes" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "kind" "StageChangeKind" NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID,
    "effective_on" DATE NOT NULL,
    "decided_by_id" UUID,
    "reason" TEXT NOT NULL,
    "observations" TEXT,
    "evidence" TEXT,
    "ceremony_reference" TEXT,
    "corrects_change_id" UUID,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "domain" TEXT,
    "stage_id" UUID,
    "observable_criteria" TEXT[],
    "min_evidence_count" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_modules" (
    "competency_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_modules_pkey" PRIMARY KEY ("competency_id","module_id")
);

-- CreateTable
CREATE TABLE "competency_proposals" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "status" "CompetencyProposalStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "justification" TEXT NOT NULL,
    "decision_comment" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "competency_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_proposal_events" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "CompetencyProposalAction" NOT NULL,
    "from_status" "CompetencyProposalStatus",
    "to_status" "CompetencyProposalStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_proposal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_evidences" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "observation_id" UUID,
    "attempt_id" UUID,
    "activity_id" UUID,
    "module_study_id" UUID,
    "description" TEXT,
    "added_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_validations" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "decision" "CompetencyDecision" NOT NULL,
    "justification" TEXT NOT NULL,
    "examined_evidence" JSONB NOT NULL,
    "decided_by_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "revocation_reason" TEXT,

    CONSTRAINT "competency_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_studies" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "module_version_id" UUID,
    "mode" "StudyMode" NOT NULL,
    "studied_on" DATE NOT NULL,
    "activity_id" UUID,
    "observation" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme_categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stage_id" UUID,
    "correspondence_validated" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "programme_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programmes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "programme_id" UUID,
    "origin" "ActivityOrigin" NOT NULL,
    "import_key" TEXT,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "objectives" TEXT[],
    "planned_on" DATE NOT NULL,
    "planned_location" TEXT,
    "leader_label" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "held_on" DATE,
    "location" TEXT,
    "content_done" TEXT,
    "difficulties" TEXT,
    "observations" TEXT,
    "report" TEXT,
    "status_reason" TEXT,
    "manually_edited_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_categories" (
    "activity_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "activity_categories_pkey" PRIMARY KEY ("activity_id","category_id")
);

-- CreateTable
CREATE TABLE "activity_modules" (
    "activity_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,

    CONSTRAINT "activity_modules_pkey" PRIMARY KEY ("activity_id","module_id")
);

-- CreateTable
CREATE TABLE "activity_competencies" (
    "activity_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "observed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "activity_competencies_pkey" PRIMARY KEY ("activity_id","competency_id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "from_status" "ActivityStatus",
    "to_status" "ActivityStatus",
    "comment" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_attendances" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scout_stage_changes_corrects_change_id_key" ON "scout_stage_changes"("corrects_change_id");

-- CreateIndex
CREATE INDEX "scout_stage_changes_scout_profile_id_decided_at_idx" ON "scout_stage_changes"("scout_profile_id", "decided_at");

-- CreateIndex
CREATE INDEX "scout_stage_changes_from_stage_id_idx" ON "scout_stage_changes"("from_stage_id");

-- CreateIndex
CREATE INDEX "scout_stage_changes_to_stage_id_idx" ON "scout_stage_changes"("to_stage_id");

-- CreateIndex
CREATE INDEX "scout_stage_changes_decided_by_id_idx" ON "scout_stage_changes"("decided_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_code_key" ON "competencies"("code");

-- CreateIndex
CREATE INDEX "competencies_stage_id_position_idx" ON "competencies"("stage_id", "position");

-- CreateIndex
CREATE INDEX "competencies_is_active_idx" ON "competencies"("is_active");

-- CreateIndex
CREATE INDEX "competency_modules_module_id_idx" ON "competency_modules"("module_id");

-- CreateIndex
CREATE INDEX "competency_proposals_status_created_at_idx" ON "competency_proposals"("status", "created_at");

-- CreateIndex
CREATE INDEX "competency_proposals_competency_id_idx" ON "competency_proposals"("competency_id");

-- CreateIndex
CREATE INDEX "competency_proposals_proposed_by_id_idx" ON "competency_proposals"("proposed_by_id");

-- CreateIndex
CREATE INDEX "competency_proposals_decided_by_id_idx" ON "competency_proposals"("decided_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_proposals_one_open" ON "competency_proposals"("scout_profile_id", "competency_id") WHERE (status = ANY (ARRAY['EN_ATTENTE'::"CompetencyProposalStatus", 'COMPLEMENT_DEMANDE'::"CompetencyProposalStatus"]));

-- CreateIndex
CREATE INDEX "competency_proposal_events_proposal_id_created_at_idx" ON "competency_proposal_events"("proposal_id", "created_at");

-- CreateIndex
CREATE INDEX "competency_proposal_events_actor_id_idx" ON "competency_proposal_events"("actor_id");

-- CreateIndex
CREATE INDEX "competency_evidences_proposal_id_idx" ON "competency_evidences"("proposal_id");

-- CreateIndex
CREATE INDEX "competency_evidences_observation_id_idx" ON "competency_evidences"("observation_id");

-- CreateIndex
CREATE INDEX "competency_evidences_attempt_id_idx" ON "competency_evidences"("attempt_id");

-- CreateIndex
CREATE INDEX "competency_evidences_activity_id_idx" ON "competency_evidences"("activity_id");

-- CreateIndex
CREATE INDEX "competency_evidences_module_study_id_idx" ON "competency_evidences"("module_study_id");

-- CreateIndex
CREATE INDEX "competency_evidences_added_by_id_idx" ON "competency_evidences"("added_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_validations_proposal_id_key" ON "competency_validations"("proposal_id");

-- CreateIndex
CREATE INDEX "competency_validations_scout_profile_id_decided_at_idx" ON "competency_validations"("scout_profile_id", "decided_at");

-- CreateIndex
CREATE INDEX "competency_validations_competency_id_idx" ON "competency_validations"("competency_id");

-- CreateIndex
CREATE INDEX "competency_validations_decided_by_id_idx" ON "competency_validations"("decided_by_id");

-- CreateIndex
CREATE INDEX "competency_validations_revoked_by_id_idx" ON "competency_validations"("revoked_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_validations_one_active_acquired" ON "competency_validations"("scout_profile_id", "competency_id") WHERE (decision = 'ACQUIS'::"CompetencyDecision" AND revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "module_studies_scout_profile_id_studied_on_idx" ON "module_studies"("scout_profile_id", "studied_on");

-- CreateIndex
CREATE INDEX "module_studies_module_id_idx" ON "module_studies"("module_id");

-- CreateIndex
CREATE INDEX "module_studies_module_version_id_idx" ON "module_studies"("module_version_id");

-- CreateIndex
CREATE INDEX "module_studies_activity_id_idx" ON "module_studies"("activity_id");

-- CreateIndex
CREATE INDEX "module_studies_recorded_by_id_idx" ON "module_studies"("recorded_by_id");

-- CreateIndex
CREATE INDEX "module_studies_cancelled_by_id_idx" ON "module_studies"("cancelled_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_studies_one_active" ON "module_studies"("scout_profile_id", "module_id", "studied_on", "mode") WHERE (cancelled_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "programme_categories_code_key" ON "programme_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programme_categories_label_key" ON "programme_categories"("label");

-- CreateIndex
CREATE UNIQUE INDEX "programme_categories_position_key" ON "programme_categories"("position");

-- CreateIndex
CREATE INDEX "programme_categories_stage_id_idx" ON "programme_categories"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "programmes_code_key" ON "programmes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "activities_import_key_key" ON "activities"("import_key");

-- CreateIndex
CREATE INDEX "activities_planned_on_idx" ON "activities"("planned_on");

-- CreateIndex
CREATE INDEX "activities_status_planned_on_idx" ON "activities"("status", "planned_on");

-- CreateIndex
CREATE INDEX "activities_programme_id_idx" ON "activities"("programme_id");

-- CreateIndex
CREATE INDEX "activities_created_by_id_idx" ON "activities"("created_by_id");

-- CreateIndex
CREATE INDEX "activities_updated_by_id_idx" ON "activities"("updated_by_id");

-- CreateIndex
CREATE INDEX "activity_categories_category_id_idx" ON "activity_categories"("category_id");

-- CreateIndex
CREATE INDEX "activity_modules_module_id_idx" ON "activity_modules"("module_id");

-- CreateIndex
CREATE INDEX "activity_competencies_competency_id_idx" ON "activity_competencies"("competency_id");

-- CreateIndex
CREATE INDEX "activity_events_activity_id_created_at_idx" ON "activity_events"("activity_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_actor_id_idx" ON "activity_events"("actor_id");

-- CreateIndex
CREATE INDEX "activity_attendances_scout_profile_id_idx" ON "activity_attendances"("scout_profile_id");

-- CreateIndex
CREATE INDEX "activity_attendances_recorded_by_id_idx" ON "activity_attendances"("recorded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_attendances_activity_id_scout_profile_id_key" ON "activity_attendances"("activity_id", "scout_profile_id");

-- AddForeignKey
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_corrects_change_id_fkey" FOREIGN KEY ("corrects_change_id") REFERENCES "scout_stage_changes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_modules" ADD CONSTRAINT "competency_modules_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_modules" ADD CONSTRAINT "competency_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposals" ADD CONSTRAINT "competency_proposals_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposals" ADD CONSTRAINT "competency_proposals_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposals" ADD CONSTRAINT "competency_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposals" ADD CONSTRAINT "competency_proposals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposal_events" ADD CONSTRAINT "competency_proposal_events_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "competency_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_proposal_events" ADD CONSTRAINT "competency_proposal_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "competency_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "scout_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "evaluation_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_module_study_id_fkey" FOREIGN KEY ("module_study_id") REFERENCES "module_studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "competency_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_module_version_id_fkey" FOREIGN KEY ("module_version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_categories" ADD CONSTRAINT "programme_categories_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_categories" ADD CONSTRAINT "programme_categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_categories" ADD CONSTRAINT "activity_categories_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_categories" ADD CONSTRAINT "activity_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "programme_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_modules" ADD CONSTRAINT "activity_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_competencies" ADD CONSTRAINT "activity_competencies_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_competencies" ADD CONSTRAINT "activity_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attendances" ADD CONSTRAINT "activity_attendances_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Contraintes métier (Prisma ne les modélise pas ; voir docs/DATABASE.md) ───────────────

ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_reason_check"
  CHECK (length(btrim("reason")) BETWEEN 3 AND 2000);
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_correction_check"
  CHECK (("kind" = 'CORRECTION') = ("corrects_change_id" IS NOT NULL));
ALTER TABLE "scout_stage_changes" ADD CONSTRAINT "scout_stage_changes_author_check"
  CHECK ("kind" = 'REPRISE' OR "decided_by_id" IS NOT NULL);

ALTER TABLE "competencies" ADD CONSTRAINT "competencies_code_check"
  CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$');
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_min_evidence_check"
  CHECK ("min_evidence_count" BETWEEN 1 AND 10);

ALTER TABLE "competency_proposals" ADD CONSTRAINT "competency_proposals_justification_check"
  CHECK (length(btrim("justification")) BETWEEN 3 AND 3000);

-- Un élément justificatif désigne exactement la donnée correspondant à sa nature.
ALTER TABLE "competency_evidences" ADD CONSTRAINT "competency_evidences_kind_check" CHECK (
  ("observation_id" IS NOT NULL)::int + ("attempt_id" IS NOT NULL)::int
    + ("activity_id" IS NOT NULL)::int + ("module_study_id" IS NOT NULL)::int
    = CASE WHEN "kind" = 'AUTRE' THEN 0 ELSE 1 END
  AND ("kind" <> 'OBSERVATION' OR "observation_id" IS NOT NULL)
  AND ("kind" <> 'EVALUATION' OR "attempt_id" IS NOT NULL)
  AND ("kind" <> 'ACTIVITE' OR "activity_id" IS NOT NULL)
  AND ("kind" <> 'ETUDE_MODULE' OR "module_study_id" IS NOT NULL)
  AND ("kind" <> 'AUTRE' OR length(btrim(coalesce("description", ''))) >= 3)
);

ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_justification_check"
  CHECK (length(btrim("justification")) BETWEEN 3 AND 3000);
ALTER TABLE "competency_validations" ADD CONSTRAINT "competency_validations_revocation_check"
  CHECK (("revoked_at" IS NULL) = ("revoked_by_id" IS NULL)
    AND ("revoked_at" IS NULL) = ("revocation_reason" IS NULL));

ALTER TABLE "module_studies" ADD CONSTRAINT "module_studies_cancellation_check"
  CHECK (("cancelled_at" IS NULL) = ("cancelled_by_id" IS NULL)
    AND ("cancelled_at" IS NULL) = ("cancel_reason" IS NULL));

ALTER TABLE "activities" ADD CONSTRAINT "activities_title_check"
  CHECK (length(btrim("title")) BETWEEN 1 AND 200);
ALTER TABLE "activities" ADD CONSTRAINT "activities_held_on_check"
  CHECK ("status" <> 'REALISEE' OR "held_on" IS NOT NULL);
ALTER TABLE "activities" ADD CONSTRAINT "activities_programme_check"
  CHECK ("origin" <> 'PROGRAMME' OR "programme_id" IS NOT NULL);

-- ─── Historiques en ajout seul ─────────────────────────────────────────────────────────

CREATE FUNCTION "phase4_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historique en ajout seul (%).', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "scout_stage_changes_append_only"
  BEFORE UPDATE OR DELETE ON "scout_stage_changes"
  FOR EACH ROW EXECUTE FUNCTION "phase4_append_only"();
CREATE TRIGGER "competency_proposal_events_append_only"
  BEFORE UPDATE OR DELETE ON "competency_proposal_events"
  FOR EACH ROW EXECUTE FUNCTION "phase4_append_only"();
CREATE TRIGGER "competency_evidences_append_only"
  BEFORE UPDATE OR DELETE ON "competency_evidences"
  FOR EACH ROW EXECUTE FUNCTION "phase4_append_only"();
CREATE TRIGGER "activity_events_append_only"
  BEFORE UPDATE OR DELETE ON "activity_events"
  FOR EACH ROW EXECUTE FUNCTION "phase4_append_only"();

-- Données pédagogiques jamais supprimées (annulation, révocation ou statut à la place).
CREATE FUNCTION "phase4_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Suppression interdite (%).', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "competency_proposals_no_delete"
  BEFORE DELETE ON "competency_proposals"
  FOR EACH ROW EXECUTE FUNCTION "phase4_no_delete"();
CREATE TRIGGER "activities_no_delete"
  BEFORE DELETE ON "activities"
  FOR EACH ROW EXECUTE FUNCTION "phase4_no_delete"();
CREATE TRIGGER "activity_attendances_no_delete"
  BEFORE DELETE ON "activity_attendances"
  FOR EACH ROW EXECUTE FUNCTION "phase4_no_delete"();
CREATE TRIGGER "competencies_no_delete"
  BEFORE DELETE ON "competencies"
  FOR EACH ROW EXECUTE FUNCTION "phase4_no_delete"();

-- Proposition : routier, compétence, auteur et date de soumission immuables.
CREATE FUNCTION "competency_proposals_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
    OR NEW."competency_id" IS DISTINCT FROM OLD."competency_id"
    OR NEW."proposed_by_id" IS DISTINCT FROM OLD."proposed_by_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Le routier, la compétence et l''auteur d''une proposition sont immuables.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" IN ('APPROUVEE', 'REFUSEE', 'RETIREE') THEN
    RAISE EXCEPTION 'Une proposition clôturée n''est plus modifiable.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "competency_proposals_guard"
  BEFORE UPDATE ON "competency_proposals"
  FOR EACH ROW EXECUTE FUNCTION "competency_proposals_guard"();

-- Validation officielle : jamais supprimée ; seule une révocation (unique, motivée) est possible.
CREATE FUNCTION "competency_validations_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une décision officielle ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."revoked_at" IS NOT NULL
    OR NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
    OR NEW."competency_id" IS DISTINCT FROM OLD."competency_id"
    OR NEW."proposal_id" IS DISTINCT FROM OLD."proposal_id"
    OR NEW."decision" IS DISTINCT FROM OLD."decision"
    OR NEW."justification" IS DISTINCT FROM OLD."justification"
    OR NEW."examined_evidence" IS DISTINCT FROM OLD."examined_evidence"
    OR NEW."decided_by_id" IS DISTINCT FROM OLD."decided_by_id"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at" THEN
    RAISE EXCEPTION 'Une décision officielle n''est modifiable que par une révocation unique.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "competency_validations_guard"
  BEFORE UPDATE OR DELETE ON "competency_validations"
  FOR EACH ROW EXECUTE FUNCTION "competency_validations_guard"();

-- Étude de module : jamais supprimée ; seule une annulation (unique, motivée) est possible.
CREATE FUNCTION "module_studies_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une étude de module ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."cancelled_at" IS NOT NULL
    OR (to_jsonb(NEW) - ARRAY['cancelled_at', 'cancelled_by_id', 'cancel_reason'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['cancelled_at', 'cancelled_by_id', 'cancel_reason']) THEN
    RAISE EXCEPTION 'Une étude de module n''est modifiable que par une annulation unique.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "module_studies_guard"
  BEFORE UPDATE OR DELETE ON "module_studies"
  FOR EACH ROW EXECUTE FUNCTION "module_studies_guard"();

-- Un élément justificatif (observation, tentative, étude) appartient au routier de la proposition.
CREATE FUNCTION "competency_evidences_same_scout"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected uuid;
  actual uuid;
BEGIN
  SELECT "scout_profile_id" INTO expected FROM "competency_proposals" WHERE "id" = NEW."proposal_id";
  IF NEW."observation_id" IS NOT NULL THEN
    SELECT "scout_profile_id" INTO actual FROM "scout_observations" WHERE "id" = NEW."observation_id";
  ELSIF NEW."attempt_id" IS NOT NULL THEN
    SELECT "scout_profile_id" INTO actual FROM "evaluation_attempts" WHERE "id" = NEW."attempt_id";
  ELSIF NEW."module_study_id" IS NOT NULL THEN
    SELECT "scout_profile_id" INTO actual FROM "module_studies" WHERE "id" = NEW."module_study_id";
  ELSE
    RETURN NEW;
  END IF;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'L''élément justificatif concerne un autre routier.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "competency_evidences_same_scout"
  BEFORE INSERT ON "competency_evidences"
  FOR EACH ROW EXECUTE FUNCTION "competency_evidences_same_scout"();

-- ─── Reprise de l'historique des étapes (journal d'audit des phases 1 à 3) ─────────────────
-- Les changements journalisés deviennent des entrées REPRISE ; l'étape initiale saisie à
-- l'inscription devient une entrée INSCRIPTION. Aucun profil n'est modifié hormis la date d'effet.

INSERT INTO "scout_stage_changes"
  ("id", "scout_profile_id", "kind", "from_stage_id", "to_stage_id", "effective_on", "decided_by_id",
   "reason", "decided_at")
SELECT uuidv7(), sp."id", 'INSCRIPTION', NULL, st."id", sp."joined_at", a."actor_id",
  'Étape initiale saisie à l''inscription.', a."created_at"
FROM "audit_logs" a
JOIN "scout_profiles" sp ON a."entity_id" = sp."id"::text
JOIN "progression_stages" st ON st."id"::text = a."metadata"->>'stageId'
WHERE a."action" = 'scout_profile.created' AND a."entity_type" = 'ScoutProfile';

INSERT INTO "scout_stage_changes"
  ("id", "scout_profile_id", "kind", "from_stage_id", "to_stage_id", "effective_on", "decided_by_id",
   "reason", "decided_at")
SELECT uuidv7(), sp."id", 'REPRISE', fs."id", ts."id", (a."created_at" AT TIME ZONE 'UTC')::date,
  a."actor_id", 'Changement enregistré avant l''historique structuré (motif non saisi).', a."created_at"
FROM "audit_logs" a
JOIN "scout_profiles" sp ON a."entity_id" = sp."id"::text
LEFT JOIN "progression_stages" fs ON fs."id"::text = a."metadata"->>'previousStageId'
LEFT JOIN "progression_stages" ts ON ts."id"::text = a."metadata"->>'nextStageId'
WHERE a."action" = 'scout_profile.stage_changed' AND a."entity_type" = 'ScoutProfile';

UPDATE "scout_profiles" sp
SET "current_stage_since" = coalesce(
  (SELECT c."effective_on" FROM "scout_stage_changes" c
   WHERE c."scout_profile_id" = sp."id" ORDER BY c."decided_at" DESC LIMIT 1),
  sp."joined_at")
WHERE sp."current_stage_id" IS NOT NULL;
