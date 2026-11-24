-- Rappels de rattrapage et notifications de la plateforme (D192). Migration additive.
-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('RATTRAPAGE_ECHEANCE_PROCHE', 'RATTRAPAGE_EN_RETARD');

-- AlterTable
ALTER TABLE "age_rule_sets" ADD COLUMN     "catch_up_alert_days" INTEGER;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "email_attempted_at" TIMESTAMPTZ(3),
    "emailed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Garde : une notification n'est jamais supprimée ; seuls la lecture et l'envoi par e-mail évoluent,
-- une fois chacun (horodatages jamais effacés ni réécrits).
CREATE FUNCTION notifications_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'notifications: suppression interdite' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at)
     OR (OLD.email_attempted_at IS NOT NULL AND NEW.email_attempted_at IS DISTINCT FROM OLD.email_attempted_at)
     OR (OLD.emailed_at IS NOT NULL AND NEW.emailed_at IS DISTINCT FROM OLD.emailed_at) THEN
    RAISE EXCEPTION 'notifications: contenu immuable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_guard
  BEFORE UPDATE OR DELETE ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION notifications_guard();
