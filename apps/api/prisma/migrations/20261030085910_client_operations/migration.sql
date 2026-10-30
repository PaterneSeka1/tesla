-- CreateTable
CREATE TABLE "client_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "client_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_operations_user_id_created_at_idx" ON "client_operations"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "client_operations" ADD CONSTRAINT "client_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
