-- CreateTable
CREATE TABLE "module_source_revisions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "source_pages" TEXT NOT NULL,
    "editorial_notes" JSONB NOT NULL,
    "imported_content" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "changes" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_source_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_source_revisions_module_id_revision_key" ON "module_source_revisions"("module_id", "revision");

-- AddForeignKey
ALTER TABLE "module_source_revisions" ADD CONSTRAINT "module_source_revisions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Règles hors Prisma ─────────────────────────────────────────────────────

-- L'import d'origine est la révision 1 : une révision enregistrée porte le numéro 2 ou plus.
ALTER TABLE "module_source_revisions" ADD CONSTRAINT "module_source_revisions_revision_check"
  CHECK ("revision" >= 2);

-- Historique des révisions en ajout seul (suppression permise uniquement pendant la purge d'un
-- brouillon vide, comme pour la provenance).
CREATE FUNCTION "module_source_revisions_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND "module_purge_in_progress"(OLD."module_id") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Les révisions de source d''un module sont en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "module_source_revisions_append_only"
  BEFORE UPDATE OR DELETE ON "module_source_revisions"
  FOR EACH ROW EXECUTE FUNCTION "module_source_revisions_append_only"();

-- Purge d'un brouillon vide : retire aussi ses révisions de source (même garde-fous qu'avant).
CREATE OR REPLACE FUNCTION "purge_empty_module_draft"(p_module_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_published uuid;
  v_version record;
BEGIN
  SELECT "published_version_id" INTO v_published
    FROM "pedagogical_modules" WHERE "id" = p_module_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_published IS NOT NULL
    OR (SELECT count(*) FROM "module_versions" WHERE "module_id" = p_module_id) <> 1 THEN
    RAISE EXCEPTION 'MODULE_NOT_EMPTY' USING ERRCODE = 'check_violation';
  END IF;
  SELECT "id", "status", "submitted_at" INTO v_version
    FROM "module_versions" WHERE "module_id" = p_module_id FOR UPDATE;
  IF v_version."status" <> 'BROUILLON' OR v_version."submitted_at" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "module_lessons" WHERE "version_id" = v_version."id"
               AND jsonb_path_exists("content", '$.** ? (@.type == "text" || @.type == "image")'))
    OR EXISTS (SELECT 1 FROM "module_resources" WHERE "version_id" = v_version."id")
    OR EXISTS (SELECT 1 FROM "module_text_links" WHERE "version_id" = v_version."id")
    OR EXISTS (SELECT 1 FROM "module_collaborators" WHERE "module_id" = p_module_id) THEN
    RAISE EXCEPTION 'MODULE_NOT_EMPTY' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('tesla.purge_module', p_module_id::text, true);
  DELETE FROM "module_lessons" WHERE "version_id" = v_version."id";
  DELETE FROM "module_version_events" WHERE "module_id" = p_module_id;
  DELETE FROM "module_source_revisions" WHERE "module_id" = p_module_id;
  DELETE FROM "module_source_imports" WHERE "module_id" = p_module_id;
  DELETE FROM "module_versions" WHERE "id" = v_version."id";
  DELETE FROM "pedagogical_modules" WHERE "id" = p_module_id;
  PERFORM set_config('tesla.purge_module', '', true);
END;
$$;
