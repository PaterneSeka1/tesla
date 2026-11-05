-- Import Excel du programme annuel et suivi prévu / réalisé (D172). Migration additive uniquement :
-- colonnes facultatives, nouvelle table d'historique en ajout seul ; aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "ProgrammeImportFormat" AS ENUM ('XLSX', 'MARKDOWN');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "follow_up" TEXT,
ADD COLUMN     "held_by_label" TEXT,
ADD COLUMN     "outcomes" TEXT,
ADD COLUMN     "planned_format" TEXT,
ADD COLUMN     "planning_notes" TEXT,
ADD COLUMN     "source_attendance_count" INTEGER,
ADD COLUMN     "source_number" INTEGER,
ADD COLUMN     "source_status" TEXT;

-- AlterTable
ALTER TABLE "activity_categories" ADD COLUMN     "planned_content" TEXT;

-- CreateTable
CREATE TABLE "programme_imports" (
    "id" UUID NOT NULL,
    "programme_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "format" "ProgrammeImportFormat" NOT NULL,
    "file_name" TEXT,
    "file_sha256" TEXT,
    "sheet_name" TEXT,
    "counts" JSONB NOT NULL,
    "decisions" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programme_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programme_imports_programme_id_created_at_idx" ON "programme_imports"("programme_id", "created_at");

-- CreateIndex
CREATE INDEX "programme_imports_actor_id_idx" ON "programme_imports"("actor_id");

-- AddForeignKey
ALTER TABLE "programme_imports" ADD CONSTRAINT "programme_imports_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_imports" ADD CONSTRAINT "programme_imports_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contrôles d'intégrité (ignorés par Prisma).
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_source_attendance_count_check" CHECK ("source_attendance_count" IS NULL OR "source_attendance_count" >= 0),
  ADD CONSTRAINT "activities_source_number_check" CHECK ("source_number" IS NULL OR "source_number" >= 0);
ALTER TABLE "programme_imports"
  ADD CONSTRAINT "programme_imports_file_sha256_check" CHECK ("file_sha256" IS NULL OR "file_sha256" ~ '^[a-f0-9]{64}$');
ALTER TABLE "programmes"
  ADD CONSTRAINT "programmes_period_check" CHECK ("starts_on" IS NULL OR "ends_on" IS NULL OR "starts_on" < "ends_on");

-- Historique des imports en ajout seul (même fonction que activity_events).
CREATE TRIGGER "programme_imports_append_only"
  BEFORE UPDATE OR DELETE ON "programme_imports"
  FOR EACH ROW EXECUTE FUNCTION "phase4_append_only"();
