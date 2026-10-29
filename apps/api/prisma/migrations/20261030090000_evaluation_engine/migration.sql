-- Phase 3 : moteur d'évaluation (questionnaires versionnés, questions, propositions, réponses, historique).
-- Migration additive : aucune colonne ni table supprimée. Les colonnes JSON antérieures (`questions`,
-- `answer_key`, `answers`) sont conservées pour l'historique. Voir docs/DATABASE.md.
-- CreateEnum
CREATE TYPE "EvaluationVersionStatus" AS ENUM ('BROUILLON', 'SOUMIS', 'A_CORRIGER', 'REFUSE', 'APPROUVE', 'PUBLIE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "EvaluationVersionAction" AS ENUM ('CREEE', 'SOUMISE', 'REPRISE', 'CORRECTIONS_DEMANDEES', 'REFUSEE', 'APPROUVEE', 'PUBLIEE', 'REMPLACEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'VRAI_FAUX', 'REPONSE_COURTE', 'REPONSE_DEVELOPPEE');

-- CreateEnum
CREATE TYPE "ScoringPolicy" AS ENUM ('TOUT_OU_RIEN', 'CREDIT_PARTIEL');

-- AlterTable
ALTER TABLE "evaluation_attempts" ADD COLUMN     "correction_revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "started_at" TIMESTAMPTZ(3),
ADD COLUMN     "submitted_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "evaluation_versions" ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "archived_at" TIMESTAMPTZ(3),
ADD COLUMN     "based_on_version_id" UUID,
ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "instructions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "max_attempts" INTEGER,
ADD COLUMN     "module_version_id" UUID,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "EvaluationVersionStatus" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "submission_note" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMPTZ(3),
ADD COLUMN     "submitted_by_id" UUID,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by_id" UUID,
ALTER COLUMN "questions" DROP NOT NULL;

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "module_id" UUID,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "published_version_id" UUID;

-- Reprise des versions antérieures (format JSON de la phase 1 bis), en trois temps pour `title` :
-- titre repris de l'évaluation ; la dernière version publiée devient PUBLIE, les publications plus
-- anciennes ARCHIVE ; parmi les versions jamais publiées, seule la plus récente postérieure à la
-- publication reste BROUILLON, les autres sont closes (REFUSE). Aucune tentative n'est modifiée.
UPDATE "evaluation_versions" v SET "title" = e."title"
  FROM "evaluations" e WHERE e."id" = v."evaluation_id";
ALTER TABLE "evaluation_versions" ALTER COLUMN "title" SET NOT NULL;

WITH ranked AS (
  SELECT "id", "published_at",
    row_number() OVER (PARTITION BY "evaluation_id", ("published_at" IS NULL) ORDER BY "version" DESC) AS rn,
    max("version") FILTER (WHERE "published_at" IS NOT NULL) OVER (PARTITION BY "evaluation_id") AS last_published,
    "version"
  FROM "evaluation_versions"
)
UPDATE "evaluation_versions" v SET
  "status" = CASE
    WHEN r."published_at" IS NOT NULL AND r.rn = 1 THEN 'PUBLIE'::"EvaluationVersionStatus"
    WHEN r."published_at" IS NOT NULL THEN 'ARCHIVE'::"EvaluationVersionStatus"
    WHEN r.rn = 1 AND (r.last_published IS NULL OR r."version" > r.last_published) THEN 'BROUILLON'::"EvaluationVersionStatus"
    ELSE 'REFUSE'::"EvaluationVersionStatus" END,
  "archived_at" = CASE WHEN r."published_at" IS NOT NULL AND r.rn > 1 THEN now() ELSE NULL END
FROM ranked r WHERE r."id" = v."id";

UPDATE "evaluations" e SET "published_version_id" = v."id"
  FROM "evaluation_versions" v
  WHERE v."evaluation_id" = e."id" AND v."status" = 'PUBLIE';

-- CreateTable
CREATE TABLE "evaluation_questions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" DECIMAL(6,2) NOT NULL,
    "scoring_policy" "ScoringPolicy" NOT NULL DEFAULT 'TOUT_OU_RIEN',
    "guidance" TEXT,
    "expected_answer" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "evaluation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_answer_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_version_events" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "EvaluationVersionAction" NOT NULL,
    "from_status" "EvaluationVersionStatus",
    "to_status" "EvaluationVersionStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_version_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_ids" UUID[],
    "text_answer" TEXT,
    "awarded_points" DECIMAL(6,2),
    "auto_scored" BOOLEAN NOT NULL DEFAULT false,
    "appreciation" TEXT,
    "grader_comment" TEXT,
    "graded_by_id" UUID,
    "graded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_questions_version_id_position_idx" ON "evaluation_questions"("version_id", "position");

