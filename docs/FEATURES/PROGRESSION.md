# Progression individuelle — phase 4

Le dossier `/administration/routiers/[id]` réunit progression, formations, évaluations, activités, observations et historique. Toutes les données pédagogiques référencent `ScoutProfile`, y compris sans compte. Le rattachement ultérieur d'un compte conserve ces données.

`ScoutStageChange` conserve l'ancienne et la nouvelle étape, la date de décision et d'effet, le décideur, le motif, les observations, justificatifs et la référence de cérémonie. Les décisions sont immuables en base. Une correction crée un nouvel événement lié au précédent. Les anciens changements connus sont repris depuis `AuditLog` par la migration `20261031090000_progression_programme_activities`, sans inventer de motif historique.

Le responsable examine le dossier et confirme explicitement la décision. Le service verrouille le profil, contrôle l'étape attendue puis actualise le profil, ajoute l'événement et le journal d'audit dans une transaction. L'édition générale de la fiche ne permet plus de contourner ce circuit. Aucun quiz, score, présence ou durée ne provoque de changement automatique.

`ModuleStudy` conserve module, version publiée, date, mode (lecture numérique, lecture hors ligne déclarée par l'encadrement, cours papier, formation collective), auteur et observation. L'annulation est motivée et tracée, sans suppression. L'enregistrement d'une lecture hors ligne n'implémente pas de synchronisation hors ligne.

L'espace routier `/progression` permet de consulter son parcours et déclarer une étude numérique, par une action explicite. Aucun clic de consultation ne constitue une acquisition. Les observations internes et les corrections confidentielles ne sont pas exposées dans cet espace.

API : `GET /scouts/:id/progression`, `GET /scouts/:id/timeline`, `POST /scouts/:id/stage-changes`, `POST /scouts/:id/module-studies`, `POST /module-studies/:id/cancel`, `GET /me/progression`, `POST /me/module-studies`, `GET /progression/published-modules` (préfixe `/api/v1`).
