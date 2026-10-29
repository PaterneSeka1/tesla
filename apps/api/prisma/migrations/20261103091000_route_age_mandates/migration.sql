-- Refonte : progression par l'âge, rattrapages, appartenance à la branche, mandats et délégations.
-- Migration additive : aucune table, colonne ni valeur d'enum supprimée.

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('TRANSVERSAL', 'ETAPE', 'COMPLEMENTAIRE');

-- CreateEnum
CREATE TYPE "ModuleObligation" AS ENUM ('OBLIGATOIRE', 'FACULTATIF');

-- CreateEnum
CREATE TYPE "AgeRuleSetStatus" AS ENUM ('BROUILLON', 'EN_VIGUEUR');

-- CreateEnum
CREATE TYPE "RouteMembershipStatus" AS ENUM ('ACTIF', 'SORTI');

-- CreateEnum
CREATE TYPE "RouteMembershipEventKind" AS ENUM ('SORTIE_AGE');

-- CreateEnum
CREATE TYPE "CatchUpDecision" AS ENUM ('ACQUIS', 'NON_APPLICABLE');

-- CreateEnum
CREATE TYPE "LeaderFunction" AS ENUM ('PLEIN', 'ADJOINT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "MandateKind" AS ENUM ('NOMINATION', 'RECONDUCTION', 'REMPLACEMENT', 'CHANGEMENT_FONCTION');

-- AlterTable
ALTER TABLE "module_versions" ADD COLUMN     "category" "ModuleCategory",
ADD COLUMN     "obligation" "ModuleObligation",
ADD COLUMN     "official_source" TEXT;

-- AlterTable
ALTER TABLE "scout_profiles" ADD COLUMN     "branch_exited_on" DATE,
ADD COLUMN     "membership_status" "RouteMembershipStatus" NOT NULL DEFAULT 'ACTIF';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "legacy_role" TEXT;

-- CreateTable
CREATE TABLE "age_rule_sets" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "status" "AgeRuleSetStatus" NOT NULL DEFAULT 'BROUILLON',
    "effective_from" DATE,
    "source_reference" TEXT NOT NULL,
    "notes" TEXT,
    "branch_exit_age_years" INTEGER,
    "catch_up_delay_months" INTEGER,
    "exit_alert_months" INTEGER,
    "activated_at" TIMESTAMPTZ(3),
    "activated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "age_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "age_stage_rules" (
    "id" UUID NOT NULL,
    "rule_set_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "start_years" INTEGER NOT NULL,
    "start_months" INTEGER NOT NULL DEFAULT 0,
    "end_years" INTEGER,
    "end_months" INTEGER,
    "source_reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "age_stage_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_membership_events" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "kind" "RouteMembershipEventKind" NOT NULL,
    "effective_on" DATE NOT NULL,
    "rule_set_version" TEXT,
    "details" JSONB,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_membership_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catch_up_obligations" (
    "id" UUID NOT NULL,
    "scout_profile_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "origin_stage_id" UUID NOT NULL,
    "rule_set_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "due_on" DATE,
    "decision" "CatchUpDecision",
    "decision_reason" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catch_up_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_years" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_mandates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "function" "LeaderFunction" NOT NULL,
    "scout_year_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "kind" "MandateKind" NOT NULL,
    "appointing_authority" TEXT NOT NULL,
    "appointment_reference" TEXT,
    "previous_mandate_id" UUID,
    "notes" TEXT,
    "ended_early_on" DATE,
    "end_reason" TEXT,
    "ended_by_id" UUID,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leadership_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL,
    "delegator_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "permissions" TEXT[],
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "age_rule_sets_version_key" ON "age_rule_sets"("version");

-- CreateIndex
CREATE UNIQUE INDEX "age_rule_sets_effective_from_key" ON "age_rule_sets"("effective_from");

-- CreateIndex
CREATE INDEX "age_rule_sets_status_effective_from_idx" ON "age_rule_sets"("status", "effective_from");

-- CreateIndex
CREATE INDEX "age_stage_rules_stage_id_idx" ON "age_stage_rules"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "age_stage_rules_rule_set_id_stage_id_key" ON "age_stage_rules"("rule_set_id", "stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_membership_events_scout_profile_id_kind_effective_on_key" ON "route_membership_events"("scout_profile_id", "kind", "effective_on");

-- CreateIndex
CREATE INDEX "catch_up_obligations_module_id_idx" ON "catch_up_obligations"("module_id");

-- CreateIndex
CREATE INDEX "catch_up_obligations_origin_stage_id_idx" ON "catch_up_obligations"("origin_stage_id");

-- CreateIndex
CREATE INDEX "catch_up_obligations_rule_set_id_idx" ON "catch_up_obligations"("rule_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "catch_up_obligations_scout_profile_id_module_id_key" ON "catch_up_obligations"("scout_profile_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "scout_years_label_key" ON "scout_years"("label");

-- CreateIndex
CREATE INDEX "leadership_mandates_user_id_idx" ON "leadership_mandates"("user_id");

-- CreateIndex
CREATE INDEX "leadership_mandates_scout_year_id_idx" ON "leadership_mandates"("scout_year_id");

-- CreateIndex
CREATE INDEX "leadership_mandates_previous_mandate_id_idx" ON "leadership_mandates"("previous_mandate_id");

-- CreateIndex
CREATE INDEX "leadership_mandates_function_starts_on_idx" ON "leadership_mandates"("function", "starts_on");

-- CreateIndex
CREATE INDEX "delegations_delegate_id_starts_on_idx" ON "delegations"("delegate_id", "starts_on");

-- CreateIndex
CREATE INDEX "delegations_delegator_id_idx" ON "delegations"("delegator_id");

-- CreateIndex
CREATE INDEX "module_versions_category_idx" ON "module_versions"("category");

-- CreateIndex
CREATE INDEX "scout_profiles_membership_status_idx" ON "scout_profiles"("membership_status");

-- AddForeignKey
ALTER TABLE "age_rule_sets" ADD CONSTRAINT "age_rule_sets_activated_by_id_fkey" FOREIGN KEY ("activated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_stage_rules" ADD CONSTRAINT "age_stage_rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "age_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_stage_rules" ADD CONSTRAINT "age_stage_rules_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_membership_events" ADD CONSTRAINT "route_membership_events_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_membership_events" ADD CONSTRAINT "route_membership_events_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_scout_profile_id_fkey" FOREIGN KEY ("scout_profile_id") REFERENCES "scout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "pedagogical_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_origin_stage_id_fkey" FOREIGN KEY ("origin_stage_id") REFERENCES "progression_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "age_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_years" ADD CONSTRAINT "scout_years_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_scout_year_id_fkey" FOREIGN KEY ("scout_year_id") REFERENCES "scout_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_previous_mandate_id_fkey" FOREIGN KEY ("previous_mandate_id") REFERENCES "leadership_mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Reprise des comptes de l'encadrement (D93, D94) ───────────────────────────────────────────
-- Les anciens CHEF et RESPONSABLE deviennent ENCADREMENT ; l'ancien rôle est conservé pour la
-- résolution des fonctions. AUCUN mandat n'est attribué : la fonction (plein, adjoint, assistant)
-- doit être enregistrée explicitement par une autorité habilitée.
UPDATE "users" SET "legacy_role" = "role"::text, "role" = 'ENCADREMENT'
  WHERE "role" IN ('CHEF', 'RESPONSABLE');

ALTER TABLE "users" ADD CONSTRAINT "users_role_current_check"
  CHECK ("role" NOT IN ('CHEF', 'RESPONSABLE'));
ALTER TABLE "users" ADD CONSTRAINT "users_legacy_role_check"
  CHECK ("legacy_role" IS NULL OR "legacy_role" IN ('CHEF', 'RESPONSABLE'));

-- ─── Typologie des modules (D99) ───────────────────────────────────────────────────────────────
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_stage_category_check"
  CHECK ("category" IS DISTINCT FROM 'ETAPE' OR "stage_id" IS NOT NULL);
-- Un module ne peut être déclaré obligatoire que pour une étape, avec une source officielle.
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_mandatory_source_check"
  CHECK ("obligation" IS DISTINCT FROM 'OBLIGATOIRE'
    OR ("category" = 'ETAPE' AND "stage_id" IS NOT NULL AND "official_source" IS NOT NULL));

-- Les nouveaux champs suivent la règle « contenu modifiable seulement à l'état brouillon ».
CREATE OR REPLACE FUNCTION "module_versions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
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
    OR NEW."theme" IS DISTINCT FROM OLD."theme"
    OR NEW."category" IS DISTINCT FROM OLD."category"
    OR NEW."obligation" IS DISTINCT FROM OLD."obligation"
    OR NEW."official_source" IS DISTINCT FROM OLD."official_source") THEN
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

-- ─── Référentiel d'âge versionné (D96) ─────────────────────────────────────────────────────────
ALTER TABLE "age_rule_sets" ADD CONSTRAINT "age_rule_sets_values_check" CHECK (
  ("branch_exit_age_years" IS NULL OR "branch_exit_age_years" BETWEEN 1 AND 40)
  AND ("catch_up_delay_months" IS NULL OR "catch_up_delay_months" > 0)
  AND ("exit_alert_months" IS NULL OR "exit_alert_months" > 0));
ALTER TABLE "age_rule_sets" ADD CONSTRAINT "age_rule_sets_activation_check" CHECK (
  "status" = 'BROUILLON' OR ("effective_from" IS NOT NULL AND "activated_at" IS NOT NULL));

ALTER TABLE "age_stage_rules" ADD CONSTRAINT "age_stage_rules_period_check" CHECK (
  "start_years" BETWEEN 0 AND 40 AND "start_months" BETWEEN 0 AND 11
  AND (("end_years" IS NULL AND "end_months" IS NULL)
    OR ("end_years" IS NOT NULL AND "end_months" BETWEEN 0 AND 11
      AND "end_years" * 12 + "end_months" > "start_years" * 12 + "start_months")));

-- Un référentiel en vigueur est figé (préserve les parcours calculés antérieurement).
CREATE FUNCTION "age_rule_sets_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un référentiel d''âge ne peut pas être supprimé.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" = 'EN_VIGUEUR' THEN
    RAISE EXCEPTION 'Un référentiel en vigueur est figé : créez une nouvelle version.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "age_rule_sets_guard" BEFORE UPDATE OR DELETE ON "age_rule_sets"
  FOR EACH ROW EXECUTE FUNCTION "age_rule_sets_guard"();

CREATE FUNCTION "age_stage_rules_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "AgeRuleSetStatus";
BEGIN
  SELECT "status" INTO parent_status FROM "age_rule_sets"
    WHERE "id" = COALESCE(NEW."rule_set_id", OLD."rule_set_id");
  IF parent_status IS DISTINCT FROM 'BROUILLON'
    OR (TG_OP = 'UPDATE' AND NEW."rule_set_id" IS DISTINCT FROM OLD."rule_set_id") THEN
    RAISE EXCEPTION 'Les règles d''un référentiel ne sont modifiables qu''à l''état brouillon.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "age_stage_rules_guard" BEFORE INSERT OR UPDATE OR DELETE ON "age_stage_rules"
  FOR EACH ROW EXECUTE FUNCTION "age_stage_rules_guard"();

-- ─── Appartenance à la branche (D95) ───────────────────────────────────────────────────────────
ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_membership_check"
  CHECK (("membership_status" = 'SORTI') = ("branch_exited_on" IS NOT NULL));

CREATE FUNCTION "append_only_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table en ajout seul : %', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER "route_membership_events_append_only" BEFORE UPDATE OR DELETE ON "route_membership_events"
  FOR EACH ROW EXECUTE FUNCTION "append_only_guard"();

-- ─── Rattrapages (D98) ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "catch_up_obligations" ADD CONSTRAINT "catch_up_obligations_decision_check" CHECK (
  ("decision" IS NULL AND "decided_at" IS NULL AND "decision_reason" IS NULL)
  OR ("decision" IS NOT NULL AND "decided_at" IS NOT NULL AND "decision_reason" IS NOT NULL));

CREATE FUNCTION "catch_up_obligations_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une obligation de rattrapage ne peut pas être supprimée.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."scout_profile_id" IS DISTINCT FROM OLD."scout_profile_id"
    OR NEW."module_id" IS DISTINCT FROM OLD."module_id"
    OR NEW."origin_stage_id" IS DISTINCT FROM OLD."origin_stage_id"
    OR NEW."rule_set_id" IS DISTINCT FROM OLD."rule_set_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR (OLD."decision" IS NOT NULL AND (NEW."decision" IS DISTINCT FROM OLD."decision"
      OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
      OR NEW."decided_by_id" IS DISTINCT FROM OLD."decided_by_id"
      OR NEW."decision_reason" IS DISTINCT FROM OLD."decision_reason")) THEN
    RAISE EXCEPTION 'Obligation de rattrapage : origine et décision immuables.' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "catch_up_obligations_guard" BEFORE UPDATE OR DELETE ON "catch_up_obligations"
  FOR EACH ROW EXECUTE FUNCTION "catch_up_obligations_guard"();

-- ─── Années scoutes, mandats, délégations (D100–D103) ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "scout_years" ADD CONSTRAINT "scout_years_label_check" CHECK ("label" ~ '^[0-9]{4}-[0-9]{4}$');
ALTER TABLE "scout_years" ADD CONSTRAINT "scout_years_period_check" CHECK ("ends_on" > "starts_on");
ALTER TABLE "scout_years" ADD CONSTRAINT "scout_years_no_overlap"
  EXCLUDE USING gist (daterange("starts_on", "ends_on", '[]') WITH &&);
CREATE TRIGGER "scout_years_append_only" BEFORE UPDATE OR DELETE ON "scout_years"
  FOR EACH ROW EXECUTE FUNCTION "append_only_guard"();

ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_period_check" CHECK (
  "ends_on" >= "starts_on"
  AND ("ended_early_on" IS NULL OR "ended_early_on" BETWEEN "starts_on" AND "ends_on"));
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_end_check" CHECK (
  ("ended_early_on" IS NULL) = ("end_reason" IS NULL));
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_authority_check" CHECK (
  length(btrim("appointing_authority")) > 0);
