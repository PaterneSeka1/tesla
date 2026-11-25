-- CreateTable
CREATE TABLE "learner_bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_slug" TEXT NOT NULL,
    "lesson_key" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_slug" TEXT NOT NULL,
    "lesson_key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learner_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learner_bookmarks_user_id_module_slug_lesson_key_key" ON "learner_bookmarks"("user_id", "module_slug", "lesson_key");

-- CreateIndex
CREATE UNIQUE INDEX "learner_notes_user_id_module_slug_lesson_key_key" ON "learner_notes"("user_id", "module_slug", "lesson_key");

-- AddForeignKey
ALTER TABLE "learner_bookmarks" ADD CONSTRAINT "learner_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note personnelle bornée (D209) ; révision strictement positive.
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_body_length" CHECK (char_length("body") BETWEEN 1 AND 4000);
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_revision_positive" CHECK ("revision" >= 1);
