-- D181 : reconnaissance du parcours antérieur et invariant « routier actif = date de naissance ».
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- CreateTable
CREATE TABLE "prior_stage_recognitions" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "completed_on" DATE,
    "note" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "revoke_reason" TEXT,

    CONSTRAINT "prior_stage_recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prior_stage_recognitions_scout_profile_id_idx" ON "prior_stage_recognitions"("scout_profile_id");

-- CreateIndex
CREATE INDEX "prior_stage_recognitions_stage_id_idx" ON "prior_stage_recognitions"("stage_id");

-- CreateIndex
CREATE INDEX "prior_stage_recognitions_recorded_by_id_idx" ON "prior_stage_recognitions"("recorded_by_id");

-- CreateIndex
CREATE INDEX "prior_stage_recognitions_revoked_by_id_idx" ON "prior_stage_recognitions"("revoked_by_id");

-- AddForeignKey
ALTER TABLE "prior_stage_recognitions" ADD CONSTRAINT "prior_stage_recognitions_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_stage_recognitions" ADD CONSTRAINT "prior_stage_recognitions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_stage_recognitions" ADD CONSTRAINT "prior_stage_recognitions_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_stage_recognitions" ADD CONSTRAINT "prior_stage_recognitions_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contrôles : observation bornée, révocation complète ou absente.
ALTER TABLE "prior_stage_recognitions"
  ADD CONSTRAINT "prior_stage_recognitions_note_check"
    CHECK ("note" IS NULL OR length("note") <= 1000),
  ADD CONSTRAINT "prior_stage_recognitions_revoke_check" CHECK (
    ("revoked_at" IS NULL AND "revoked_by_id" IS NULL AND "revoke_reason" IS NULL)
    OR ("revoked_at" IS NOT NULL AND "revoked_by_id" IS NOT NULL
        AND "revoke_reason" IS NOT NULL AND length(btrim("revoke_reason")) >= 5)
  );

-- Au plus une reconnaissance en vigueur par routier et par étape (deux chefs simultanés : la
-- seconde écriture échoue au lieu de dupliquer).
CREATE UNIQUE INDEX "prior_stage_recognitions_active_key"
  ON "prior_stage_recognitions"("scout_profile_id", "stage_id")
  WHERE "revoked_at" IS NULL;

-- Historique : jamais supprimé ; seule la révocation (une fois) modifie une ligne.
CREATE FUNCTION "prior_stage_recognitions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une reconnaissance de parcours est historisée : suppression interdite (D181).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."revoked_at" IS NOT NULL
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
     OR NEW."stage_id" IS DISTINCT FROM OLD."stage_id"
     OR NEW."completed_on" IS DISTINCT FROM OLD."completed_on"
     OR NEW."note" IS DISTINCT FROM OLD."note"
     OR NEW."recorded_by_id" IS DISTINCT FROM OLD."recorded_by_id"
     OR NEW."recorded_at" IS DISTINCT FROM OLD."recorded_at" THEN
    RAISE EXCEPTION 'Une reconnaissance de parcours ne se modifie pas ; seule sa révocation est enregistrée (D181).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "prior_stage_recognitions_guard"
  BEFORE UPDATE OR DELETE ON "prior_stage_recognitions"
  FOR EACH ROW EXECUTE FUNCTION "prior_stage_recognitions_guard"();

-- Invariant « routier actif = étape déterminable » (D181), étape 1 de la migration progressive : la
-- date de naissance d'un profil actif ne peut plus être retirée. Les fiches historiques sans date
-- restent lisibles (diagnostic `npm run diagnose:stages -w @tesla/api`) ; la contrainte NOT NULL
-- complète ne sera posée qu'après leur régularisation par un humain.
CREATE FUNCTION "scout_profiles_birth_date_kept"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."is_active" AND NEW."membership_status" = 'ACTIF'
     AND NEW."birth_date" IS NULL AND OLD."birth_date" IS NOT NULL THEN
    RAISE EXCEPTION 'La date de naissance d''un routier actif ne peut pas être retirée (D181).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "scout_profiles_birth_date_kept"
  BEFORE UPDATE OF "birth_date" ON "scout_profiles"
  FOR EACH ROW EXECUTE FUNCTION "scout_profiles_birth_date_kept"();
