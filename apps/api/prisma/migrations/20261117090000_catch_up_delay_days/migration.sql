-- D177 : délai de rattrapage par étape exprimé en jours (environ deux à trois semaines).
-- Migration additive : colonne facultative, nulle pour les référentiels existants (aucune réécriture).
ALTER TABLE "age_rule_sets" ADD COLUMN "catch_up_delay_days" INTEGER;
ALTER TABLE "age_rule_sets" ADD CONSTRAINT "age_rule_sets_catch_up_delay_days_check"
  CHECK ("catch_up_delay_days" IS NULL OR "catch_up_delay_days" BETWEEN 1 AND 365);