-- CreateIndex
CREATE INDEX "evaluation_questions_created_by_id_idx" ON "evaluation_questions"("created_by_id");

-- CreateIndex
CREATE INDEX "evaluation_questions_updated_by_id_idx" ON "evaluation_questions"("updated_by_id");

-- CreateIndex
CREATE INDEX "evaluation_answer_options_question_id_position_idx" ON "evaluation_answer_options"("question_id", "position");

-- CreateIndex
CREATE INDEX "evaluation_version_events_evaluation_id_created_at_idx" ON "evaluation_version_events"("evaluation_id", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_version_events_version_id_created_at_idx" ON "evaluation_version_events"("version_id", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_version_events_actor_id_idx" ON "evaluation_version_events"("actor_id");

-- CreateIndex
CREATE INDEX "attempt_answers_question_id_idx" ON "attempt_answers"("question_id");

-- CreateIndex
CREATE INDEX "attempt_answers_graded_by_id_idx" ON "attempt_answers"("graded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key" ON "attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "evaluation_versions_status_idx" ON "evaluation_versions"("status");

-- CreateIndex
CREATE INDEX "evaluation_versions_based_on_version_id_idx" ON "evaluation_versions"("based_on_version_id");

-- CreateIndex
CREATE INDEX "evaluation_versions_module_version_id_idx" ON "evaluation_versions"("module_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_one_working" ON "evaluation_versions"("evaluation_id") WHERE (status = ANY (ARRAY['BROUILLON'::"EvaluationVersionStatus", 'SOUMIS'::"EvaluationVersionStatus", 'A_CORRIGER'::"EvaluationVersionStatus", 'APPROUVE'::"EvaluationVersionStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_versions_one_published" ON "evaluation_versions"("evaluation_id") WHERE (status = 'PUBLIE'::"EvaluationVersionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_number_key" ON "evaluations"("number");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_published_version_id_key" ON "evaluations"("published_version_id");

-- CreateIndex
CREATE INDEX "evaluations_module_id_idx" ON "evaluations"("module_id");

-- CreateIndex
CREATE INDEX "evaluations_created_by_id_idx" ON "evaluations"("created_by_id");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "evaluation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_based_on_version_id_fkey" FOREIGN KEY ("based_on_version_id") REFERENCES "evaluation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_module_version_id_fkey" FOREIGN KEY ("module_version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "evaluation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_answer_options" ADD CONSTRAINT "evaluation_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "evaluation_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_version_events" ADD CONSTRAINT "evaluation_version_events_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_version_events" ADD CONSTRAINT "evaluation_version_events_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "evaluation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_version_events" ADD CONSTRAINT "evaluation_version_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "evaluation_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "evaluation_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Contraintes complémentaires (ignorées par Prisma, voir docs/DATABASE.md)
-- ─────────────────────────────────────────────────────────────

-- Bornes (mêmes limites que @tesla/shared).
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_values_check"
  CHECK ("revision" > 0
    AND length(btrim("title")) BETWEEN 1 AND 150
    AND length("instructions") <= 3000
    AND ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 1 AND 600)
    AND ("max_attempts" IS NULL OR "max_attempts" BETWEEN 1 AND 20));

ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_values_check"
  CHECK ("position" >= 0 AND "revision" > 0
    AND length(btrim("prompt")) BETWEEN 1 AND 2000
    AND "points" > 0 AND "points" <= 1000);

ALTER TABLE "evaluation_answer_options" ADD CONSTRAINT "evaluation_answer_options_values_check"
  CHECK ("position" >= 0 AND length(btrim("label")) BETWEEN 1 AND 500);

ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_values_check"
  CHECK (("awarded_points" IS NULL OR "awarded_points" >= 0)
    AND ("text_answer" IS NULL OR length("text_answer") <= 5000));

ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_correction_revision_check"
  CHECK ("correction_revision" > 0);

-- Version : jamais supprimée ; contenu figé hors brouillon ; transitions contrôlées (comme les modules).
CREATE FUNCTION "evaluation_versions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une version de questionnaire ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."evaluation_id" IS DISTINCT FROM OLD."evaluation_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
    OR NEW."based_on_version_id" IS DISTINCT FROM OLD."based_on_version_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'L''évaluation, le numéro, l''auteur et l''origine d''une version sont immuables.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" <> 'BROUILLON' AND (
    NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."instructions" IS DISTINCT FROM OLD."instructions"
    OR NEW."duration_minutes" IS DISTINCT FROM OLD."duration_minutes"
    OR NEW."max_attempts" IS DISTINCT FROM OLD."max_attempts"
    OR NEW."questions" IS DISTINCT FROM OLD."questions"
    OR NEW."answer_key" IS DISTINCT FROM OLD."answer_key") THEN
    RAISE EXCEPTION 'Le contenu d''une version n''est modifiable qu''à l''état brouillon.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'BROUILLON' AND NEW."status" = 'SOUMIS')
    OR (OLD."status" = 'SOUMIS' AND NEW."status" IN ('APPROUVE', 'A_CORRIGER', 'REFUSE'))
    OR (OLD."status" = 'APPROUVE' AND NEW."status" IN ('PUBLIE', 'A_CORRIGER'))
    OR (OLD."status" = 'A_CORRIGER' AND NEW."status" = 'BROUILLON')
    OR (OLD."status" = 'PUBLIE' AND NEW."status" = 'ARCHIVE')) THEN
    RAISE EXCEPTION 'Transition de % vers % interdite.', OLD."status", NEW."status"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "evaluation_versions_guard"
  BEFORE UPDATE OR DELETE ON "evaluation_versions"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_versions_guard"();

-- Questions : écriture uniquement dans une version brouillon ; une question ne change jamais de version.
CREATE FUNCTION "evaluation_questions_draft_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status "EvaluationVersionStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."version_id" IS DISTINCT FROM OLD."version_id" THEN
    RAISE EXCEPTION 'Une question ne peut pas changer de version.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT "status" INTO parent_status FROM "evaluation_versions"
    WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."version_id" ELSE NEW."version_id" END;
  IF parent_status IS DISTINCT FROM 'BROUILLON' THEN
    RAISE EXCEPTION 'Les questions d''une version ne sont modifiables qu''à l''état brouillon.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "evaluation_questions_draft_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "evaluation_questions"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_questions_draft_guard"();

-- Propositions : même règle, via la question parente.
CREATE FUNCTION "evaluation_answer_options_draft_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status "EvaluationVersionStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."question_id" IS DISTINCT FROM OLD."question_id" THEN
    RAISE EXCEPTION 'Une proposition ne peut pas changer de question.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT v."status" INTO parent_status
    FROM "evaluation_questions" q JOIN "evaluation_versions" v ON v."id" = q."version_id"
    WHERE q."id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."question_id" ELSE NEW."question_id" END;
  IF parent_status IS DISTINCT FROM 'BROUILLON' THEN
    RAISE EXCEPTION 'Les propositions d''une version ne sont modifiables qu''à l''état brouillon.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "evaluation_answer_options_draft_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "evaluation_answer_options"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_answer_options_draft_guard"();

-- Évaluation jamais supprimée ; la version publiée courante lui appartient et est à l'état PUBLIE.
CREATE FUNCTION "evaluations_published_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une évaluation ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."published_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "evaluation_versions"
    WHERE "id" = NEW."published_version_id" AND "evaluation_id" = NEW."id" AND "status" = 'PUBLIE') THEN
    RAISE EXCEPTION 'La version publiée doit appartenir à l''évaluation et être à l''état publié.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "evaluations_published_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "evaluations"
  FOR EACH ROW EXECUTE FUNCTION "evaluations_published_guard"();

-- Réponses : jamais supprimées ; la question appartient à la version de la tentative ; écriture
-- uniquement tant que la tentative est ouverte à la saisie (préparée, en cours ou à corriger).
CREATE FUNCTION "attempt_answers_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  attempt_status "AttemptStatus";
  attempt_version UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une réponse ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."attempt_id" IS DISTINCT FROM OLD."attempt_id"
    OR NEW."question_id" IS DISTINCT FROM OLD."question_id") THEN
    RAISE EXCEPTION 'Une réponse ne change ni de tentative ni de question.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT "status", "evaluation_version_id" INTO attempt_status, attempt_version
    FROM "evaluation_attempts" WHERE "id" = NEW."attempt_id";
  IF NOT EXISTS (SELECT 1 FROM "evaluation_questions"
    WHERE "id" = NEW."question_id" AND "version_id" = attempt_version) THEN
    RAISE EXCEPTION 'La question n''appartient pas à la version de la tentative.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF attempt_status NOT IN ('PREPAREE', 'EN_COURS', 'A_CORRIGER') THEN
    RAISE EXCEPTION 'Les réponses de cette tentative ne sont plus modifiables (statut %).', attempt_status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "attempt_answers_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "attempt_answers"
  FOR EACH ROW EXECUTE FUNCTION "attempt_answers_guard"();

-- Historique des questionnaires en ajout seul.
CREATE FUNCTION "evaluation_version_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'L''historique des questionnaires est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "evaluation_version_events_append_only"
  BEFORE UPDATE OR DELETE ON "evaluation_version_events"
  FOR EACH ROW EXECUTE FUNCTION "evaluation_version_events_append_only"();
