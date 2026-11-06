-- D176 : correction exceptionnelle et temporaire de l'étape (procédure de secours du responsable plein).
-- Migration additive : aucune donnée existante modifiée ; l'étape normale reste calculée selon l'âge.

-- CreateTable
CREATE TABLE "stage_overrides" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "computed_stage_id" UUID,
    "rule_set_version" TEXT,
    "reason" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at" TIMESTAMPTZ(3),
    "lifted_by_id" UUID,
    "lift_reason" TEXT,

    CONSTRAINT "stage_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stage_overrides_scout_profile_id_starts_on_idx" ON "stage_overrides"("scout_profile_id", "starts_on");

-- CreateIndex
CREATE INDEX "stage_overrides_stage_id_idx" ON "stage_overrides"("stage_id");

-- CreateIndex
CREATE INDEX "stage_overrides_computed_stage_id_idx" ON "stage_overrides"("computed_stage_id");

-- CreateIndex
CREATE INDEX "stage_overrides_created_by_id_idx" ON "stage_overrides"("created_by_id");

-- CreateIndex
CREATE INDEX "stage_overrides_lifted_by_id_idx" ON "stage_overrides"("lifted_by_id");

-- AddForeignKey
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_computed_stage_id_fkey" FOREIGN KEY ("computed_stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contrôles : période valide (fin incluse, après le début), motif non vide, levée complète ou absente.
ALTER TABLE "stage_overrides"
  ADD CONSTRAINT "stage_overrides_period_check" CHECK ("ends_on" >= "starts_on"),
  ADD CONSTRAINT "stage_overrides_reason_check" CHECK (length(btrim("reason")) >= 10),
  ADD CONSTRAINT "stage_overrides_distinct_stage_check"
    CHECK ("computed_stage_id" IS NULL OR "computed_stage_id" <> "stage_id"),
  ADD CONSTRAINT "stage_overrides_lift_check" CHECK (
    ("lifted_at" IS NULL AND "lifted_by_id" IS NULL AND "lift_reason" IS NULL)
    OR ("lifted_at" IS NOT NULL AND "lifted_by_id" IS NOT NULL
        AND "lift_reason" IS NOT NULL AND length(btrim("lift_reason")) >= 10)
  );

-- Au plus une exception non levée à une date donnée pour un routier : deux exceptions contradictoires
-- ne peuvent pas coexister (btree_gist est déjà installé, voir team_assignments_no_overlap).
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_no_overlap"
  EXCLUDE USING gist (
    "scout_profile_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  ) WHERE ("lifted_at" IS NULL);

-- Historique : jamais supprimé ; seule la levée (une fois) modifie une ligne.
CREATE FUNCTION "stage_overrides_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une exception d''étape est historisée : suppression interdite (D176).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."lifted_at" IS NOT NULL
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
     OR NEW."stage_id" IS DISTINCT FROM OLD."stage_id"
     OR NEW."computed_stage_id" IS DISTINCT FROM OLD."computed_stage_id"
     OR NEW."rule_set_version" IS DISTINCT FROM OLD."rule_set_version"
     OR NEW."reason" IS DISTINCT FROM OLD."reason"
     OR NEW."starts_on" IS DISTINCT FROM OLD."starts_on"
     OR NEW."ends_on" IS DISTINCT FROM OLD."ends_on"
     OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Une exception d''étape ne se modifie pas ; seule sa levée est enregistrée (D176).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "stage_overrides_guard"
  BEFORE UPDATE OR DELETE ON "stage_overrides"
  FOR EACH ROW EXECUTE FUNCTION "stage_overrides_guard"();
