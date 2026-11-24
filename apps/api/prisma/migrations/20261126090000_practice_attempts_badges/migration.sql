-- Fiabilité de l'entraînement (D201) : tentatives idempotentes et versionnées, badges acquis
-- définitivement, identité stable des leçons. Migration additive : aucune donnée supprimée.
-- CreateEnum
CREATE TYPE "PracticeAttemptStatus" AS ENUM ('COMPTEE', 'PERIMEE');

-- AlterTable
ALTER TABLE "module_lessons" ADD COLUMN     "lesson_key" UUID NOT NULL DEFAULT gen_random_uuid();

-- Reprise : une même leçon (même module, même titre, titre unique dans sa version) reçoit la même
-- identité dans toutes les versions. Seule la nouvelle colonne technique est écrite ; le garde des
-- versions figées est suspendu pour cette seule instruction, le contenu n'est pas modifié.
ALTER TABLE "module_lessons" DISABLE TRIGGER "module_lessons_draft_guard";
WITH unique_titles AS (
  SELECT l."id", l."title", l."lesson_key", l."created_at", v."module_id"
  FROM "module_lessons" l
  JOIN "module_versions" v ON v."id" = l."version_id"
  WHERE NOT EXISTS (
    SELECT 1 FROM "module_lessons" d
    WHERE d."version_id" = l."version_id" AND d."title" = l."title" AND d."id" <> l."id"
  )
), first_key AS (
  SELECT DISTINCT ON ("module_id", "title") "module_id", "title", "lesson_key"
  FROM unique_titles
  ORDER BY "module_id", "title", "created_at", "id"
)
UPDATE "module_lessons" l
SET "lesson_key" = f."lesson_key"
FROM unique_titles u
JOIN first_key f ON f."module_id" = u."module_id" AND f."title" = u."title"
WHERE l."id" = u."id" AND l."lesson_key" <> f."lesson_key";
ALTER TABLE "module_lessons" ENABLE TRIGGER "module_lessons_draft_guard";

-- AlterTable
ALTER TABLE "practice_progress" ADD COLUMN     "failures_before_mastery" INTEGER NOT NULL DEFAULT 0;

-- Reprise : une activité jamais maîtrisée n'a connu que des essais manqués. Pour une activité
-- déjà maîtrisée, l'historique ne permet pas de le savoir : 0 (aucun badge accordé à tort).
UPDATE "practice_progress" SET "failures_before_mastery" = "attempts" WHERE "mastered_at" IS NULL;

-- CreateTable
CREATE TABLE "practice_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "module_slug" TEXT NOT NULL,
    "activity_key" TEXT NOT NULL,
    "module_version" INTEGER,
    "activity_fingerprint" TEXT,
    "mode" TEXT NOT NULL,
    "item" INTEGER,
    "assisted" BOOLEAN NOT NULL DEFAULT false,
    "status" "PracticeAttemptStatus" NOT NULL,
    "answers" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "mastered" BOOLEAN NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_badges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge_key" TEXT NOT NULL,
    "earned_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_attempts_user_id_module_slug_activity_key_created__idx" ON "practice_attempts"("user_id", "module_slug", "activity_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "practice_attempts_user_id_attempt_id_key" ON "practice_attempts"("user_id", "attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_badges_user_id_badge_key_key" ON "learning_badges"("user_id", "badge_key");

-- CreateIndex
CREATE UNIQUE INDEX "module_lessons_version_id_lesson_key_key" ON "module_lessons"("version_id", "lesson_key");

-- AddForeignKey
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_badges" ADD CONSTRAINT "learning_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Valeurs bornées et cohérentes.
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_failures_check"
  CHECK ("failures_before_mastery" >= 0);
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_values_check"
  CHECK ("mode" IN ('activity', 'ascension', 'memory') AND "correct" >= 0 AND "total" >= "correct"
    AND ("item" IS NULL OR "item" >= 0));

-- Tentatives et badges en ajout seul : ni modification, ni suppression (historique conservé).
CREATE TRIGGER practice_attempts_guard
  BEFORE UPDATE OR DELETE ON "practice_attempts"
  FOR EACH ROW EXECUTE FUNCTION learning_events_guard();
CREATE TRIGGER learning_badges_guard
  BEFORE UPDATE OR DELETE ON "learning_badges"
  FOR EACH ROW EXECUTE FUNCTION learning_events_guard();
