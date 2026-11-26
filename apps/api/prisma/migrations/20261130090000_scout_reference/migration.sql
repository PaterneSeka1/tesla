-- Référentiel scout (D220, D221). Migration additive :
-- - rubriques dynamiques et rangements de modules (texte fondamental, D125) ou de leçons ;
-- - formats audio ajoutés à la liste blanche des fichiers stockés (chants, récits narrés).
-- Aucune donnée existante modifiée ni supprimée.

-- CreateEnum
CREATE TYPE "ReferenceAmbiance" AS ENUM ('SOLENNEL', 'RECUEILLI', 'MUSICAL', 'NARRATIF', 'DOCUMENTAIRE');

-- CreateTable
CREATE TABLE "reference_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "ambiance" "ReferenceAmbiance" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "reference_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_entries" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "lesson_key" UUID,
    "position" INTEGER NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_categories_slug_key" ON "reference_categories"("slug");

-- CreateIndex
CREATE INDEX "reference_categories_created_by_id_idx" ON "reference_categories"("created_by_id");

-- CreateIndex
CREATE INDEX "reference_entries_category_id_position_idx" ON "reference_entries"("category_id", "position");

-- CreateIndex
CREATE INDEX "reference_entries_module_id_idx" ON "reference_entries"("module_id");

-- CreateIndex
CREATE INDEX "reference_entries_created_by_id_idx" ON "reference_entries"("created_by_id");

-- AddForeignKey
ALTER TABLE "reference_categories" ADD CONSTRAINT "reference_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_entries" ADD CONSTRAINT "reference_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "reference_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_entries" ADD CONSTRAINT "reference_entries_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_entries" ADD CONSTRAINT "reference_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un module (ou une leçon) n'est rangé qu'une fois par rubrique ; un seul rangement « module entier ».
CREATE UNIQUE INDEX "reference_entries_category_id_module_id_lesson_key_key"
  ON "reference_entries"("category_id", "module_id", "lesson_key");
CREATE UNIQUE INDEX "reference_entries_one_whole_module"
  ON "reference_entries"("category_id", "module_id") WHERE ("lesson_key" IS NULL);

ALTER TABLE "reference_categories"
  ADD CONSTRAINT "reference_categories_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "reference_categories_slug_safe" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "reference_categories_position_positive" CHECK ("position" >= 0);

ALTER TABLE "reference_entries"
  ADD CONSTRAINT "reference_entries_position_positive" CHECK ("position" >= 0);

-- Formats audio (D221) : la signature réelle du contenu reste vérifiée par l'API à la confirmation.
ALTER TABLE "stored_files" DROP CONSTRAINT "stored_files_mime_allowed";
ALTER TABLE "stored_files"
  ADD CONSTRAINT "stored_files_mime_allowed"
    CHECK ("mime_type" IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
                           'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'));
