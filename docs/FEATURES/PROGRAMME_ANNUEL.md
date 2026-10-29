# Programme annuel 2026–2027

`/administration/programme-annuel` propose un import Markdown en deux étapes : prévisualisation sans écriture, puis confirmation par le responsable. Les chefs peuvent consulter le programme. Le seed idempotent initialise le programme vide et les quatre catégories ; les correspondances proposées avec les étapes restent non confirmées. Le responsable peut les modifier et les confirmer séparément. Aucune durée ni règle de promotion n'en découle.

Aucun fichier `docs/PROGRAMME_ANNUEL_2026-2027.md` ni autre document source du programme n'a été trouvé dans le dépôt. Les séances officielles restent donc à importer depuis le document approuvé, sans génération de contenu de substitution.

Format accepté : tableau Markdown avec colonnes **Date** et **Activité** obligatoires. Colonnes facultatives : Catégories, Thème, Objectifs, Modules, Responsable, Lieu. Dates `AAAA-MM-JJ` ou `JJ/MM/AAAA` ; catégories séparées par virgule ou point-virgule ; objectifs par point-virgule ; modules par code existant. Toute ligne invalide ou référence inconnue est signalée, puis bloque l'application entière.

La clé d'import est la date et le titre normalisé (accents, casse et ponctuation ignorés). Réimporter le même tableau ne crée aucun doublon. Une séance modifiée manuellement est conservée ; changer une date ou un titre source peut désigner une nouvelle séance : examiner la prévisualisation avant confirmation. Une clé déjà liée à un autre programme est refusée. L'application est transactionnelle, avec verrou consultatif par programme et audit.

API : `GET /programmes`, `GET /programmes/categories`, `PATCH /programmes/categories/:id`, `POST /programmes/:id/import/preview`, `POST /programmes/:id/import` (préfixe `/api/v1`).

Initialisation locale : `npm run db:deploy`, puis `npm run db:seed` (sans `DEMO_ACCOUNT_PASSWORD` pour ne créer ou réinitialiser aucun compte de démonstration). Les correspondances déjà configurées ne sont pas écrasées par le seed.
