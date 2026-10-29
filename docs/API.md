# API

Base : `http://localhost:4000/api/v1` · OpenAPI : `/api/docs` (UI) et `/api/docs-json` (JSON), si `SWAGGER_ENABLED=true` (schémas générés depuis les contrats Zod ; authentification par cookie et en-tête `x-tesla-csrf` déclarés).

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

## Authentification et sécurité

Toutes les routes exigent une **session** sauf `GET /health`, `POST /auth/login` et `POST /auth/logout`. Sans session valide : `401 UNAUTHENTICATED`.

| Élément | Règle |
| --- | --- |
| Cookie | `tesla_session` : httpOnly, `SameSite=Lax`, `Secure` en production, `Path=/`, expiration = fin de session |
| Session | Jeton opaque 256 bits ; seul son hash SHA-256 est stocké (`sessions`). Durée absolue `SESSION_TTL_HOURS` (12 h par défaut). Invalide si révoquée, expirée ou si le compte est désactivé |
| Mot de passe | Argon2id |
| Limitation | 5 échecs / 15 min par (IP, e-mail), 20 par IP → `429 TOO_MANY_LOGIN_ATTEMPTS` (en mémoire) |
| CSRF | Toute écriture (`POST`, `PATCH`, `PUT`, `DELETE`) exige l'en-tête `x-tesla-csrf: 1` et, si présent, un `Origin` listé dans `CORS_ORIGINS` ; sinon `403 CSRF_REJECTED` |
| Permissions | Vérifiées par chaque service (`assertCan`) : `403 FORBIDDEN` |

### `POST /api/v1/auth/login`
Corps `loginInputSchema` `{ email, password }` → `200 { user }` (`meResponseSchema`) et pose du cookie. Erreur unique `401 INVALID_CREDENTIALS` (mot de passe faux, compte inconnu, désactivé ou non activé).

### `POST /api/v1/auth/logout`
Révoque la session courante et efface le cookie → `204`.

### `GET /api/v1/auth/me`
`200 { user: { id, email, firstName, lastName, role, scoutProfileId } }`.

## Routes métier

Pagination des listes : `?page=1&pageSize=20` (max. 100) → `{ items, page, pageSize, total }`. Contrats : `packages/shared/src/{scouts,observations,auth,api}.ts`.

