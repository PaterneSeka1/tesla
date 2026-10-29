# Rapport de livraison — phase 4

Date : 2026-10-29. Reprise des modifications déjà présentes, complétées sans commit, push ni déploiement. SCOUT-NDPST et les fichiers `.env` n'ont pas été modifiés.

## Fonctionnalités livrées

Progression et décisions officielles humaines, dossier pédagogique sans dépendance au compte, référentiel de compétences, preuves et propositions, complément/refus/approbation/révocation, suivi des modules étudiés, import annuel vérifiable, activités et comptes rendus, présences groupées, tableaux de bord par rôle et statistiques réelles filtrables.

Les parcours sont décrits dans [PROGRESSION.md](PROGRESSION.md), [COMPETENCES.md](COMPETENCES.md), [PROGRAMME_ANNUEL.md](PROGRAMME_ANNUEL.md), [SUIVI_ACTIVITES.md](SUIVI_ACTIVITES.md) et [DASHBOARDS.md](DASHBOARDS.md). Ces documents constituent aussi le catalogue des endpoints sous `/api/v1`.

## Modèles et migration

Migration additive `20261031090000_progression_programme_activities` (septième migration du dépôt), synchronisée sur `tesla` et `tesla_test`. Aucun reset de développement ; contrôle `prisma migrate diff` : aucune différence détectée. Le seed idempotent des références a été exécuté avec `NODE_ENV=production` pour exclure tout compte de démonstration.

Modèles : `ScoutStageChange`, `Competency`, `CompetencyModule`, `CompetencyProposal`, `CompetencyProposalEvent`, `CompetencyEvidence`, `CompetencyValidation`, `ModuleStudy`, `ProgrammeCategory`, `Programme`, `Activity`, `ActivityCategory`, `ActivityModule`, `ActivityCompetency`, `ActivityEvent`, `ActivityAttendance`. Ajout de `ScoutProfile.currentStageSince` et relations. Contraintes uniques, historique en ajout seul, décisions et études protégées par triggers ; reprise des événements d'étape connus dans l'audit.

## Interfaces

- Administration partagée : `/administration/routiers/[id]`, `/administration/competences`, `/administration/validations` (nouvelle proposition et détail), `/administration/activites` (création et détail), `/administration/presences`, `/administration/programme-annuel`, `/administration/statistiques`.
- Chef : suivi et observations dans les fiches existantes, propositions et activités dans les écrans partagés ; tableau de bord `/chef`. Les permissions restent vérifiées dans les services.
- Routier : `/routier`, `/progression`, `/mes-competences`, `/mes-activites` ; `/mes-resultats` et évaluations conservés.
- Responsable : `/responsable`, avec files distinctes de contenus à approuver et de décisions sur les personnes.

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `npm run lint` | Réussi |
| `npm run typecheck` | Réussi |
| `npm run test` | Réussi : API 106 tests / 16 fichiers, web 9 tests / 2 fichiers |
| `npm run test:int -w @tesla/api` avec URL dédiée à `tesla_test` | Réussi : 61 tests / 5 fichiers, dont 14 scénarios phase 4 |
| Intégration ciblée après le correctif du compte rendu | Réussi : les 14 scénarios phase 4 rejoués ; date prévue inchangée acceptée après réalisation, changement refusé |
| `npm run build` | Shared et API compilés ; web Turbopack bloqué par l'environnement (`binding to a port: Operation not permitted`), y compris après demande d'exécution hors bac à sable |
| `npm run build -w @tesla/web -- --webpack` | Réussi : compilation, types et génération des 60 pages |
| `npm run build -w @tesla/api` après les derniers correctifs | Réussi |
| Migrations locales et diff Prisma/base | Sept migrations synchronisées, diff vide |
| `git diff --check` | Réussi |
| Recette Chromium à 390 px, données fictives sur `tesla_test` | 19 contrôles réussis ; aucune erreur JavaScript ni débordement horizontal sur les écrans contrôlés |

Les tests couvrent notamment : profil sans compte, historique et correction d'étape, concurrence transactionnelle, conservation après changement d'équipe/rattachement, preuves concernant le même routier, propositions/compléments/décisions/révocations, refus de décision aux chefs, absence d'acquis automatique après quiz, étude papier et déclaration numérique, import idempotent et protection entre programmes, correspondances non confirmées, réalisation et report, présences sans doublon ni absence implicite, permissions et statistiques. Les formulaires attendent le rafraîchissement des données avant la notification de succès. Un compte rendu reste modifiable après réalisation lorsque la date prévue est inchangée. Les bornes de dates incluent toute la journée ; une acquisition ultérieure supprime le signal statistique « à retravailler » sans supprimer l'ancienne décision.

Recette navigateur exécutée avec un script temporaire hors dépôt, API et web de production locaux sur ports dédiés, comptes exclusivement fictifs : connexions des trois rôles ; tableau de bord responsable ; création d'activité, réalisation, présence d'un routier sans compte et compte rendu ; prévisualisation puis confirmation d'import ; écrans statistiques, compétences, validations et routiers ; tableau de bord chef ; progression, compétences et activités personnelles du routier. La recette a trouvé puis permis de corriger le refus d'un compte rendu après réalisation lorsque le formulaire renvoyait la date prévue inchangée. Les sélecteurs ont été adaptés aux titres h2 de l'interface existante.

## Restes et arbitrages

