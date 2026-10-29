# Activités et présences

`/administration/activites` est partagé par les chefs et le responsable. Il permet de rechercher, filtrer et paginer les activités, de créer une activité supplémentaire et d'ouvrir son détail. Les séances importées restent distinguées des activités supplémentaires.

Le détail `/administration/activites/[id]` permet de modifier préparation, thème, objectifs, date, lieu, responsable, catégories, modules et compétences ; saisir contenu réalisé, difficultés, observations et compte rendu ; indiquer les compétences effectivement observées ; réaliser, reporter, annuler ou rétablir l'activité. Chaque écriture contrôle la révision et conserve un événement historique. Les compétences observées doivent appartenir aux compétences associées. Aucune participation ne valide automatiquement un acquis.

La feuille de présence présente les profils routiers, même sans compte. Présent, absent et excusé sont des valeurs explicites ; une absence de saisie reste « Non renseigné ». La saisie groupée ne modifie que les lignes envoyées, refuse les doublons et journalise les modifications. La contrainte unique activité/profil empêche les doubles lignes. La saisie est autorisée pour une activité réalisée ou dont la date prévue est passée, selon les contrôles du service. `/administration/presences` liste les activités sans aucune présence renseignée : une feuille partiellement saisie se retrouve depuis la liste générale.

`/mes-activites` expose uniquement les prochaines activités pertinentes et les propres présences du routier, sans feuille collective, notes individuelles ni compte rendu interne.

API : `GET/POST /activities`, `GET/PATCH /activities/:id`, `POST /activities/:id/status`, `GET/PUT /activities/:id/attendance`, `GET /me/activities` (préfixe `/api/v1`). Les modifications sensibles et les présences sont transactionnelles et auditées.
