-- Fiches médicales personnelles (D135–D137) : table additive, contenu chiffré par l'API.
-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_user_id_key" ON "medical_records"("user_id");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Forme du chiffrement AES-256-GCM et révision optimiste.
ALTER TABLE "medical_records"
  ADD CONSTRAINT "medical_records_iv_length" CHECK (octet_length("iv") = 12),
  ADD CONSTRAINT "medical_records_auth_tag_length" CHECK (octet_length("auth_tag") = 16),
  ADD CONSTRAINT "medical_records_revision_positive" CHECK ("revision" >= 1);
