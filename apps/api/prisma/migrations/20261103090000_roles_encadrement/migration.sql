-- Refonte de l'encadrement (D93) : nouveaux rôles d'accès. Migration séparée car une valeur d'enum
-- ajoutée ne peut pas être utilisée dans la même transaction. Aucune valeur n'est supprimée.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ENCADREMENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMINISTRATEUR';
