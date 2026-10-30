-- Textes fondamentaux (prière, charte…) : catégorie de module et liens version → texte, sans copie du texte.
-- Migration additive : aucune donnée existante modifiée.

-- AlterEnum
ALTER TYPE "ModuleCategory" ADD VALUE 'TEXTE_FONDAMENTAL';

-- CreateTable
CREATE TABLE "module_text_links" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "text_module_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_text_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "module_text_links_text_module_id_idx" ON "module_text_links"("text_module_id");

-- CreateIndex
CREATE INDEX "module_text_links_created_by_id_idx" ON "module_text_links"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_text_links_version_id_text_module_id_key" ON "module_text_links"("version_id", "text_module_id");

-- AddForeignKey
ALTER TABLE "module_text_links" ADD CONSTRAINT "module_text_links_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_text_links" ADD CONSTRAINT "module_text_links_text_module_id_fkey" FOREIGN KEY ("text_module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_text_links" ADD CONSTRAINT "module_text_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rang positif ou nul.
ALTER TABLE "module_text_links" ADD CONSTRAINT "module_text_links_position_check" CHECK ("position" >= 0);

-- Même règle que les leçons et ressources : le contenu d'une version n'est modifiable qu'à l'état brouillon.
CREATE TRIGGER "module_text_links_draft_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "module_text_links"
  FOR EACH ROW EXECUTE FUNCTION "module_draft_content_guard"();

-- Un module ne peut pas se citer lui-même.
CREATE FUNCTION "module_text_links_not_self"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "module_versions"
             WHERE "id" = NEW."version_id" AND "module_id" = NEW."text_module_id") THEN
    RAISE EXCEPTION 'Un module ne peut pas se citer lui-même.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "module_text_links_not_self"
  BEFORE INSERT OR UPDATE ON "module_text_links"
  FOR EACH ROW EXECUTE FUNCTION "module_text_links_not_self"();
