-- Suppression définitive d'un brouillon de module VIDE (décision du responsable, 2026-10-30, D129).
-- Les protections (versions, historique, provenance, module) restent en vigueur ; elles ne cèdent que
-- pendant l'exécution de `purge_empty_module_draft`, qui vérifie d'abord que le module :
--   - n'a jamais été publié et n'a qu'une version, à l'état BROUILLON, jamais soumise ;
--   - n'a aucune leçon contenant du texte ou une image, aucune ressource, aucun texte cité ;
--   - n'a aucun collaborateur ; aucune autre donnée ne le référence (clés étrangères RESTRICT :
--     questionnaires, études, activités, compétences, rattrapages, citations).
-- Le journal d'audit (ajout seul) n'est jamais modifié : l'import et la suppression y restent tracés.
-- Migration sans effet sur les données existantes.

CREATE OR REPLACE FUNCTION "module_purge_in_progress"(p_module_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('tesla.purge_module', true) = p_module_id::text;
$$;

CREATE OR REPLACE FUNCTION "module_versions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF "module_purge_in_progress"(OLD."module_id") THEN
      RETURN OLD;
    END IF;
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

CREATE OR REPLACE FUNCTION "pedagogical_modules_published_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF "module_purge_in_progress"(OLD."id") THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Un module ne peut pas être supprimé.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."published_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "module_versions"
    WHERE "id" = NEW."published_version_id" AND "module_id" = NEW."id" AND "status" = 'PUBLIE') THEN
    RAISE EXCEPTION 'La version publiée doit appartenir au module et être à l''état publié.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "module_version_events_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND "module_purge_in_progress"(OLD."module_id") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'L''historique des modules est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION "module_source_imports_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND "module_purge_in_progress"(OLD."module_id") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'La provenance d''un module importé est en ajout seul.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Seul point d'entrée de la suppression. Erreurs : MODULE_NOT_FOUND, MODULE_NOT_EMPTY.
CREATE FUNCTION "purge_empty_module_draft"(p_module_id uuid) RETURNS void LANGUAGE plpgsql AS $$
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
  DELETE FROM "module_source_imports" WHERE "module_id" = p_module_id;
  DELETE FROM "module_versions" WHERE "id" = v_version."id";
  DELETE FROM "pedagogical_modules" WHERE "id" = p_module_id;
  PERFORM set_config('tesla.purge_module', '', true);
END;
$$;
