# API

Base : `http://localhost:4000/api/v1` · OpenAPI : `/api/docs` (UI) et `/api/docs-json` (JSON), si `SWAGGER_ENABLED=true`.

## Routes disponibles

### `GET /api/v1/health`
État de l'API et de la base. Répond toujours `200` tant que le processus fonctionne ; `status` indique l'état de la base.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptimeSeconds": 23,
  "timestamp": "2026-10-28T20:45:27.029Z",
  "database": "up"
}
```
`status: "degraded"` et `database: "down"` si PostgreSQL est injoignable (délai de connexion : 5 s). Contrat : `healthResponseSchema` (`@tesla/shared`).

Aucune autre route n'est exposée. Les modules `auth`, `users`, `pedagogy`, `progression`, `programmes`, `audit` sont réservés.

## Services métier développés (sans route HTTP)

Les services ci-dessous sont implémentés et testés sur PostgreSQL, mais **aucune route n'est exposée** tant que l'authentification ne fournit pas l'acteur (`Actor`). Contrats d'entrée : schémas Zod de `@tesla/shared` (`packages/shared/src/scouts.ts`, `evaluations.ts`).

| Service | Méthode | Permission | Contrat d'entrée |
| --- | --- | --- | --- |
| `ScoutProfilesService` | `create` | `scout.create` (chef, responsable) | `createScoutProfileInputSchema` |
| | `setMatricule`, `findByMatricule` | `scout.setMatricule`, `scout.read` | `matriculeSchema` |
| | `linkAccount` | `scout.linkAccount` (responsable) | `scoutProfileId`, `userId` |
| `TeamsService` | `create` | `team.manage` (responsable) | `createTeamInputSchema` |
| | `assign`, `unassign`, `teamAt` | `team.assign` (chef, responsable) | `assignTeamInputSchema` |
| `EvaluationAttemptsService` | `preparePaper` | `attempt.preparePaper` | `preparePaperAttemptInputSchema` |
| | `getPaperSheet` | `attempt.preparePaper` | `attemptCodeSchema` |
| | `findByCode` | `attempt.readAny` ou titulaire | `attemptCodeSchema` |
| | `recordPaperResult`, `submit`, `cancel` | `attempt.record` / `submit` / `cancel` | `recordPaperResultInputSchema`, `attemptReasonInputSchema` |
| | `decide`, `reopen` | `attempt.decide` / `reopen` (responsable) | `decideAttemptInputSchema`, `attemptReasonInputSchema` |
| `EvaluationWaiversService` | `grant`, `revoke` | `waiver.manage` (responsable) | `grantWaiverInputSchema`, `attemptReasonInputSchema` |

Codes d'erreur métier : `VALIDATION_ERROR` (400), `FORBIDDEN`, `EVALUATION_NOT_ELIGIBLE` (403), `SCOUT_PROFILE_NOT_FOUND`, `USER_NOT_FOUND`, `TEAM_NOT_FOUND`, `EVALUATION_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `WAIVER_NOT_FOUND` (404), `MATRICULE_ALREADY_USED`, `PROFILE_ALREADY_LINKED`, `ACCOUNT_ALREADY_LINKED`, `ACCOUNT_NOT_ROUTIER`, `TEAM_NAME_TAKEN`, `TEAM_ARCHIVED`, `ALREADY_IN_TEAM`, `NO_ACTIVE_TEAM`, `ATTEMPT_ALREADY_OPEN`, `ATTEMPT_NOT_PRINTABLE`, `ATTEMPT_NOT_PAPER`, `ATTEMPT_ALREADY_DECIDED`, `ATTEMPT_STATE_CHANGED`, `INVALID_ATTEMPT_TRANSITION`, `WAIVER_ALREADY_REVOKED` (409), `INVALID_ASSIGNMENT_DATE`, `EVALUATION_VERSION_NOT_PUBLISHED`, `ATTEMPT_RESULT_MISSING`, `REASON_REQUIRED`, `INVALID_EXPIRY` (422).

Un routier qui recherche un code ne lui appartenant pas reçoit `404 ATTEMPT_NOT_FOUND` (l'existence du code n'est pas révélée).

## Conventions

| Sujet | Règle |
| --- | --- |
| Préfixe | `/api/v1` |
| Format | JSON ; dates ISO 8601 en UTC |
| Contrats | Schémas Zod dans `@tesla/shared`, utilisés par l'API et le web |
| CORS | Origines de `CORS_ORIGINS` uniquement, `credentials: true` (sessions par cookie prévues) |
| Journalisation | Méthode, chemin, statut, durée ; jamais le corps des requêtes |

### Format des erreurs
Toutes les erreurs suivent `apiErrorSchema` :
```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Ressource introuvable.",
  "path": "/api/v1/inexistant",
  "timestamp": "2026-10-28T20:45:27.049Z"
}
```
`code` est stable (exploitable par le web) ; `message` est affichable en français. Les erreurs 5xx ne renvoient aucun détail interne (journalisées côté serveur).

## Endpoints prévus (non implémentés)
Authentification (`/auth/login`, `/auth/logout`, `/auth/me`), utilisateurs, modules et leçons, soumission/approbation, évaluations en ligne, validations officielles, programme annuel. Chacun sera documenté ici lors de son implémentation.

### Contrats prévus — routiers, équipes, tentatives, impression
Projet de routes adossées aux services ci-dessus (**aucune n'existe**). Toutes exigent une session ; permissions identiques aux services.

| Méthode et chemin | Service | Remarque |
| --- | --- | --- |
| `POST /routiers` | `ScoutProfilesService.create` | Routier sans compte |
| `GET /routiers?matricule=` | `findByMatricule` | Matricule normalisé avant recherche |
| `PATCH /routiers/:id/matricule` | `setMatricule` | Chaîne vide = retrait |
| `POST /routiers/:id/compte` | `linkAccount` | Body `{ userId }` |
| `POST /equipes` · `GET /equipes` | `TeamsService.create` | Archivage à prévoir |
| `POST /affectations` | `assign` | Clôt l'affectation précédente |
| `DELETE /routiers/:id/affectation-active` | `unassign` | Clôture (aucune suppression) |
| `GET /routiers/:id/affectations` | — | Historique (à développer) |
| `POST /tentatives/papier` | `preparePaper` | Renvoie la tentative et son code |
| `GET /tentatives/code/:code` | `findByCode` | Recherche normalisée |
| `PUT /tentatives/:id/resultat` | `recordPaperResult` | Motif requis après soumission |
| `POST /tentatives/:id/soumission` · `/decision` · `/annulation` · `/reouverture` | `submit`, `decide`, `cancel`, `reopen` | |
| `GET /tentatives/:id/historique` | — | Événements (à développer) |
| `POST /derogations` · `POST /derogations/:id/revocation` | `EvaluationWaiversService` | Responsable uniquement |
| `GET /tentatives/code/:code/feuille.pdf` | `getPaperSheet` + générateur PDF | Questionnaire nominatif ; lecture seule, réimpression sans nouvelle tentative |
| `GET /evaluations/:id/versions/:v/corrige.pdf` | à développer | Corrigé chef : chefs et responsable uniquement |
| `GET /modules/:id/versions/:v/support.pdf` | à développer | Support de cours (titre, objectifs, étape, leçons, illustrations, activités, références, version) |
