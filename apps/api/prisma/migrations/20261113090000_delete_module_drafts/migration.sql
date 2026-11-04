-- Suppression individuelle d'un brouillon jamais soumis (D171), contenu compris.
-- Complète `purge_empty_module_draft` (D129, inchangée) sans affaiblir les triggers : les protections
-- des versions, de l'historique et du module ne cèdent que pendant l'exécution de cette fonction,
-- pour le seul module désigné, après les contrôles suivants :
--   - la version désignée appartient au module, est à l'état BROUILLON et n'a jamais été soumise
--     (aucune décision du responsable n'est donc effacée) ;
--   - aucune version n'en dérive ;
--   - s'il s'agit de la seule version (module jamais publié) : module non importé, sans
--     collaborateur, sans fichier téléversé ; les autres références (questionnaires, études,
--     activités, compétences, rattrapages, citations) restent protégées par les clés étrangères
--     RESTRICT ;
--   - sinon, seule la version de travail est abandonnée : le module et ses autres versions
--     (publiée, archivées) sont conservés.
-- Leçons, ressources et textes cités de cette version sont supprimés (déjà permis en brouillon).
-- Les fichiers stockés ne sont jamais supprimés. Le journal d'audit n'est jamais modifié : le
-- service y écrit la suppression dans la même transaction.
-- Une seule version par appel : aucune suppression par lot.
-- Migration sans effet sur les données existantes.

-- Erreurs : MODULE_NOT_FOUND, DRAFT_NOT_DELETABLE. Renvoie 'MODULE' ou 'VERSION'.
CREATE FUNCTION "delete_module_draft"(p_module_id uuid, p_version_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_version record;
  v_kind text;
BEGIN
  PERFORM 1 FROM "pedagogical_modules" WHERE "id" = p_module_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MODULE_NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT "id", "status", "submitted_at" INTO v_version
    FROM "module_versions" WHERE "id" = p_version_id AND "module_id" = p_module_id FOR UPDATE;
  IF NOT FOUND OR v_version."status" <> 'BROUILLON' OR v_version."submitted_at" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "module_versions" WHERE "based_on_version_id" = p_version_id) THEN
    RAISE EXCEPTION 'DRAFT_NOT_DELETABLE' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM "module_versions"
             WHERE "module_id" = p_module_id AND "id" <> p_version_id) THEN
    v_kind := 'VERSION';
  ELSE
    v_kind := 'MODULE';
    IF EXISTS (SELECT 1 FROM "pedagogical_modules"
               WHERE "id" = p_module_id AND "published_version_id" IS NOT NULL)
      OR EXISTS (SELECT 1 FROM "module_source_imports" WHERE "module_id" = p_module_id)
      OR EXISTS (SELECT 1 FROM "module_collaborators" WHERE "module_id" = p_module_id)
      OR EXISTS (SELECT 1 FROM "stored_files" WHERE "module_id" = p_module_id) THEN
      RAISE EXCEPTION 'DRAFT_NOT_DELETABLE' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  DELETE FROM "module_text_links" WHERE "version_id" = p_version_id;
  DELETE FROM "module_resources" WHERE "version_id" = p_version_id;
  DELETE FROM "module_lessons" WHERE "version_id" = p_version_id;

  PERFORM set_config('tesla.purge_module', p_module_id::text, true);
  DELETE FROM "module_version_events" WHERE "version_id" = p_version_id;
  DELETE FROM "module_versions" WHERE "id" = p_version_id;
  IF v_kind = 'MODULE' THEN
    DELETE FROM "pedagogical_modules" WHERE "id" = p_module_id;
  END IF;
  PERFORM set_config('tesla.purge_module', '', true);
  RETURN v_kind;
END;
$$;
