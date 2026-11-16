-- D183 : sexe du routier, facultatif (aucune valeur déduite pour les fiches existantes).
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- CreateEnum
CREATE TYPE "ScoutSex" AS ENUM ('GARCON', 'FILLE');

-- AlterTable
ALTER TABLE "scout_profiles" ADD COLUMN     "sex" "ScoutSex";
