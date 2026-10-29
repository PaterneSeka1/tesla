-- CreateEnum
CREATE TYPE "ModuleVersionStatus" AS ENUM ('BROUILLON', 'SOUMIS', 'A_CORRIGER', 'REFUSE', 'APPROUVE', 'PUBLIE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ModuleVersionAction" AS ENUM ('CREEE', 'SOUMISE', 'REPRISE', 'CORRECTIONS_DEMANDEES', 'REFUSEE', 'APPROUVEE', 'PUBLIEE', 'REMPLACEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "ModuleResourceKind" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'LIEN');

-- CreateTable
CREATE TABLE "pedagogical_modules" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "published_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pedagogical_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_versions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ModuleVersionStatus" NOT NULL DEFAULT 'BROUILLON',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "objectives" TEXT[],
    "prerequisites" TEXT,
    "duration_minutes" INTEGER,
    "stage_id" UUID,
    "theme" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "based_on_version_id" UUID,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "submitted_by_id" UUID,
    "submission_note" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "approved_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "published_by_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "module_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_lessons" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "duration_minutes" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "module_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_resources" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "lesson_id" UUID,
    "kind" "ModuleResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_collaborators" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by_id" UUID NOT NULL,
    "removed_at" TIMESTAMPTZ(3),
    "removed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_version_events" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ModuleVersionAction" NOT NULL,
    "from_status" "ModuleVersionStatus",
    "to_status" "ModuleVersionStatus" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_version_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedagogical_modules_number_key" ON "pedagogical_modules"("number");

-- CreateIndex
CREATE UNIQUE INDEX "pedagogical_modules_slug_key" ON "pedagogical_modules"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pedagogical_modules_published_version_id_key" ON "pedagogical_modules"("published_version_id");

-- CreateIndex
CREATE INDEX "pedagogical_modules_created_by_id_idx" ON "pedagogical_modules"("created_by_id");

-- CreateIndex
CREATE INDEX "module_versions_status_idx" ON "module_versions"("status");

-- CreateIndex
CREATE INDEX "module_versions_stage_id_idx" ON "module_versions"("stage_id");

