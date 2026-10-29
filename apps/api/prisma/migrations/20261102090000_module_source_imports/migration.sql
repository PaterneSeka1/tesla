-- Import système de modules pédagogiques (seed documentaire) : auteur facultatif = création par le système,
-- provenance en ajout seul. Migration additive (aucune donnée existante modifiée).

-- AlterTable
ALTER TABLE "module_lessons" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "module_version_events" ALTER COLUMN "actor_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "module_versions" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pedagogical_modules" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "module_source_imports" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_document" TEXT NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "source_pages" TEXT NOT NULL,
    "editorial_notes" JSONB NOT NULL,
    "imported_content" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_source_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_source_imports_module_id_key" ON "module_source_imports"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_source_imports_source_key_key" ON "module_source_imports"("source_key");

-- AddForeignKey
ALTER TABLE "module_source_imports" ADD CONSTRAINT "module_source_imports_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Le système ne peut que créer une version : toute décision (soumission, approbation, publication…)
-- reste attribuée à une personne.
ALTER TABLE "module_version_events" ADD CONSTRAINT "module_version_events_system_actor_check"
  CHECK ("actor_id" IS NOT NULL OR "action" = 'CREEE');

-- Provenance en ajout seul : une réexécution signale les écarts, elle ne réécrit jamais l'import.
CREATE FUNCTION "module_source_imports_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La provenance d''un module importé est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "module_source_imports_append_only"
  BEFORE UPDATE OR DELETE ON "module_source_imports"
  FOR EACH ROW EXECUTE FUNCTION "module_source_imports_append_only"();
