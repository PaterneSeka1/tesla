# Plan de refonte UI/UX

Branche `feat/refonte-ui-ux-tesla` (depuis `main` 0e28d59). Travail local uniquement : aucun déploiement, aucune base distante. Mise à jour : 2026-11-03.

Principe retenu : **consolider plutôt que réécrire**. L'audit ([UI_UX_AUDIT.md](UI_UX_AUDIT.md)) montre un socle cohérent (accueil, bibliothèque, lecture, routiers, évaluations) et des écarts concentrés dans cinq fichiers. Les écrans qui fonctionnent bien ne sont pas réécrits (CLAUDE.md : « ne jamais réécrire inutilement du code fonctionnel »).

## Réalisé dans cette branche

| Phase de la mission | Réalisé | Fichiers principaux |
|---|---|---|
| 0. Environnement | Base `tesla_local` distincte (même conteneur local, port 5433) ; migrations, seed, données fictives créées via l'API (encadrement, 3 équipes, 15 activités, présences) ; 3 modules publiés par `pedagogy:release` (sans `--notes-verifiees`) | aucun fichier du dépôt |
| 1. Audit | 68 routes, doublons, comptages | `docs/UI_UX_AUDIT.md` |
| 2. Design system | `StatCard`, `ChartCard`, graphiques, `ProgressBar`, `Stepper`, `Disclosure`, `SearchInput`, jetons `--chart-*`, `formatMonth`, `formatBytes`, `useDebouncedValue`, `TableSkeleton` annoncé | `components/*`, `lib/*`, `globals.css` |
| 3. Navigation | Intertitres de rubrique (D169), « Compétences » au lieu de « Référentiel de compétences » | `lib/navigation.ts`, `components/layout/app-nav.tsx` |
| 4. Accueil | `Kpi` remplacé par `StatCard` ; contenu inchangé (déjà adapté aux permissions) | `components/progression/pedagogy-dashboard.tsx` |
| 5. Statistiques | Recharts (D169), 8 indicateurs, 5 graphiques avec tableau des valeurs, détail par équipe | `components/progression/statistics-board.tsx`, `components/charts/*` |
| 6. Programme annuel | Synthèse, calendrier mensuel, chronologie, filtre de statut, import et correspondance repliés | `components/activities/annual-programme.tsx`, `programme-calendar.tsx`, `lib/calendar.ts` |
| 6 bis. Activités et présences | Liste, détail et création alignés sur le design system | `components/activities/activity-list.tsx`, `activity-detail.tsx` |
| 9. Évaluations | Garde `beforeunload` pendant la passation ; `ProgressBar` partagé | `evaluations/[id]/passer/take-evaluation.tsx` |
| 10. Progression | Frise des étapes, cartes, états communs | `components/progression/my-path.tsx` |
| 11. Administration | Onglets accessibles (2 files d'approbation) ; titres d'onglet | `review-queue.tsx`, `evaluations-admin.tsx`, `administration/*/layout.tsx` |
| 8. Édition des cours | Confirmation avant retrait d'une ressource ou d'un collaborateur | `resources-panel.tsx`, `collaborators-panel.tsx` |
| 12. Cet appareil | `ConfirmDialog` au lieu de `window.confirm`, volumétrie lisible (Mo/Go) ; avertissements de sécurité conservés | `components/offline/device-panel.tsx` |

## Restant, par priorité

### P1
- Aucun P1 connu restant dans l'audit.
- **À arbitrer** : règle d'accès de `/administration/equipes` (`scout.read` côté web, `team.read` dans le menu). Modifier une règle d'accès sort du périmètre UI.

### P2 — en un point
- `CardTitle` en titre HTML : décider la balise par défaut (impact sur 94 usages et la hiérarchie de titres).
- `PageHeading` avec emplacements `badges` et `actions` (14 h1 recopiés).
- `SearchInput` et `useDebouncedValue` dans les 12 autres recherches.
- `CommentDialog` déplacé dans `components/` et utilisé par les 9 dialogues de motif faits main.
- Badges Actif/Désactivé, Active/Archivée, Avec/Sans compte dans `status-badges.tsx`.
- Primitive `Checkbox` (11 cases natives, aujourd'hui `accent-tesla-rouge` sur les écrans refondus).

### P2 — ponctuel
- `window.confirm` restants : `user-menu.tsx`, `device-status.tsx`, `offline-attempt.tsx`.
- `evaluations-admin.tsx` : h2 avant le h1 de la page.
- Sélecteurs `role="radio"` de `paper-preparation.tsx` : navigation aux flèches.
- Accessibilité des écrans de succès (inscription, mot de passe oublié) : h1 conservé, `role="status"`.
- Présences : action « Marquer tous présents ». **Règle métier à confirmer** (ne pas écraser une saisie existante, ne pas confondre « non renseigné » et « présent »).
- Cartes KPI restantes (`staff-overview`, `evaluation-results`, `pathway-summary`) vers `StatCard`, si leur forme le permet.

## Changements nécessitant le backend

Aucun, hors la mise en page du PDF de la fiche médicale (`apps/api/src/modules/medical/medical-pdf.ts`, D170). Tous les écrans refondus utilisent les contrats existants (`GET /statistics`, `GET /activities`, `GET /programmes`, `GET /me/progression`, `GET /me/activities`). Pistes, non requises :
- `GET /activities` limité à 100 par page : un programme de plus de 100 séances afficherait un avertissement (déjà géré à l'écran).
- La recherche des activités porte sur le titre et le thème seulement (pas le responsable).
