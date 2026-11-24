-- Entraînement libre et récompenses ludiques (D196, D197). Migration additive : deux tables, aucune donnée existante modifiée.

-- CreateEnum
CREATE TYPE "LearningEventKind" AS ENUM ('LECON_LUE', 'ACTIVITE_TERMINEE', 'ACTIVITE_MAITRISEE', 'REVISION');

-- CreateTable
CREATE TABLE "learning_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "LearningEventKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "module_slug" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_slug" TEXT NOT NULL,
    "activity_key" TEXT NOT NULL,
    "activity_kind" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_correct" INTEGER NOT NULL DEFAULT 0,
    "last_total" INTEGER NOT NULL DEFAULT 0,
    "box" INTEGER NOT NULL DEFAULT 1,
    "due_on" DATE NOT NULL,
    "mastered_at" TIMESTAMPTZ(3),
    "last_practiced_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "practice_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_events_user_id_created_at_idx" ON "learning_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_events_user_id_kind_ref_key" ON "learning_events"("user_id", "kind", "ref");

-- CreateIndex
CREATE INDEX "practice_progress_user_id_due_on_idx" ON "practice_progress"("user_id", "due_on");

-- CreateIndex
CREATE UNIQUE INDEX "practice_progress_user_id_module_slug_activity_key_key" ON "practice_progress"("user_id", "module_slug", "activity_key");

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Valeurs ludiques bornées (le serveur seul les calcule).
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_xp_check" CHECK ("xp" >= 0 AND "xp" <= 100);
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_box_check" CHECK ("box" BETWEEN 1 AND 5);
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_counts_check"
  CHECK ("attempts" >= 0 AND "last_correct" >= 0 AND "last_total" >= "last_correct");

-- Événements d'apprentissage en ajout seul : ni modification, ni suppression.
CREATE FUNCTION learning_events_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'learning_events: ajout seul' USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER learning_events_guard
  BEFORE UPDATE OR DELETE ON "learning_events"
  FOR EACH ROW EXECUTE FUNCTION learning_events_guard();
