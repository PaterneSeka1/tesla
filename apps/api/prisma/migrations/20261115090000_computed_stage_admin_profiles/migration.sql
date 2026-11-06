-- D173 : étape calculée selon l'âge, données administratives protégées.
-- Migration additive : aucune donnée supprimée ni réécrite, aucune étape attribuée.

-- Date d'entrée à la Route facultative : une pré-inscription n'utilise jamais la date du jour comme
-- valeur de substitution. Les valeurs existantes sont conservées telles quelles.
ALTER TABLE "scout_profiles" ALTER COLUMN "joined_at" DROP NOT NULL;

-- L'ancienne étape officielle (`current_stage_id`, `current_stage_since`) devient un historique figé :
-- l'étape actuelle est calculée par l'API (date de naissance + référentiel d'âge en vigueur).
CREATE FUNCTION "scout_profiles_stage_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."current_stage_id" IS NOT NULL OR NEW."current_stage_since" IS NOT NULL THEN
      RAISE EXCEPTION 'L''étape est calculée selon l''âge : elle ne se saisit pas (D173).'
        USING ERRCODE = 'restrict_violation';
    END IF;
  ELSIF NEW."current_stage_id" IS DISTINCT FROM OLD."current_stage_id"
     OR NEW."current_stage_since" IS DISTINCT FROM OLD."current_stage_since" THEN
    RAISE EXCEPTION 'L''étape officielle antérieure est un historique figé (D173).'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "scout_profiles_stage_frozen"
  BEFORE INSERT OR UPDATE OF "current_stage_id", "current_stage_since" ON "scout_profiles"
  FOR EACH ROW EXECUTE FUNCTION "scout_profiles_stage_frozen"();

-- Historique des décisions d'étape : conservé, consultable, plus aucun ajout (déjà protégé contre
-- la modification et la suppression par `scout_stage_changes_append_only`).
CREATE TRIGGER "scout_stage_changes_closed" BEFORE INSERT ON "scout_stage_changes"
  FOR EACH ROW EXECUTE FUNCTION "archived_table_guard"();