-- CreateIndex
CREATE INDEX "module_versions_based_on_version_id_idx" ON "module_versions"("based_on_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_versions_module_id_version_key" ON "module_versions"("module_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "module_versions_one_working_per_module" ON "module_versions"("module_id") WHERE (status = ANY (ARRAY['BROUILLON'::"ModuleVersionStatus", 'SOUMIS'::"ModuleVersionStatus", 'A_CORRIGER'::"ModuleVersionStatus", 'APPROUVE'::"ModuleVersionStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "module_versions_one_published_per_module" ON "module_versions"("module_id") WHERE (status = 'PUBLIE'::"ModuleVersionStatus");

-- CreateIndex
CREATE INDEX "module_lessons_version_id_position_idx" ON "module_lessons"("version_id", "position");

-- CreateIndex
CREATE INDEX "module_lessons_created_by_id_idx" ON "module_lessons"("created_by_id");

-- CreateIndex
CREATE INDEX "module_lessons_updated_by_id_idx" ON "module_lessons"("updated_by_id");

-- CreateIndex
CREATE INDEX "module_resources_version_id_idx" ON "module_resources"("version_id");

-- CreateIndex
CREATE INDEX "module_resources_lesson_id_idx" ON "module_resources"("lesson_id");

-- CreateIndex
CREATE INDEX "module_resources_created_by_id_idx" ON "module_resources"("created_by_id");

-- CreateIndex
CREATE INDEX "module_collaborators_user_id_idx" ON "module_collaborators"("user_id");

-- CreateIndex
CREATE INDEX "module_collaborators_added_by_id_idx" ON "module_collaborators"("added_by_id");

-- CreateIndex
CREATE INDEX "module_collaborators_removed_by_id_idx" ON "module_collaborators"("removed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_collaborators_one_active" ON "module_collaborators"("module_id", "user_id") WHERE (removed_at IS NULL);

-- CreateIndex
CREATE INDEX "module_version_events_module_id_created_at_idx" ON "module_version_events"("module_id", "created_at");

-- CreateIndex
CREATE INDEX "module_version_events_version_id_created_at_idx" ON "module_version_events"("version_id", "created_at");

-- CreateIndex
CREATE INDEX "module_version_events_actor_id_idx" ON "module_version_events"("actor_id");

-- CreateIndex
CREATE INDEX "module_version_events_created_at_idx" ON "module_version_events"("created_at");

-- AddForeignKey
ALTER TABLE "pedagogical_modules" ADD CONSTRAINT "pedagogical_modules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedagogical_modules" ADD CONSTRAINT "pedagogical_modules_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_based_on_version_id_fkey" FOREIGN KEY ("based_on_version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_lessons" ADD CONSTRAINT "module_lessons_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_lessons" ADD CONSTRAINT "module_lessons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_lessons" ADD CONSTRAINT "module_lessons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "module_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_collaborators" ADD CONSTRAINT "module_collaborators_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_collaborators" ADD CONSTRAINT "module_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_collaborators" ADD CONSTRAINT "module_collaborators_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_collaborators" ADD CONSTRAINT "module_collaborators_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_version_events" ADD CONSTRAINT "module_version_events_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_version_events" ADD CONSTRAINT "module_version_events_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_version_events" ADD CONSTRAINT "module_version_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Contraintes complémentaires (ignorées par Prisma, voir docs/DATABASE.md)
-- ─────────────────────────────────────────────────────────────

-- Bornes numériques et textuelles (mêmes limites que @tesla/shared).
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_values_check"
  CHECK ("version" > 0 AND "revision" > 0
    AND length(btrim("title")) BETWEEN 1 AND 150
    AND ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 1 AND 6000));

ALTER TABLE "module_lessons" ADD CONSTRAINT "module_lessons_values_check"
  CHECK ("position" >= 0 AND "revision" > 0
    AND length(btrim("title")) BETWEEN 1 AND 150
    AND ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 1 AND 6000)
    AND jsonb_typeof("content") = 'object');

-- Ressources : URL externe sécurisée uniquement (https, ou http pour un simple lien).
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_url_check"
  CHECK ("url" ~ '^https?://' AND length("url") <= 2000);

-- Slug d'URL normalisé.
ALTER TABLE "pedagogical_modules" ADD CONSTRAINT "pedagogical_modules_slug_check"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") <= 80);

-- Version : jamais supprimée ; contenu figé hors brouillon ; transitions d'état contrôlées.
CREATE FUNCTION "module_versions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une version de module ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."module_id" IS DISTINCT FROM OLD."module_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
    OR NEW."based_on_version_id" IS DISTINCT FROM OLD."based_on_version_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Le module, le numéro, l''auteur et l''origine d''une version sont immuables.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" <> 'BROUILLON' AND (
    NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."summary" IS DISTINCT FROM OLD."summary"
    OR NEW."objectives" IS DISTINCT FROM OLD."objectives"
    OR NEW."prerequisites" IS DISTINCT FROM OLD."prerequisites"
    OR NEW."duration_minutes" IS DISTINCT FROM OLD."duration_minutes"
    OR NEW."stage_id" IS DISTINCT FROM OLD."stage_id"
    OR NEW."theme" IS DISTINCT FROM OLD."theme") THEN
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

CREATE TRIGGER "module_versions_guard"
  BEFORE UPDATE OR DELETE ON "module_versions"
  FOR EACH ROW EXECUTE FUNCTION "module_versions_guard"();

-- Leçons et ressources : écriture uniquement dans une version à l'état brouillon ;
-- une leçon ou une ressource ne change jamais de version.
CREATE FUNCTION "module_draft_content_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status "ModuleVersionStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."version_id" IS DISTINCT FROM OLD."version_id" THEN
    RAISE EXCEPTION 'Un contenu ne peut pas changer de version.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT "status" INTO parent_status FROM "module_versions"
    WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."version_id" ELSE NEW."version_id" END;
  IF parent_status IS DISTINCT FROM 'BROUILLON' THEN
    RAISE EXCEPTION 'Le contenu d''une version n''est modifiable qu''à l''état brouillon.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "module_lessons_draft_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "module_lessons"
  FOR EACH ROW EXECUTE FUNCTION "module_draft_content_guard"();

CREATE TRIGGER "module_resources_draft_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "module_resources"
  FOR EACH ROW EXECUTE FUNCTION "module_draft_content_guard"();

-- La version publiée courante appartient au module et est à l'état PUBLIE.
CREATE FUNCTION "pedagogical_modules_published_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un module ne peut pas être supprimé.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."published_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "module_versions"
    WHERE "id" = NEW."published_version_id" AND "module_id" = NEW."id" AND "status" = 'PUBLIE') THEN
    RAISE EXCEPTION 'La version publiée doit appartenir au module et être à l''état publié.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "pedagogical_modules_published_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "pedagogical_modules"
  FOR EACH ROW EXECUTE FUNCTION "pedagogical_modules_published_guard"();

-- Historique des versions et des décisions en ajout seul.
CREATE FUNCTION "module_version_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'L''historique des modules est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "module_version_events_append_only"
  BEFORE UPDATE OR DELETE ON "module_version_events"
  FOR EACH ROW EXECUTE FUNCTION "module_version_events_append_only"();
