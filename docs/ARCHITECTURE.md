# Architecture

## Vue d'ensemble

```
Navigateur / PWA ──HTTPS──► apps/web (Next.js 16)
        │                        │
        └──── fetch JSON ───────►│ apps/api (NestJS 12)  /api/v1
                                 │        │ Prisma 7 + @prisma/adapter-pg
                                 │        ▼
                                 │   PostgreSQL 18
packages/shared ◄── importé par web et api (schémas Zod, constantes)
packages/config ◄── tsconfig de base, configuration ESLint
```

Le navigateur appelle directement l'API (CORS restreint aux origines déclarées). En production, Nginx servira les deux applications sous le même domaine (cible : VPS OVHcloud Ubuntu 24.04, 2 vCore, 4 Go RAM, partagé avec SCOUT-NDPST).

## Paquets

| Paquet | Rôle | Sortie |
| --- | --- | --- |
| `apps/web` (`@tesla/web`) | Interface PWA : accueil, connexion, espaces routier / chef / responsable | `.next/` |
| `apps/api` (`@tesla/api`) | API REST, configuration validée, accès base, Swagger | `dist/` |
| `packages/shared` (`@tesla/shared`) | Contrats partagés : `healthResponseSchema`, `apiErrorSchema`, `ROLES`, `PROGRESSION_STAGES` | `dist/` (ESM + `.d.ts`) |
| `packages/config` (`@tesla/config`) | `tsconfig.base.json`, `createTypeScriptConfig` (ESLint) | sources |

`@tesla/shared` est compilé (`npm run build:shared`) car l'API, en ESM Node, exécute du JavaScript. Les scripts racine `dev`, `typecheck` et `test` le compilent automatiquement.

## Web (`apps/web/src`)

| Dossier | Contenu |
| --- | --- |
| `app/` | Routes App Router : `/`, `/connexion`, `(espaces)/routier`, `/chef` (+ `/chef/modules`, `/chef/modules/nouveau`, `/chef/modules/[id]/{modifier,apercu}`, `/chef/soumissions`), `/responsable`, `(espaces)/administration/{equipes,routiers}` (liste, création, fiche, modification), `(espaces)/administration/{modules,modules-a-valider,modules/[id]/revision,historique-publications}`, évaluations : `/chef/evaluations` (+ `nouvelle`, `[id]/{modifier,apercu}`, `papier`, `papier/[code]`), `/chef/corrections` (+ `[code]`), `/administration/{evaluations,evaluations/[id],evaluations-a-valider,evaluations-a-valider/[id],deblocages}`, `(espaces)/evaluations` (`/evaluations`, `/evaluations/[id]`, `/evaluations/[id]/passer`), `/mes-resultats`, `(espaces)/modules` (bibliothèque : `/modules`, `/modules/[slug]`, `/modules/[slug]/lecons/[id]`, `/modules/[slug]/imprimer`), `/hors-ligne`, `manifest.ts`, pages 404/erreur/chargement |
| `proxy.ts` | Redirection vers `/connexion` sans cookie de session (contrôle optimiste) |
| `components/ui/` | Primitives shadcn/ui (button, card, badge, alert, input, label, skeleton, textarea, native-select, table, dialog, toaster) |
| `components/layout/` | `DashboardShell` (sidebar desktop, navigation horizontale mobile, `SessionGate`), `SpaceNav` |
| `components/auth/` | `SessionGate` (vérifie `/auth/me` et le rôle, fournit `useSessionUser`), `UserMenu`, `ResponsableOnly` |
| `components/modules/` | `LessonEditor` (Tiptap), `LessonContent` (rendu sûr du JSON), `ModuleVersionView`, `ModuleMetadataForm`, `EditorModuleList`, `ModuleHistory`, `ResourceList`, `CommentDialog`, `ModuleStatusBadge`, tableaux de bord éditorial et de validation, `useModuleAction` |
| `components/evaluations/` | `QuestionForm`, `QuestionList`, `EvaluationSettingsForm`, `EvaluationList`, `CorrectionWorkspace` (saisie papier, notation, soumission), `CopyHeader`/`CopyAnswers`/`CopyHistory`, `AttemptTable`, badges, `useEvaluationAction` |
| `components/` | `ConfirmDialog`, `Pagination`, `QueryError`/`TableSkeleton`, `FormField`, `FollowUpOverview` (indicateurs) |
| `lib/api/` | `apiFetch`/`apiSend` (client typé, cookie, en-tête anti-CSRF, erreurs normalisées) et `queryOptions` par domaine (`auth`, `teams`, `scouts`, `modules`, `evaluations`) |
| `lib/offline/` | Structure IndexedDB (fondation PWA) |
| `lib/spaces.ts` | Configuration des espaces (dont `bibliotheque`) et de leur navigation ; entrées réservées à un rôle (`roles`) filtrées par `SpaceNav` |
| `public/sw.js` | Service worker (enregistré en production uniquement) |

## API (`apps/api/src`)

