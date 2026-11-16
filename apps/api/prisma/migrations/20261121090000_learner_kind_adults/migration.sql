-- D185 : apprenants adultes (ni routiers, ni encadrement). Migration additive : toutes les fiches
-- existantes deviennent ROUTIER (valeur par défaut) ; aucune donnée n'est modifiée ni supprimée.

-- CreateEnum
CREATE TYPE "LearnerKind" AS ENUM ('ROUTIER', 'ADULTE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADULTE';

-- AlterTable
ALTER TABLE "scout_profiles" ADD COLUMN     "kind" "LearnerKind" NOT NULL DEFAULT 'ROUTIER';

-- CreateIndex
CREATE INDEX "scout_profiles_kind_idx" ON "scout_profiles"("kind");

-- Une fiche adulte n'a ni matricule, ni date de naissance, ni date d'entrée : elle échappe ainsi à
-- tout calcul d'âge (étape, sortie de la branche à 21 ans, rattrapages).
ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_adult_fields_check"
  CHECK ("kind" = 'ROUTIER' OR ("matricule" IS NULL AND "birth_date" IS NULL AND "joined_at" IS NULL));

-- Le type d'une fiche est fixé à l'inscription : jamais converti (l'historique Route resterait attaché).
CREATE FUNCTION "scout_profiles_kind_frozen"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind" THEN
    RAISE EXCEPTION 'Le type d''une fiche (routier ou adulte) ne se modifie pas (D185).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "scout_profiles_kind_frozen"
  BEFORE UPDATE OF "kind" ON "scout_profiles"
  FOR EACH ROW EXECUTE FUNCTION "scout_profiles_kind_frozen"();

-- Données propres à la Route : refusées pour une fiche adulte, quel que soit le chemin d'écriture.
-- Seules les tentatives d'évaluation (evaluation_attempts) sont ouvertes aux adultes.
CREATE FUNCTION "route_only_scout_profile"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "scout_profiles"
             WHERE "id" = NEW."scout_profile_id" AND "kind" = 'ADULTE') THEN
    RAISE EXCEPTION 'Donnée propre à la Route refusée pour un apprenant adulte (%, D185).', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "activity_attendances_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "activity_attendances"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "catch_up_obligations_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "catch_up_obligations"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "competency_proposals_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "competency_proposals"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "competency_validations_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "competency_validations"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "evaluation_waivers_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "evaluation_waivers"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "module_studies_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "module_studies"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "prior_stage_recognitions_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "prior_stage_recognitions"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "route_membership_events_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "route_membership_events"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "scout_observations_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "scout_observations"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "scout_stage_changes_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "scout_stage_changes"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "stage_overrides_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "stage_overrides"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
CREATE TRIGGER "team_assignments_route_only"
  BEFORE INSERT OR UPDATE OF "scout_profile_id" ON "team_assignments"
  FOR EACH ROW EXECUTE FUNCTION "route_only_scout_profile"();
