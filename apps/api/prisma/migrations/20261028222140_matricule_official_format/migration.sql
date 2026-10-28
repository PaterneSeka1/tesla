-- Format officiel du matricule (RM-002) : 7 chiffres suivis d'une lettre majuscule, ex. « 0000001A ».
-- Remplace la règle provisoire de la migration précédente. Contrainte uniquement : aucune donnée modifiée.
-- Si un matricule existant ne respecte pas ce format, l'ajout échoue (volontairement) : le corriger
-- avec le responsable avant de rejouer la migration.
ALTER TABLE "scout_profiles" DROP CONSTRAINT "scout_profiles_matricule_format_check";

ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_matricule_format_check"
  CHECK ("matricule" IS NULL OR "matricule" ~ '^[0-9]{7}[A-Z]$');
