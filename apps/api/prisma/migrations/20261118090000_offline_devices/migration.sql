-- CreateTable
CREATE TABLE "offline_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "key_material" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "offline_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offline_devices_user_id_idx" ON "offline_devices"("user_id");

-- AddForeignKey
ALTER TABLE "offline_devices" ADD CONSTRAINT "offline_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clé aléatoire de 32 octets exactement (jamais un mot de passe ni un dérivé).
ALTER TABLE "offline_devices" ADD CONSTRAINT "offline_devices_key_length" CHECK (octet_length("key_material") = 32);
