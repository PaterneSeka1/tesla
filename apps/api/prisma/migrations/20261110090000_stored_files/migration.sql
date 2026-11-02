-- CreateEnum
CREATE TYPE "StoredFileCategory" AS ENUM ('MODULE_RESOURCE');

-- CreateEnum
CREATE TYPE "StoredFileStatus" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE', 'ABANDONNE');

-- AlterTable
ALTER TABLE "module_resources" ADD COLUMN     "file_id" UUID,
ALTER COLUMN "url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "category" "StoredFileCategory" NOT NULL,
    "status" "StoredFileStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "module_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upload_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "validated_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "object_deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_module_id_idx" ON "stored_files"("module_id");

-- CreateIndex
CREATE INDEX "stored_files_created_by_id_idx" ON "stored_files"("created_by_id");

-- CreateIndex
CREATE INDEX "stored_files_status_upload_expires_at_idx" ON "stored_files"("status", "upload_expires_at");

-- CreateIndex
CREATE INDEX "module_resources_file_id_idx" ON "module_resources"("file_id");

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stockage objet (D143) : contraintes complémentaires, non exprimables dans le schéma Prisma.

-- Une ressource est soit une adresse externe, soit un fichier (image ou document), jamais les deux.
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_url_or_file"
  CHECK ((("url" IS NOT NULL) <> ("file_id" IS NOT NULL))
     AND ("file_id" IS NULL OR "kind" IN ('IMAGE', 'DOCUMENT')));

ALTER TABLE "stored_files"
  ADD CONSTRAINT "stored_files_size_positive" CHECK ("size_bytes" > 0),
  ADD CONSTRAINT "stored_files_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  -- Clé générée par le serveur : segments alphanumériques, jamais « .. » ni nom d'utilisateur.
  ADD CONSTRAINT "stored_files_storage_key_safe"
    CHECK ("storage_key" ~ '^[a-z0-9-]+(/[a-z0-9-]+)+$'),
  ADD CONSTRAINT "stored_files_mime_allowed"
    CHECK ("mime_type" IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf')),
  ADD CONSTRAINT "stored_files_module_owner"
    CHECK ("category" <> 'MODULE_RESOURCE' OR "module_id" IS NOT NULL),
  ADD CONSTRAINT "stored_files_validated_at"
    CHECK (("status" = 'VALIDE') = ("validated_at" IS NOT NULL));

-- Identité de l'objet immuable ; transitions limitées à EN_ATTENTE → VALIDE | REJETE | ABANDONNE ;
-- aucune suppression de ligne (historique et références conservés).
CREATE FUNCTION "stored_files_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Les métadonnées d''un fichier stocké ne sont jamais supprimées.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."bucket" IS DISTINCT FROM OLD."bucket"
     OR NEW."storage_key" IS DISTINCT FROM OLD."storage_key"
     OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."size_bytes" IS DISTINCT FROM OLD."size_bytes"
     OR NEW."mime_type" IS DISTINCT FROM OLD."mime_type"
     OR NEW."category" IS DISTINCT FROM OLD."category"
     OR NEW."module_id" IS DISTINCT FROM OLD."module_id"
     OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'L''identité d''un fichier stocké est immuable.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND OLD."status" <> 'EN_ATTENTE' THEN
    RAISE EXCEPTION 'Transition de statut de fichier interdite (% → %).', OLD."status", NEW."status"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "stored_files_guard"
  BEFORE UPDATE OR DELETE ON "stored_files"
  FOR EACH ROW EXECUTE FUNCTION "stored_files_guard"();