| Méthode et chemin | Permission | Entrée → sortie |
| --- | --- | --- |
| `GET /progression/stages` | session | → `stageListResponseSchema` |
| `GET /teams?search=&status=active\|archived\|all` | chef, responsable | → page de `teamSchema` (avec `memberCount`) |
| `POST /teams` | responsable | `createTeamInputSchema` → `201 teamDetailSchema` |
| `GET /teams/:id` | chef, responsable | → `teamDetailSchema` (membres actuels) |
| `PATCH /teams/:id` | responsable | `updateTeamInputSchema` → `teamDetailSchema` |
| `POST /teams/:id/archive` | responsable | → `201 teamDetailSchema` (affectations ouvertes clôturées) |
| `GET /scouts?search=&teamId=&stageId=&status=&account=` | chef, responsable | → page de `scoutListItemSchema`. `search` : chaque mot doit correspondre au nom, aux prénoms ou au matricule ; `teamId`/`stageId` : UUID ou `none` ; `status` : `active` (défaut), `inactive`, `all` ; `account` : `with`, `without`, `all` |
| `POST /scouts` | responsable (+ étape) | `createScoutProfileInputSchema` → `201 scoutDetailSchema`. Aucun compte créé. `409 POSSIBLE_DUPLICATE` si homonyme : renvoyer avec `confirmDuplicate: true` |
| `GET /scouts/:id` | chef, responsable | → `scoutDetailSchema` (`account.email` réservé au responsable) |
| `PATCH /scouts/:id` | responsable ; étape : `scout.setStage` | `updateScoutProfileInputSchema` → `scoutDetailSchema` |
| `POST /scouts/:id/deactivate` · `/activate` | responsable | → `201 scoutDetailSchema` |
| `POST /scouts/:id/link-account` | responsable | `linkAccountInputSchema { email }` → `201 scoutDetailSchema` |
| `GET /scouts/:id/teams/history` | chef, responsable | → `teamAssignmentListSchema` |
| `POST /scouts/:id/teams/assign` | responsable | `assignTeamBodySchema { teamId, startedAt? }` → `201` historique |
| `POST /scouts/:id/teams/unassign` | responsable | `unassignTeamBodySchema { endedAt? }` → `201` historique |
| `GET /scouts/:id/pedagogical-history` | chef, responsable | → `scoutPedagogicalHistorySchema` (tentatives, changements d'étape journalisés) |
| `GET /scouts/:id/observations` | chef, responsable | → page de `observationSchema` (filtrée selon la visibilité) |
| `POST /scouts/:id/observations` | chef, responsable | `createObservationInputSchema` → `201 observationSchema` |
| `PATCH /scouts/:id/observations/:observationId` | auteur uniquement | `updateObservationInputSchema` → `observationSchema` |
| `GET /scouts/:id/observations/:observationId/revisions` | lecteurs de l'observation | → `observationRevisionListSchema` |

Une observation non visible (niveau `RESPONSABLE` d'un autre auteur) renvoie `404 OBSERVATION_NOT_FOUND` : son existence n'est pas révélée.

### Codes d'erreur
`VALIDATION_ERROR` (400), `UNAUTHENTICATED`, `INVALID_CREDENTIALS` (401), `FORBIDDEN`, `CSRF_REJECTED`, `OBSERVATION_NOT_AUTHOR`, `EVALUATION_NOT_ELIGIBLE` (403), `SCOUT_PROFILE_NOT_FOUND`, `USER_NOT_FOUND`, `TEAM_NOT_FOUND`, `OBSERVATION_NOT_FOUND`, `EVALUATION_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `WAIVER_NOT_FOUND` (404), `MATRICULE_ALREADY_USED`, `POSSIBLE_DUPLICATE`, `PROFILE_ALREADY_LINKED`, `ACCOUNT_ALREADY_LINKED`, `ACCOUNT_NOT_ROUTIER`, `TEAM_NAME_TAKEN`, `TEAM_ARCHIVED`, `TEAM_ALREADY_ARCHIVED`, `ALREADY_IN_TEAM`, `NO_ACTIVE_TEAM`, `SCOUT_INACTIVE`, `SCOUT_ALREADY_ACTIVE`, `SCOUT_ALREADY_INACTIVE`, `OBSERVATION_STATE_CHANGED`, `ATTEMPT_*`, `INVALID_ATTEMPT_TRANSITION`, `WAIVER_ALREADY_REVOKED` (409), `INVALID_ASSIGNMENT_DATE`, `STAGE_NOT_FOUND`, `EVALUATION_VERSION_NOT_PUBLISHED`, `ATTEMPT_RESULT_MISSING`, `REASON_REQUIRED`, `INVALID_EXPIRY` (422), `TOO_MANY_LOGIN_ATTEMPTS` (429).

## Services sans route HTTP (phase 4 bis)

`EvaluationAttemptsService` (préparation papier, feuille, recherche par code, saisie, soumission, décision, annulation, réouverture) et `EvaluationWaiversService` sont implémentés et testés sur PostgreSQL mais **non exposés**. Contrats d'entrée : `packages/shared/src/evaluations.ts`. Un routier qui recherche un code ne lui appartenant pas recevra `404 ATTEMPT_NOT_FOUND`.

## Conventions

| Sujet | Règle |
| --- | --- |
| Préfixe | `/api/v1` |
| Format | JSON ; dates ISO 8601 en UTC |
| Contrats | Schémas Zod dans `@tesla/shared`, utilisés par l'API et le web |
| CORS | Origines de `CORS_ORIGINS` uniquement, `credentials: true`, en-têtes `Content-Type`, `Accept`, `x-tesla-csrf` |
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
Gestion des comptes (création, activation, réinitialisation du mot de passe), modules et leçons, soumission/approbation, évaluations en ligne, validations officielles, programme annuel, consultation du journal d'audit.

### Contrats prévus — tentatives et impression (phase 4 bis)

| Méthode et chemin | Service | Remarque |
| --- | --- | --- |
| `POST /attempts/paper` | `preparePaper` | Renvoie la tentative et son code `NT-AAAA-NNNNNN` |
| `GET /attempts/code/:code` | `findByCode` | Recherche normalisée |
| `PUT /attempts/:id/result` | `recordPaperResult` | Motif requis après soumission |
| `POST /attempts/:id/submit` · `/decision` · `/cancel` · `/reopen` | `submit`, `decide`, `cancel`, `reopen` | Décision et réouverture : responsable |
| `POST /waivers` · `POST /waivers/:id/revoke` | `EvaluationWaiversService` | Responsable uniquement |
| `GET /attempts/code/:code/sheet.pdf` | `getPaperSheet` + générateur PDF | Questionnaire nominatif ; réimpression sans nouvelle tentative |
| `GET /evaluations/:id/versions/:v/answer-key.pdf` | à développer | Corrigé : chefs et responsable |
| `GET /modules/:id/versions/:v/support.pdf` | à développer | Support de cours |

Les chemins sont alignés sur la convention anglaise retenue pour `/teams` et `/scouts` (à confirmer à l'implémentation).
