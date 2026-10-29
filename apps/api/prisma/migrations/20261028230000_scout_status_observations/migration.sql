-- CreateEnum
CREATE TYPE "ObservationVisibility" AS ENUM ('ENCADREMENT', 'RESPONSABLE');

-- AlterTable
ALTER TABLE "scout_profiles" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "scout_observations" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "observed_on" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "visibility" "ObservationVisibility" NOT NULL DEFAULT 'ENCADREMENT',
    "edited_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scout_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_observation_revisions" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "editor_id" UUID NOT NULL,
    "observed_on" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "visibility" "ObservationVisibility" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_observation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scout_observations_scout_profile_id_observed_on_idx" ON "scout_observations"("scout_profile_id", "observed_on");

-- CreateIndex
CREATE INDEX "scout_observations_author_id_idx" ON "scout_observations"("author_id");

-- CreateIndex
CREATE INDEX "scout_observation_revisions_observation_id_created_at_idx" ON "scout_observation_revisions"("observation_id", "created_at");

-- CreateIndex
CREATE INDEX "scout_observation_revisions_editor_id_idx" ON "scout_observation_revisions"("editor_id");

-- CreateIndex
CREATE INDEX "scout_profiles_is_active_idx" ON "scout_profiles"("is_active");

-- AddForeignKey
ALTER TABLE "scout_observations" ADD CONSTRAINT "scout_observations_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_observations" ADD CONSTRAINT "scout_observations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_observation_revisions" ADD CONSTRAINT "scout_observation_revisions_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "scout_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_observation_revisions" ADD CONSTRAINT "scout_observation_revisions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Contraintes complémentaires (ignorées par Prisma, voir docs/DATABASE.md)
-- ─────────────────────────────────────────────────────────────

-- Contenu et catégorie non vides, longueurs bornées (mêmes limites que @tesla/shared).
ALTER TABLE "scout_observations" ADD CONSTRAINT "scout_observations_content_check"
  CHECK (length(btrim("content")) BETWEEN 1 AND 5000
    AND ("category" IS NULL OR length(btrim("category")) BETWEEN 1 AND 80));

-- Une observation n'est jamais supprimée ; son auteur, son routier et sa date de saisie sont immuables.
CREATE FUNCTION "scout_observations_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une observation ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
    OR NEW."author_id" IS DISTINCT FROM OLD."author_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Le routier, l''auteur et la date de saisie d''une observation sont immuables.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "scout_observations_guard"
  BEFORE UPDATE OR DELETE ON "scout_observations"
  FOR EACH ROW EXECUTE FUNCTION "scout_observations_guard"();

-- Historique des observations en ajout seul.
CREATE FUNCTION "scout_observation_revisions_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'L''historique des observations est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "scout_observation_revisions_append_only"
  BEFORE UPDATE OR DELETE ON "scout_observation_revisions"
  FOR EACH ROW EXECUTE FUNCTION "scout_observation_revisions_append_only"();
