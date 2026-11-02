-- AlterTable
ALTER TABLE "account_tokens" ADD COLUMN     "code_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code_hash" TEXT;

-- AlterTable
ALTER TABLE "evaluation_attempts" ADD COLUMN     "transmitted_at" TIMESTAMPTZ(3),
ADD COLUMN     "transmitted_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_code_hash_key" ON "account_tokens"("code_hash");

-- CreateIndex
CREATE INDEX "evaluation_attempts_transmitted_by_id_idx" ON "evaluation_attempts"("transmitted_by_id");

-- AddForeignKey
ALTER TABLE "evaluation_attempts" ADD CONSTRAINT "evaluation_attempts_transmitted_by_id_fkey" FOREIGN KEY ("transmitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reprise (D161) : les copies papier déjà saisies avant la séparation saisie / correction sont
-- considérées comme transmises par la personne qui les a enregistrées. Aucune donnée supprimée.
UPDATE "evaluation_attempts"
SET "transmitted_at" = "recorded_at", "transmitted_by_id" = "recorded_by_id"
WHERE "mode" = 'PAPIER'
  AND "recorded_at" IS NOT NULL
  AND "status" IN ('A_CORRIGER', 'SOUMISE', 'VALIDEE', 'REFUSEE');