-- Un seul responsable plein à une date donnée (RM : critère d'acceptation 13).
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_one_plein"
  EXCLUDE USING gist (daterange("starts_on", COALESCE("ended_early_on", "ends_on"), '[]') WITH &&)
  WHERE ("function" = 'PLEIN');
-- Une personne n'exerce qu'une fonction à la fois (changement de fonction = nouveau mandat).
ALTER TABLE "leadership_mandates" ADD CONSTRAINT "leadership_mandates_one_per_user"
  EXCLUDE USING gist (
    "user_id" WITH =,
    daterange("starts_on", COALESCE("ended_early_on", "ends_on"), '[]') WITH &&
  );

CREATE FUNCTION "leadership_mandates_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un mandat ne peut pas être supprimé.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."ended_early_on" IS NOT NULL
    OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
    OR NEW."function" IS DISTINCT FROM OLD."function"
    OR NEW."scout_year_id" IS DISTINCT FROM OLD."scout_year_id"
    OR NEW."starts_on" IS DISTINCT FROM OLD."starts_on"
    OR NEW."ends_on" IS DISTINCT FROM OLD."ends_on"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."appointing_authority" IS DISTINCT FROM OLD."appointing_authority"
    OR NEW."appointment_reference" IS DISTINCT FROM OLD."appointment_reference"
    OR NEW."previous_mandate_id" IS DISTINCT FROM OLD."previous_mandate_id"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."recorded_by_id" IS DISTINCT FROM OLD."recorded_by_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Un mandat est immuable : seule une fin anticipée peut être enregistrée, une fois.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "leadership_mandates_guard" BEFORE UPDATE OR DELETE ON "leadership_mandates"
  FOR EACH ROW EXECUTE FUNCTION "leadership_mandates_guard"();

ALTER TABLE "delegations" ADD CONSTRAINT "delegations_period_check" CHECK ("ends_on" >= "starts_on");
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_permissions_check" CHECK (cardinality("permissions") > 0);
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_parties_check" CHECK ("delegator_id" <> "delegate_id");
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_revocation_check" CHECK (
  ("revoked_at" IS NULL AND "revoked_by_id" IS NULL AND "revoke_reason" IS NULL)
  OR ("revoked_at" IS NOT NULL AND "revoke_reason" IS NOT NULL));

CREATE FUNCTION "delegations_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une délégation ne peut pas être supprimée.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."revoked_at" IS NOT NULL
    OR NEW."delegator_id" IS DISTINCT FROM OLD."delegator_id"
    OR NEW."delegate_id" IS DISTINCT FROM OLD."delegate_id"
    OR NEW."permissions" IS DISTINCT FROM OLD."permissions"
    OR NEW."starts_on" IS DISTINCT FROM OLD."starts_on"
    OR NEW."ends_on" IS DISTINCT FROM OLD."ends_on"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Une délégation est immuable : seule une révocation peut être enregistrée, une fois.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "delegations_guard" BEFORE UPDATE OR DELETE ON "delegations"
  FOR EACH ROW EXECUTE FUNCTION "delegations_guard"();