| Dossier | Contenu |
| --- | --- |
| `config/` | Validation Zod des variables, chargement du `.env` racine, version |
| `prisma/` | `PrismaService` (client unique, connexion paresseuse) |
| `health/` | `GET /api/v1/health` |
| `common/` | Filtre d'erreurs homogène, journalisation des requêtes, protection CSRF, `Actor`, matrice des permissions (`assertCan`), validation Zod, schémas OpenAPI dérivés de Zod, erreurs Prisma |
| `modules/auth/` | `AuthController` (`/auth/login`, `/logout`, `/me`), `AuthService` (sessions), `SessionGuard` (garde globale, `@Public()`, `@CurrentActor()`), `LoginRateLimiter`, Argon2id |
| `modules/scouts/` | Contrôleurs `/scouts`, `/teams`, `/scouts/:id/observations` ; `ScoutProfilesService` (liste, fiche, inscription, modification, étape, activation, rattachement de compte, historique pédagogique), `TeamsService` (équipes, archivage, affectations, historique), `ObservationsService` |
| `modules/progression/` | `GET /progression/stages` |
| `modules/evaluations/` | Contrôleurs `/editor/evaluations`, `/admin/evaluations`, `/evaluations` + `/attempts` + `/me/attempts`, `/paper-attempts` + `/corrections` + `/admin/attempts`, `/admin/waivers` ; services `EvaluationEditorService` (rédaction), `EvaluationReviewService` (approbation, publication), `EvaluationSessionsService` (passation en ligne), `EvaluationAttemptsService` (papier, correction, examen), `EvaluationWaiversService` ; `eligibility.ts` (fonction pure), `attempt-answers.ts` (validation, correction objective), `attempt-code.ts`, `paper-pdf.ts` (pdfkit) |
| `modules/pedagogy/` | Contrôleurs `/modules` (bibliothèque), `/editor` (rédaction), `/admin/modules` (approbation) ; `ModuleCatalogService`, `ModuleEditorService`, `ModuleReviewService` ; `module-common.ts` (accès, verrous, historique, présentation) |
| `modules/` (autres) | Modules réservés : `users`, `programmes`, `audit` (vides) |
| `app.setup.ts` | Configuration HTTP partagée entre `main.ts` et les tests e2e |

## Authentification

```
Navigateur ── POST /auth/login (x-tesla-csrf) ──► AuthService : limiteur → Argon2id → INSERT session (hash du jeton)
           ◄── Set-Cookie tesla_session (httpOnly, SameSite=Lax, Secure en prod)
Navigateur ── toute requête (cookie) ──► SessionGuard : hash → session valide ? compte actif ? → request.actor
                                         → contrôleur → service : assertCan(actor, permission) → Prisma (+ AuditLog)
Web : proxy.ts (cookie présent ?) → SessionGate (/auth/me, rôle) → écrans ; chaque donnée reste filtrée par l'API.
```

## Modules pédagogiques

```
Chef ── /editor/* (session + module.write) ──► ModuleEditorService : resolveAccess (auteur | collaborateur | responsable)
                                              → verrou de la version → contrôle d'état et de révision → écriture
                                              → module_version_events (+ AuditLog pour la soumission)
Responsable ── /admin/modules/* (module.review) ──► ModuleReviewService : verrou → transition → événement + AuditLog
                                                   publication : archive l'ancienne + publie + bascule le pointeur (1 transaction)
Tous ── /modules/* (module.read) ──► ModuleCatalogService : version publiée courante uniquement
PostgreSQL : triggers (contenu figé hors brouillon, transitions, pointeur), index uniques partiels (1 version de travail, 1 publiée)
```

Le contenu des leçons circule en JSON validé par `lessonDocumentSchema` (même schéma côté web et API) et est rendu en éléments React, sans HTML interprété. Détail : [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md).

## Configuration

Un seul fichier `.env` à la racine (modèle : `.env.example`), lu par Docker Compose, l'API (`loadRootEnvFile`), Prisma (`prisma.config.ts`) et Next.js (`next.config.ts`). Les variables déjà définies dans l'environnement sont prioritaires.

## Suivi hybride numérique / papier

Le **profil routier** (`ScoutProfile`) est le pivot : un routier sans compte est inscrit, affecté à une équipe, évalué et suivi comme les autres. Le compte (`User`) ne sert qu'à se connecter et peut être rattaché plus tard.

```
Chef (application)                     API (NestJS)                                PostgreSQL
──────────────────                     ────────────                                ──────────
Choisir routier + évaluation ──────────► GET /evaluations?scoutProfileId (éligibilité calculée)
Créer la tentative ─────────────────────► POST /paper-attempts : permissions → éligibilité → version publiée
                                           → issueAttemptCode (compteur annuel verrouillé) ─► INSERT tentative PREPAREE + événement
Imprimer / réimprimer ──────────────────► GET /paper-attempts/:code/pdf (pdfkit ; questionnaire sans corrigé ; lecture seule)
   … le routier répond sur papier …
Retrouver « NT-2027-000125 » ───────────► GET /corrections/:code (permissions)
Transcrire, noter, observer ────────────► POST /corrections/:code/answers → A_CORRIGER (correction objective, instantané)
Soumettre ──────────────────────────────► POST /corrections/:code/submit-review → SOUMISE
Responsable : examiner ─────────────────► accept-review → VALIDEE (+ AuditLog) | request-correction → A_CORRIGER ; aucune modification d'étape
```

- Le code de tentative est **toujours** émis par le serveur, dans la même transaction que la tentative (en ligne comme sur papier) ; le web ne fait que l'afficher et le saisir.
- Le code est un identifiant de recherche, pas un secret : toute lecture passe par les permissions.
- Les modes `EN_LIGNE` et `PAPIER` partagent les mêmes tables (`evaluation_attempts`, `attempt_answers`), le même moteur de correction et le même historique ; `HORS_LIGNE` reste réservé (non développé).
- PDF serveur : **pdfkit** (JavaScript pur, polices standard intégrées aux lecteurs PDF, aucune ressource distante) génère questionnaire, corrigé et grille en mémoire, à la demande, sans stockage. Le support de cours reste imprimé depuis le navigateur (`/modules/[slug]/imprimer`).
- Les services reçoivent un `Actor` fourni par la garde de session.
