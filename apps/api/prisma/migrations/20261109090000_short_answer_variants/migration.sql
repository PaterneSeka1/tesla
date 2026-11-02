-- Réponses courtes à correction automatique (D138) : variantes acceptées, colonne additive.
-- AlterTable
ALTER TABLE "evaluation_questions" ADD COLUMN     "accepted_answers" TEXT[] DEFAULT ARRAY[]::TEXT[];
