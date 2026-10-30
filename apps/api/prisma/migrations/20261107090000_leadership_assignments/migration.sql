-- Simplification de la gouvernance (D132) : fonctions d'encadrement désignées directement par
-- l'administrateur, sans année scoute ni délégation. Migration additive : les tables
-- leadership_mandates, delegations et scout_years sont conservées en lecture seule.

-- CreateTable
CREATE TABLE "leadership_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "function" "LeaderFunction" NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "reason" TEXT,
    "end_reason" TEXT,
    "assigned_by_id" UUID,
    "ended_by_id" UUID,
    "source_mandate_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leadership_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leadership_assignments_source_mandate_id_key" ON "leadership_assignments"("source_mandate_id");

-- CreateIndex
CREATE INDEX "leadership_assignments_user_id_idx" ON "leadership_assignments"("user_id");

-- CreateIndex
CREATE INDEX "leadership_assignments_assigned_by_id_idx" ON "leadership_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "leadership_assignments_ended_by_id_idx" ON "leadership_assignments"("ended_by_id");

-- CreateIndex
CREATE INDEX "leadership_assignments_started_at_idx" ON "leadership_assignments"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_assignments_one_plein" ON "leadership_assignments"("function") WHERE (ended_at IS NULL AND function = 'PLEIN'::"LeaderFunction");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_assignments_one_per_user" ON "leadership_assignments"("user_id") WHERE (ended_at IS NULL);

-- AddForeignKey
ALTER TABLE "leadership_assignments" ADD CONSTRAINT "leadership_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_assignments" ADD CONSTRAINT "leadership_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_assignments" ADD CONSTRAINT "leadership_assignments_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Contraintes et historisation (Prisma ignore ces objets) ────────────────────────────────────

ALTER TABLE "leadership_assignments" ADD CONSTRAINT "leadership_assignments_end_check" CHECK (
  ("ended_at" IS NULL AND "ended_by_id" IS NULL AND "end_reason" IS NULL)
  OR ("ended_at" IS NOT NULL AND "ended_at" >= "started_at"));

-- Jamais supprimée ; seule la fin peut être enregistrée, une fois.
CREATE FUNCTION "leadership_assignments_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une fonction d''encadrement ne peut pas être supprimée.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."ended_at" IS NOT NULL
    OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
    OR NEW."function" IS DISTINCT FROM OLD."function"
    OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."assigned_by_id" IS DISTINCT FROM OLD."assigned_by_id"
    OR NEW."source_mandate_id" IS DISTINCT FROM OLD."source_mandate_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Une fonction d''encadrement est immuable : seule sa fin peut être enregistrée, une fois.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "leadership_assignments_guard" BEFORE UPDATE OR DELETE ON "leadership_assignments"
  FOR EACH ROW EXECUTE FUNCTION "leadership_assignments_guard"();

-- ─── Reprise des mandats en vigueur (date civile d'Abidjan, UTC) ────────────────────────────────
-- Les contraintes d'exclusion des mandats garantissent au plus un plein et une fonction par
-- personne à cette date. Mandats échus ou à venir, délégations et années scoutes restent consultables
-- dans leurs tables d'origine ; ils ne produisent plus aucun droit.
INSERT INTO "leadership_assignments"
  ("id", "user_id", "function", "started_at", "reason", "source_mandate_id", "created_at", "updated_at")
SELECT uuidv7(), m."user_id", m."function", m."starts_on"::timestamptz,
       'Reprise du mandat en vigueur lors de la suppression des mandats annuels.',
       m."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "leadership_mandates" m
JOIN "users" u ON u."id" = m."user_id" AND u."is_active" AND u."role" = 'ENCADREMENT'
WHERE m."starts_on" <= (now() AT TIME ZONE 'Africa/Abidjan')::date
  AND COALESCE(m."ended_early_on", m."ends_on") >= (now() AT TIME ZONE 'Africa/Abidjan')::date;

-- ─── Gel des anciennes tables (historique en lecture seule) ─────────────────────────────────────
CREATE FUNCTION "archived_table_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table archivée (%): aucune nouvelle écriture.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER "leadership_mandates_archived" BEFORE INSERT OR UPDATE ON "leadership_mandates"
  FOR EACH ROW EXECUTE FUNCTION "archived_table_guard"();
CREATE TRIGGER "delegations_archived" BEFORE INSERT OR UPDATE ON "delegations"
  FOR EACH ROW EXECUTE FUNCTION "archived_table_guard"();
CREATE TRIGGER "scout_years_archived" BEFORE INSERT ON "scout_years"
  FOR EACH ROW EXECUTE FUNCTION "archived_table_guard"();
