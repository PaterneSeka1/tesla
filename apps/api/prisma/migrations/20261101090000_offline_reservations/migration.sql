-- AlterTable
ALTER TABLE "evaluation_attempts" ADD COLUMN     "offline_authorization" UUID,
ADD COLUMN     "offline_decided_at" TIMESTAMPTZ(3),
ADD COLUMN     "offline_decision_code" TEXT,
ADD COLUMN     "offline_device_submitted_at" TIMESTAMPTZ(3),
ADD COLUMN     "offline_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "offline_issued_at" TIMESTAMPTZ(3),
ADD COLUMN     "offline_operation_id" UUID,
ADD COLUMN     "offline_payload_hash" TEXT,
ADD COLUMN     "offline_received_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_attempts_offline_authorization_key" ON "evaluation_attempts"("offline_authorization");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_attempts_offline_operation_id_key" ON "evaluation_attempts"("offline_operation_id");

