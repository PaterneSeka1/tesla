# Tableaux de bord pédagogiques

Les espaces `/responsable`, `/chef` et `/routier` utilisent les endpoints de rôle et des schémas de réponse partagés. Les indicateurs proviennent exclusivement de PostgreSQL.

- Responsable : population, comptes, acquisitions, réalisation des activités ; file des contenus (modules et questionnaires) distincte des décisions sur les personnes (résultats et compétences), compléments et corrections ; activités prochaines et signaux d'accompagnement.
- Chef : population suivie, propositions de l'auteur, réponses récentes, observations de l'auteur, modules préparés, copies à corriger, activités et présences à saisir. Le périmètre actuel couvre une seule communauté, conformément aux permissions existantes (D65).
- Routier : étape et équipe réelles, modules étudiés, modules publiés recommandés pour l'étape, acquis validés et résultats communiqués après examen, activités pertinentes. Un compte non rattaché présente un état explicite.

`/administration/statistiques` filtre par équipe actuelle, étape et dates : répartition des actifs par équipe et étape, validations, études, activités et participation par mois. Les filtres de population s'appliquent aux profils ; les effectifs d'activités décrivent la communauté dans la période, sans attribution artificielle aux équipes. Le taux de présence est présents / saisies renseignées (présents + absents + excusés) ; aucune saisie signifie un taux non calculable. Les observations confidentielles ne sont pas incluses dans les statistiques.

Signaux d'accompagnement : compétence à retravailler, étape ou équipe manquante et deux dernières présences renseignées absentes non excusées (indicateur provisoire D74). Aucune sanction, promotion ou validation n'en découle ; aucun classement compétitif.

API : `GET /statistics?teamId=&stageId=&from=&to=`, `GET /dashboard/responsable`, `GET /dashboard/chef`, `GET /me/dashboard`, `GET /me/activities` (préfixe `/api/v1`).