- Source officielle du programme 2026–2027 absente du dépôt : les séances restent à importer depuis le document approuvé. Aucune séance officielle inventée.
- Référentiel officiel des compétences, correspondances catégories/étapes, durées et conditions de passage à définir ou confirmer par le responsable. Aucune promotion automatique ni seuil de score inventé.
- Signal des deux dernières présences absentes provisoire (D74), sans conséquence automatique ; périmètre des chefs actuellement communautaire comme dans les phases précédentes.
- Pas de synchronisation hors ligne, de gestion structurée séparée des actions d'accompagnement à échéance ni d'écran de journal d'audit global. Les observations, justificatifs, propositions et historiques sont disponibles.
- Safari/iOS, Android réel, lecteur d'écran et audit WCAG complet non testés. CI distante et audit de dépendances non exécutés.
- Avertissement `pg` de requêtes concurrentes connu : aucune défaillance constatée dans les tests.

## Fichiers concernés

Liste de l'ensemble des modifications de phase 4 présentes à la livraison, y compris celles reprises au début de cette intervention. Les chemins sont relatifs au dépôt ; le fichier d'historique pédagogique supprimé est remplacé par le dossier pédagogique à onglets.

- `CHANGELOG.md`
- `apps/api/prisma/migrations/20261031090000_progression_programme_activities/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/permissions.ts`
- `apps/api/src/modules/dashboards/dashboards.controller.ts`
- `apps/api/src/modules/dashboards/dashboards.module.ts`
- `apps/api/src/modules/dashboards/dashboards.service.ts`
- `apps/api/src/modules/programmes/activities.service.ts`
- `apps/api/src/modules/programmes/activity-common.ts`
- `apps/api/src/modules/programmes/programmes.controller.ts`
- `apps/api/src/modules/programmes/programmes.module.ts`
- `apps/api/src/modules/programmes/programmes.service.ts`
- `apps/api/src/modules/progression/competencies.service.ts`
- `apps/api/src/modules/progression/competency-proposals.service.ts`
- `apps/api/src/modules/progression/progression-common.ts`
- `apps/api/src/modules/progression/progression-contracts.spec.ts`
- `apps/api/src/modules/progression/progression.controller.ts`
- `apps/api/src/modules/progression/progression.module.ts`
- `apps/api/src/modules/progression/scout-progression.service.ts`
- `apps/api/src/modules/scouts/scout-profiles.service.ts`
- `apps/api/test/http-routes.int-spec.ts`
- `apps/api/test/int-database.ts`
- `apps/api/test/progression.int-spec.ts`
- `apps/web/src/app/(espaces)/administration/activites/[id]/page.tsx`
- `apps/web/src/app/(espaces)/administration/activites/page.tsx`
- `apps/web/src/app/(espaces)/administration/competences/competencies-admin.tsx`
- `apps/web/src/app/(espaces)/administration/competences/page.tsx`
- `apps/web/src/app/(espaces)/administration/presences/page.tsx`
- `apps/web/src/app/(espaces)/administration/programme-annuel/page.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/competencies-section.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/pedagogical-file.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/pedagogical-history.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/scout-profile.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/stage-section.tsx`
- `apps/web/src/app/(espaces)/administration/routiers/[id]/studies-section.tsx`
- `apps/web/src/app/(espaces)/administration/statistiques/page.tsx`
- `apps/web/src/app/(espaces)/administration/validations/[id]/page.tsx`
- `apps/web/src/app/(espaces)/administration/validations/[id]/proposal-detail.tsx`
- `apps/web/src/app/(espaces)/administration/validations/nouvelle/new-proposal.tsx`
- `apps/web/src/app/(espaces)/administration/validations/nouvelle/page.tsx`
- `apps/web/src/app/(espaces)/administration/validations/page.tsx`
- `apps/web/src/app/(espaces)/administration/validations/proposal-list.tsx`
- `apps/web/src/app/(espaces)/administration/validations/validations-board.tsx`
- `apps/web/src/app/(espaces)/chef/page.tsx`
- `apps/web/src/app/(espaces)/mes-activites/layout.tsx`
- `apps/web/src/app/(espaces)/mes-activites/page.tsx`
- `apps/web/src/app/(espaces)/mes-competences/layout.tsx`
- `apps/web/src/app/(espaces)/mes-competences/page.tsx`
- `apps/web/src/app/(espaces)/progression/layout.tsx`
- `apps/web/src/app/(espaces)/progression/page.tsx`
- `apps/web/src/app/(espaces)/responsable/page.tsx`
- `apps/web/src/app/(espaces)/routier/page.tsx`
- `apps/web/src/components/activities/activity-detail.tsx`
- `apps/web/src/components/activities/activity-list.tsx`
- `apps/web/src/components/activities/annual-programme.tsx`
- `apps/web/src/components/progression/evidence-picker.tsx`
- `apps/web/src/components/progression/my-path.tsx`
- `apps/web/src/components/progression/pedagogy-dashboard.tsx`
- `apps/web/src/components/progression/statistics-board.tsx`
- `apps/web/src/components/progression/status-badges.tsx`
- `apps/web/src/components/progression/tabs.tsx`
- `apps/web/src/components/progression/use-pedagogy-action.ts`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/dashboards.ts`
- `apps/web/src/lib/api/programmes.ts`
- `apps/web/src/lib/api/progression.ts`
- `apps/web/src/lib/api/scouts.ts`
- `apps/web/src/lib/spaces.ts`
- `apps/web/src/proxy.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`
- `docs/DATABASE.md`
- `docs/DECISIONS.md`
- `docs/FEATURES/COMPETENCES.md`
- `docs/FEATURES/DASHBOARDS.md`
- `docs/FEATURES/PHASE_4_REPORT.md`
- `docs/FEATURES/PROGRAMME_ANNUEL.md`
- `docs/FEATURES/PROGRESSION.md`
- `docs/FEATURES/SUIVI_ACTIVITES.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/ROADMAP.md`
- `packages/shared/src/dashboards.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/programmes.ts`
- `packages/shared/src/progression.ts`
