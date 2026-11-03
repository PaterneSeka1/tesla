# Audit UI/UX — Nikola Tesla Académie

Date : 2026-11-03 · Branche `feat/refonte-ui-ux-tesla` (depuis `main` 0e28d59).

Ce document a deux parties :

1. **Suites données** (ci-dessous) : ce qui a été traité dans cette branche, ce qui a été écarté après vérification et ce qui reste à faire. Voir aussi [UI_UX_IMPLEMENTATION_PLAN.md](UI_UX_IMPLEMENTATION_PLAN.md).
2. **Audit par route** : lecture du code des 68 `page.tsx`. Les comptages viennent de `grep` au moment de l'audit, donc **avant** la refonte : les numéros de ligne cités renvoient à l'état initial.

## Suites données

| Constat de l'audit | Suite |
|---|---|
| Statistiques en lignes de texte, sans état soigné | **Traité** : indicateurs, cinq graphiques Recharts avec tableau des valeurs, filtres étiquetés, `QueryError`, titre d'onglet. |
| Programme annuel centré sur le champ d'import | **Traité** : synthèse (avancement, à venir, en retard, mois sans séance), calendrier mensuel, chronologie, import et correspondance repliés en bas de page. |
| Activités, présences et détail d'activité hors design system | **Traité** : `Pagination`, `SearchInput` avec temporisation, `formatDate`, `BackLink`, champs étiquetés, création dans un dialogue validé par Zod (React Hook Form), compteurs de présences, historique daté. Logique des formulaires inchangée. |
| `my-path` (progression, compétences, mes activités) hors design system | **Traité** : frise des étapes (`Stepper`), cartes, `EmptyState`, `QueryError` (titre conservé en cas d'erreur), dates formatées. |
| Retrait d'une ressource ou d'un collaborateur sans confirmation (P1) | **Traité** : `ConfirmDialog`. |
| Passation : aucune garde avant de quitter la page avec une réponse non enregistrée (P1) | **Traité** : `beforeunload` tant qu'une réponse n'est pas enregistrée. |
| Passation : « ne pas changer de question si l'enregistrement échoue » | **Écarté** : toutes les réponses restent en mémoire et le prochain enregistrement les renvoie en entier ; bloquer la navigation immobiliserait un routier dont le réseau tombe. |
| `/hors-ligne` : le bouton mène à `/connexion` | **Écarté** : `/connexion` fait partie des pages toujours en cache du service worker (`SHELL_URLS`, `public/sw.js`) ; `/accueil` peut ne pas être préparée sur l'appareil. |
| 4 formes de cartes KPI | **Partiel** : `StatCard` partagé (accueil, statistiques, programme) ; `staff-overview`, `evaluation-results` et `pathway-summary` gardent leur forme. |
| Onglets faits main sans clavier (2) | **Traité** : `Tabs` dans `review-queue` et `evaluations-admin`. |
| 3 `window.confirm` dans « Cet appareil » | **Traité** : `ConfirmDialog`. Restent `user-menu.tsx`, `device-status.tsx`, `offline-attempt.tsx`. |
| `TableSkeleton` non annoncé (61 usages) | **Traité en un point** : `role="status"` et texte masqué « Chargement… ». |
| Pages héritant du titre d'onglet « Suivi et validation » | **Traité** : `metadata` pour activités, présences, programme, statistiques, référentiels, équipes, routiers, compétences, acquis, déblocages. |
| Recherche : une requête par frappe (`useDeferredValue`) | **Partiel** : `useDebouncedValue` (300 ms) sur la liste des activités ; les 12 autres recherches sont inchangées. |
| `/administration/equipes` ouverte avec `scout.read`, menu exigeant `team.read` | **Non traité, à arbitrer** : modifie une règle d'accès (même côté web). |
| `CardTitle` rendu en `div` (94 usages) | **Non traité** : changer la balise par défaut modifierait la hiérarchie de titres de tous les écrans ; les nouveaux écrans placent un `h2` dans `CardTitle`. |
| Dialogues de motif faits main, badges en ligne, h1 recopiés, `role="radio"` sur des boutons | **Non traité** (P2), voir le plan. |

---

## Audit par route

Audit en lecture seule, réalisé avant toute modification. Chemins relatifs à `apps/web/src`.
Chemins relatifs à `apps/web/src`. Permissions : règle `ACCESS_RULES` (`lib/navigation.ts:54-85`) au préfixe le plus long ; « session » = aucune permission requise hors connexion.

Méthode : lecture des 68 `page.tsx`, puis greps par motif sur les composants (comptages bruts en fin de document), lecture ciblée des zones signalées. Ce qui n'a pas été vérifié : rendu réel à 360 px, contraste mesuré, lecteur d'écran, clavier en navigateur — les constats responsive et a11y viennent du code.

Constat général : le socle est cohérent (61 `TableSkeleton`, `QueryError` et `EmptyState` largement utilisés, `components/ui/table.tsx` encapsule `overflow-x-auto` et toutes les tables masquent des colonnes avec `hidden sm|md|lg:table-cell`, boutons icône tous étiquetés, aucune couleur Tailwind brute hors `ui/badge` et `ui/toaster`). **Aucun P0 (blocage fonctionnel ou d'accès) constaté.** Les écarts se concentrent dans 5 fichiers écrits hors design system : `components/activities/{activity-list,activity-detail,annual-programme}.tsx`, `components/progression/{statistics-board,my-path}.tsx`.

Priorités : P0 bloquant / perte d'accès ; P1 perte de données possible, action destructive sans garde, écran hors design system ; P2 cohérence, a11y secondaire, factorisation.

---

## A. Public et authentification

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | publique (hors règles) | RAS (h1 l.90, icônes `aria-hidden`, grilles `sm:`/`lg:`). | — | RAS |
| `/connexion` | `app/connexion/page.tsx`, `app/connexion/login-form.tsx` | publique | RAS (`FormField`, `autoComplete`, erreur `aria-live`, squelette Suspense). | — | RAS |
| `/mot-de-passe-oublie` | `app/mot-de-passe-oublie/forgot-password-form.tsx` | publique | L'état de succès (l.34-50) remplace le formulaire sans h1 et sans région live : le message « Demande reçue » n'est pas annoncé et la page perd son titre. | P2 | Garder le h1 dans les deux états ; mettre `role="status"` sur l'`Alert` de succès. |
| `/inscription` | `components/auth/account-credential-flow.tsx` (purpose ACTIVATION) | publique | Succès (l.113-127) sans h1 ni région live ; squelette l.111 avec `aria-label` sur une `div` sans rôle (non annoncé). | P2 | Même correctif ; `role="status"` sur le squelette. |
| `/reinitialiser-mot-de-passe` | `components/auth/account-credential-flow.tsx` (REINITIALISATION) | publique | Mêmes constats que `/inscription`. | P2 | Idem. |
| `/activation` | `app/activation/activation-form.tsx` | publique | Pas de h1 ; `Skeleton aria-label` sans rôle (l.30). Page de redirection héritée, peu visitée. | P2 | `role="status"` et texte `sr-only`. |
| `/hors-ligne` | `app/hors-ligne/page.tsx` | publique (coquille hors ligne) | Le bouton « Tableau de bord » pointe vers `/connexion` et non vers l'accueil (`HOME_ROUTE` = `/accueil`) : le libellé ne correspond pas à la cible. | P2 | `href={HOME_ROUTE}` ou libellé « Se connecter ». |

## B. Navigation (layout, app-nav, dashboard-shell, user-menu, device-status)

| Élément | Composant | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| Layout connecté | `app/(espaces)/layout.tsx` → `components/layout/dashboard-shell.tsx` | session (`SessionGate`) | RAS : lien d'évitement « Aller au contenu », `main#contenu`, sidebar `lg:`, en-tête mobile, espace sous la barre basse. Sur mobile, le titre apparaît deux fois (`CurrentPageTitle` en `<p>` dans l'en-tête, `app-nav.tsx:153`, puis h1 de la page) : choix assumé, à confirmer. | — | RAS |
| Menu | `components/layout/app-nav.tsx` | `navigationFor` | RAS : `nav aria-label`, `aria-current="page"`, déclencheur mobile `aria-label` à 44 px (l.165-166), Dialog Radix avec titre et description. Barre basse routier `grid-cols-5` (l.222) : 72 px par onglet à 360 px, suffisant. | — | RAS |
| Menu utilisateur | `components/auth/user-menu.tsx` | session | Déconnexion avec données non synchronisées confirmée par `window.confirm` natif (l.31) : rendu hors charte, non stylable, bloquant sur certains navigateurs PWA. | P2 | `ConfirmDialog` (déjà en place : `components/confirm-dialog.tsx`). |
| Statut appareil | `components/offline/device-status.tsx` | session | `role="status"` posé sur un conteneur qui contient un lien et un bouton (l.46) : chaque changement relit tout le bloc. Mise à jour avec modifications en attente confirmée par `window.confirm` (l.66). | P2 | Restreindre `role="status"` au texte ; `ConfirmDialog`. |

## C. Accueil

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/accueil` | `components/home-dashboard.tsx` → `components/progression/pedagogy-dashboard.tsx`, `components/pathway/staff-dashboard.tsx`, `components/progression/staff-overview.tsx`, `components/pathway/pathway-overview.tsx` | session | Fonctionnellement RAS (états gérés, squelette dédié l.243-257, `EmptyState`). Points de cohérence : 1) `Kpi` local (`pedagogy-dashboard.tsx:60`) recopié ailleurs sous d'autres formes (voir doublons) ; 2) `SectionTitle` (l.261) est un h2 `text-sm text-muted-foreground`, plus discret que les `CardTitle` qu'il introduit (hiérarchie visuelle inversée) ; 3) les titres de cartes (`CardTitle`) ne sont pas des titres HTML (voir transverse n°1). | P2 | Sortir `Kpi` dans `components/kpi-card.tsx` ; corriger `CardTitle` une fois pour toutes. |

## D. Routiers et équipes

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/administration/routiers` | `app/(espaces)/administration/routiers/scout-list.tsx` | `scout.read` | RAS fonctionnel (table progressive, `Pagination`, `EmptyState`). En dessous de `sm`, le statut Actif/Désactivé est masqué (l.208, l.236) alors que c'est l'information de tri principale. Barre de recherche recopiée (l.105-123). | P2 | Afficher le statut sous le nom sur mobile ; `SearchField` partagé. |
| `/administration/routiers/nouveau` | `.../routiers/nouveau/new-scout.tsx` + `scout-form.tsx` | `scout.read` + `RequirePermission scout.create` | RAS. | — | RAS |
| `/administration/routiers/[id]` | `.../routiers/[id]/scout-profile.tsx` (+ `pathway-section`, `pedagogical-file`, `stage-section`, `studies-section`, `competencies-section`, `observations-section`, `team-history`, `scout-actions`) | `scout.read` | RAS fonctionnel (`BackLink`, `Tabs` accessibles, `CommentDialog` pour les révocations). h1 recopié à la main (l.44) avec les classes de `PageHeading` ; badges Actif/Avec compte recopiés de `scout-list.tsx:231-240` (l.48-56). | P2 | `PageHeading` avec emplacement `actions`/`meta` ; `ScoutStatusBadges`. |
| `/administration/routiers/[id]/modifier` | `.../[id]/modifier/edit-scout.tsx` | `scout.read` + `RequirePermission scout.update` | RAS. | — | RAS |
| `/administration/equipes` | `.../equipes/team-list.tsx` | **`scout.read`** (règle `/administration`, aucune règle propre) alors que le menu exige `team.read` (`navigation.ts:172`) | Écart règle ↔ menu : avec `scout.read` sans `team.read`, la page s'ouvre puis l'API échoue. Badges Active/Archivée en dur (l.145-147). | P2 | Ajouter `{ path: '/administration/equipes', anyOf: ['team.read'] }` (à valider avec la matrice API). |
| `/administration/equipes/nouvelle` | `.../equipes/nouvelle/new-team.tsx` | `scout.read` + `RequirePermission team.manage` | RAS. | — | RAS |
| `/administration/equipes/[id]` | `.../equipes/[id]/team-detail.tsx` | `scout.read` | RAS (archivage sous `ConfirmDialog` l.91). h1 recopié (l.70), badges recopiés (l.74-76). | P2 | Comme la fiche routier. |

## E. Pédagogie (cours)

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/modules` | `app/(espaces)/modules/catalog.tsx` | `module.read` | RAS (recherche libellée, `Pagination`, `EmptyState`). | — | RAS |
| `/modules/[slug]` | `.../modules/[slug]/module-detail.tsx` | `module.read` | RAS fonctionnel. La même chaîne de classes `border-tesla-sable bg-transparent text-white hover:bg-white/10` est répétée trois fois (l.100, 110, 121) : variante de bouton manquante. | P2 | Variante `Button variant="onBrand"` dans `components/ui/button.tsx`. |
| `/modules/[slug]/lecons/[id]` | `.../lecons/[id]/lesson-reader.tsx` | `module.read` | RAS. | — | RAS |
| `/modules/[slug]/imprimer` | `.../imprimer/printable-module.tsx` | `module.read` | RAS. | — | RAS |
| `/encadrement/modules` | `components/modules/editor-module-list.tsx` | `module.write` | RAS (barre de recherche recopiée). | — | RAS |
| `/encadrement/modules/nouveau` | `.../modules/nouveau/new-module.tsx` | `module.write` | RAS. | — | RAS |
| `/encadrement/modules/[id]/modifier` | `.../modifier/module-editor.tsx` + `resources-panel.tsx`, `collaborators-panel.tsx`, `lessons-panel.tsx`, `texts-panel.tsx` | `module.write` | **Suppression sans confirmation** : retrait d'une ressource (fichier R2), bouton icône `resources-panel.tsx:136-147` ; retrait d'un collaborateur, `collaborators-panel.tsx:47-60`. La suppression d'une leçon (`lessons-panel.tsx:349`) et d'une question est, elle, confirmée. Garde « modifications non enregistrées » présente seulement pour les leçons (`lessons-panel.tsx:40`), pas pour les métadonnées. | P1 | Envelopper les deux actions dans `ConfirmDialog destructive`. |
| `/encadrement/modules/[id]/apercu` | `.../apercu/module-preview.tsx` → `components/modules/module-version-view.tsx` | `module.write` | Pas de h1 : le titre du module est un `h3` (`module-version-view.tsx:29`), donc les niveaux 1 et 2 sont sautés. | P2 | Prop `headingLevel` sur `ModuleVersionView` ou h1 dans l'aperçu. |
| `/encadrement/soumissions` | `.../soumissions/submissions.tsx` | `module.write` | RAS. | — | RAS |
| `/administration/modules-a-valider` | `.../modules-a-valider/review-queue.tsx` | `module.review` | Onglets refaits à la main (l.39-52) : `role="tab"` sans flèches clavier, sans `aria-controls` ni `tabIndex` itinérant, alors que `components/progression/tabs.tsx` les gère. | P2 | Réutiliser `Tabs`. |
| `/administration/modules` | `.../modules/modules-overview.tsx` → `EditorModuleList review` | `module.review` | RAS. | — | RAS |
| `/administration/modules/[id]/revision` | `.../revision/module-revision.tsx` | `module.review` | RAS (`CommentDialog` pour les décisions). h1 recopié (l.69). | — | RAS |
| `/administration/historique-publications` | `.../historique-publications/publication-history.tsx` | `module.review` | RAS. | — | RAS |

## F. Évaluations

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/evaluations` | `app/(espaces)/evaluations/available-evaluations.tsx` | `evaluation.take` | RAS. | — | RAS |
| `/evaluations/[id]` | `.../evaluations/[id]/evaluation-intro.tsx` | `evaluation.take` | RAS (h1 recopié l.64 ; vide inline l.169 acceptable). | — | RAS |
| `/evaluations/[id]/passer` | `.../passer/pass-evaluation.tsx` → `take-evaluation.tsx` | `evaluation.take` | **Perte de réponses possible** : l'état `dirty` existe (l.121-133) mais aucun `beforeunload` ni garde de navigation. Fermer l'onglet ou cliquer dans le menu perd la réponse en cours. `goTo` (l.136-139) change de question même si `persist()` échoue (le toast d'erreur s'affiche mais l'utilisateur avance). | P1 | Garde `beforeunload` quand `dirty` (même motif que `lessons-panel.tsx:40`) ; ne pas changer de question si `persist()` renvoie `false`. |
| `/evaluations/[id]/jeu` | `PassEvaluation variant="paliers"` → `components/evaluations/palier-game.tsx` | `evaluation.take` | Même absence de garde de sortie (même session de passation). | P1 | Idem. |
| `/evaluations/[id]/preparer` | `.../preparer/prepare-evaluation.tsx` | `evaluation.take` | RAS. | — | RAS |
| `/encadrement/evaluations` | `components/evaluations/evaluation-list.tsx` | `evaluation.write` | RAS. | — | RAS |
| `/encadrement/evaluations/nouvelle` | `.../nouvelle/new-evaluation.tsx` | `evaluation.write` | RAS. | — | RAS |
| `/encadrement/evaluations/[id]/modifier` | `.../modifier/evaluation-editor.tsx` + `components/evaluations/question-form.tsx` | `evaluation.write` | RAS fonctionnel (boutons icône étiquetés l.239-269, suppression confirmée l.282). Aucune garde « modifications non enregistrées » sur le formulaire de question. | P2 | `beforeunload` sur `isDirty`. |
| `/encadrement/evaluations/[id]/apercu` | `.../apercu/evaluation-preview.tsx` | `evaluation.write` | RAS. | — | RAS |
| `/encadrement/evaluations/[id]/resultats` | `.../resultats/evaluation-results.tsx` | `evaluation.write` | RAS fonctionnel. Troisième version des cartes KPI (`dl` des faits, l.77-85). | P2 | `KpiCard` partagé. |
| `/encadrement/evaluations/papier` | `.../papier/paper-preparation.tsx` | `attempt.preparePaper` | Sélecteurs faits de `<button role="radio">` (l.151, l.211) dans un `radiogroup` sans flèches clavier ni `tabIndex` itinérant : il faut une tabulation par routier (25 arrêts). | P2 | Vrais `<input type="radio">` stylés, ou roving tabindex. |
| `/encadrement/evaluations/papier/[code]` | `.../papier/[code]/paper-attempt.tsx` → `components/evaluations/correction-workspace.tsx` | `attempt.preparePaper` | RAS fonctionnel. Trois `ConfirmDialog` avec `Textarea` de motif faits main alors que `components/modules/comment-dialog.tsx` existe. | P2 | `CommentDialog`. |
| `/encadrement/corrections` | `.../corrections/correction-queue.tsx` | `attempt.record` | RAS. | — | RAS |
| `/encadrement/corrections/[code]` | `.../corrections/[code]/correction-copy.tsx` → `correction-workspace.tsx` | `attempt.record` | Comme `/papier/[code]`. | P2 | `CommentDialog`. |
| `/encadrement/distribution/[slug]` | `.../distribution/[slug]/distribution.tsx` | `attempt.preparePaper` | RAS (« Tout sélectionner », cibles `min-h-11`, `aria-live` l.454). | — | RAS |
| `/administration/evaluations` | `.../administration/evaluations/evaluations-admin.tsx` | `evaluation.review` | 1) Ordre des titres inversé : un h2 stylé comme un h1 (l.37-42) précède le h1 du `PageHeading` d'`EvaluationList` en dessous. 2) Onglets faits main (l.43-56), comme `review-queue`. 3) État vide en paragraphe (l.63-67) au lieu d'`EmptyState`. | P2 | `PageHeading` en tête, `Tabs`, `EmptyState`. |
| `/administration/evaluations/[id]` | `.../evaluations/[id]/evaluation-revision.tsx` | `evaluation.review` | RAS. | — | RAS |
| `/administration/evaluations-a-valider` | `.../evaluations-a-valider/result-review-queue.tsx` | `attempt.decide` | RAS. | — | RAS |
| `/administration/evaluations-a-valider/[id]` | `.../evaluations-a-valider/[id]/result-review.tsx` | `attempt.decide` | RAS. | — | RAS |
| `/administration/deblocages` | `.../deblocages/waivers.tsx` | `waiver.manage` | RAS (révocation via `CommentDialog`). | — | RAS |

## G. Organisation (programme, activités, présences, statistiques, référentiels)

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/administration/programme-annuel` | `components/activities/annual-programme.tsx` | `scout.read` (règle `/administration` ; menu `scout.read`) | Hors design system : chargement en texte brut (l.41) ; erreurs ad hoc sans « Réessayer » (l.42, l.147) ; vide en paragraphe (l.43) ; `<label>` brut avec `aria-label` redondant (l.44-48) ; 4 surcharges `rounded border p-2` sur les champs ; case à cocher native (l.181-187). Pas de `metadata`, donc l'onglet du navigateur affiche « Suivi et validation ». | P1 | `TableSkeleton`, `QueryError`, `EmptyState`, `FormField`, `export const metadata`. |
| `/administration/activites` | `components/activities/activity-list.tsx` | `activity.read` | Chargement texte (l.80) ; erreur ad hoc avec `<button>` brut (l.81-88) ; vide en paragraphe (l.107) ; **pagination refaite** (l.108-120, taille 20 codée en dur) alors que `components/pagination.tsx` est utilisé sur 15 écrans ; date ISO brute `item.plannedOn` (l.101) ; cartes `rounded border` sans `Card` ; formulaire en `FormData` avec `<label>` bruts et 6 surcharges de classes (l.160-185) au lieu de `FormField` + React Hook Form. Pas de `metadata`. | P1 | Aligner sur `team-list.tsx` (même structure) : `Pagination`, `formatDate`, `Card`, `FormField`. |
| `/administration/activites/[id]` | `components/activities/activity-detail.tsx` | `activity.read` | Chargement texte (l.118, l.392) ; erreur ad hoc (l.121-125) ; **pas de `BackLink`** ; `PageHeading.description` sert à afficher la date ISO brute (l.134), contrairement à D108 ; dates brutes (l.134, l.400) ; 13 `<label>` bruts, 9 surcharges `rounded border p-2` ; saisie des présences en 25 `NativeSelect` sans action groupée « tous présents » (l.49-85). Pas de `metadata`. | P1 | `BackLink`, `formatDate`, `FormField` ; bouton « Marquer tous présents » (règle métier à confirmer : ne pas écraser une saisie existante). |
| `/administration/presences` | `components/activities/activity-list.tsx` (`presences`) | `attendance.record` | Mêmes constats que `/administration/activites`. | P1 | Idem. |
| `/administration/statistiques` | `components/progression/statistics-board.tsx` | `statistics.read` | Chargement texte (l.85) ; erreur sans réessai (l.87) ; indicateurs en lignes de texte (l.91-108) alors que `pedagogy-dashboard.tsx` a déjà `Kpi` (l.60) et `Distribution` (l.196) ; mois bruts « AAAA-MM » (l.144) ; vides en paragraphe (l.112, l.141) ; 4 `<label>` bruts autour des filtres de dates. Pas de `metadata`. | P1 | Réutiliser `Kpi` et `Distribution` une fois factorisés ; `QueryError` ; formatage du mois. |
| `/administration/validations` | `.../validations/validations-board.tsx` + `proposal-list.tsx` | `competency.read` | RAS. | — | RAS |
| `/administration/validations/nouvelle` | `.../validations/nouvelle/new-proposal.tsx` | `competency.read` | RAS. | — | RAS |
| `/administration/validations/[id]` | `.../validations/[id]/proposal-detail.tsx` | `competency.read` | RAS (refus et retrait via dialogues). | — | RAS |
| `/administration/competences` | `.../competences/competencies-admin.tsx` | `competency.read` | RAS (une case native l.211, vide inline l.205 acceptable). | — | RAS |
| `/administration/referentiel-age` | `components/pathway/age-rules-view.tsx` | `ageRules.read` | RAS. Pas de `metadata` (onglet « Suivi et validation »). | P2 | `export const metadata`. |
| `/communaute` | `components/leadership/community-leadership.tsx` | session (menu : `leadership.manage` ou `hiddenWith`) | RAS fonctionnel. Fin de fonction : `ConfirmDialog` + `Textarea` faits main (l.272-289) au lieu de `CommentDialog`. | P2 | `CommentDialog`. |

## H. Parcours individuel

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/progression` | `components/progression/my-path.tsx` (`MyPath`) + `components/pathway/my-pathway.tsx` (`MyPathwayOverview`) | `progression.readOwn` | `MyPath` est hors design system : chargement texte (l.23) ; erreur ad hoc avec `<button>` brut (l.24-31) **et sans h1** (la page perd son titre en cas d'erreur) ; listes en `<p>` successifs sans `Card` ni `EmptyState` (l.44-90) ; date via `toLocaleDateString` (l.50) au lieu de `formatDate`. `MyPathwayOverview` est aussi affiché sur `/accueil` (`home-dashboard.tsx`) : contenu en double. | P1 | Refaire la présentation avec `Card`, `EmptyState`, `QueryError` (sans changer la logique) ; garder `PageHeading` hors des branches d'état. |
| `/mes-competences` | `MyPath competenciesOnly` | `progression.readOwn` | Mêmes constats que `/progression` (même composant). | P1 | Idem. |
| `/mes-activites` | `MyActivities` (`components/progression/my-path.tsx:130`) | `progression.readOwn` | Chargement et erreur ad hoc (l.134-135) ; dates ISO brutes (l.143, l.152) ; activités en `<p>` « date · titre · responsable » ; vides en paragraphe (l.140, l.149). | P1 | Liste en `Card`, `formatDate`, `EmptyState`. |
| `/mes-rattrapages` | `components/pathway/my-pathway.tsx` (`MyCatchUps`) → `catch-up-list.tsx` | `progression.readOwn` | RAS (`ConfirmDialog` + `Textarea` fait main). | P2 | `CommentDialog`. |
| `/mes-resultats` | `app/(espaces)/mes-resultats/my-results.tsx` | `progression.readOwn` | RAS. | — | RAS |

## I. Administration, profil, appareil

| Route | Composant principal | Permission | Problèmes constatés | Priorité | Solution proposée |
|---|---|---|---|---|---|
| `/administration` | `app/(espaces)/administration/page.tsx` (redirection vers `/administration/routiers`) | `scout.read` | RAS. Un administrateur sans `scout.read` ne passe pas par là (menu). | — | RAS |
| `/administration/comptes` | `components/accounts/accounts-admin.tsx` | `account.read` | RAS fonctionnel (colonne Actions `flex-wrap`). Quatre `ConfirmDialog` avec `Textarea` de motif faits main (désactivation, etc.), plus une table de badges locale `STATUS_BADGE` (l.52). | P2 | `CommentDialog` ; `AccountStatusBadge` dans `components/accounts/`. |
| `/compte` | `components/accounts/account-settings.tsx` + `medical-record-card.tsx` | session | RAS (suppression de la fiche médicale confirmée en deux temps, l.305-327). | — | RAS |
| `/appareil` | `components/offline/device-panel.tsx` | session | Trois `window.confirm` (l.280, l.366, l.378) pour des suppressions locales (images de module, version téléchargée, opérations) ; case native (l.484). | P2 | `ConfirmDialog destructive`. |

---

## 1) Composants dupliqués à factoriser

| Motif | Occurrences (chemins) | Cible proposée |
|---|---|---|
| **Cartes KPI** (4 formes) | `components/progression/pedagogy-dashboard.tsx:60` (`Kpi`, lien + icône) ; `components/progression/staff-overview.tsx:238` (gros chiffre `text-3xl`) ; `app/(espaces)/encadrement/evaluations/[id]/resultats/evaluation-results.tsx:77` (`dl` de faits `text-2xl`) ; `components/pathway/pathway-summary.tsx:64` (`Card` + `CardTitle text-2xl`) ; `components/progression/statistics-board.tsx:91-108` n'en a aucune (texte) | `components/kpi-card.tsx` (`label`, `value`, `hint?`, `icon?`, `href?`), plus `Distribution` sorti de `pedagogy-dashboard.tsx:196` |
| **Champ de recherche à icône** (`Label` + `Search` en absolu + `Input pl-9`) | 9 copies : `administration/routiers/scout-list.tsx:105`, `administration/equipes/team-list.tsx:64`, `administration/evaluations-a-valider/result-review-queue.tsx:40`, `encadrement/corrections/correction-queue.tsx:82`, `evaluations/available-evaluations.tsx:52`, `modules/catalog.tsx:75`, `components/accounts/accounts-admin.tsx:116`, `components/evaluations/evaluation-list.tsx:89`, `components/modules/editor-module-list.tsx:76` ; variantes sans icône dans `paper-preparation.tsx`, `competencies-admin.tsx`, `waivers.tsx`, `new-proposal.tsx` | `components/search-field.tsx` avec anti-rebond intégré (voir transverse n°4) |
| **Badges de statut en ligne** | Actif/Désactivé + Avec/Sans compte : `administration/routiers/scout-list.tsx:231-240`, `administration/routiers/[id]/scout-profile.tsx:48-56` ; Active/Archivée : `administration/equipes/team-list.tsx:145-147`, `administration/equipes/[id]/team-detail.tsx:74-76` ; Sans compte : `encadrement/distribution/[slug]/distribution.tsx:415` ; tables locales `STATUS_BADGE` (`components/accounts/accounts-admin.tsx:52`) et `STATUS_VARIANT` (`components/pathway/catch-up-list.tsx:24`) | Les ajouter à `components/progression/status-badges.tsx`, qui regroupe déjà 4 badges, à côté de `module-status-badge.tsx` et `attempt-status-badge.tsx` |
| **Dialogue de confirmation avec motif** | `ConfirmDialog` + `Textarea` faits main : `components/accounts/accounts-admin.tsx` (4), `components/evaluations/correction-workspace.tsx` (3), `components/leadership/community-leadership.tsx:272`, `components/pathway/catch-up-list.tsx` — alors que `components/modules/comment-dialog.tsx` sert déjà 22 dialogues dans 10 fichiers | `CommentDialog` (à déplacer dans `components/` puisqu'il ne concerne pas que les modules) |
| **Onglets** | `components/progression/tabs.tsx` (accessible : flèches, `aria-controls`, roving) contre deux copies sans clavier : `administration/modules-a-valider/review-queue.tsx:39`, `administration/evaluations/evaluations-admin.tsx:43` | `Tabs`, à déplacer dans `components/` |
| **En-tête de page avec actions** | 14 h1 recopiés avec les classes de `PageHeading` (`text-2xl font-semibold tracking-tight text-tesla-bordeaux`), dont `scout-profile.tsx:44`, `team-detail.tsx:70`, `module-editor.tsx:70`, `module-revision.tsx:69`, `evaluation-revision.tsx:55`, `evaluation-editor.tsx:104`, `evaluation-preview.tsx:33`, `evaluation-results.tsx:72`, `evaluation-intro.tsx:64`, `proposal-detail.tsx:48`, `lesson-reader.tsx:53`, `components/evaluations/copy-view.tsx:23` | Ajouter à `PageHeading` les props `eyebrow?`, `badges?`, `actions?` (la `description` reste réservée à D108) |
| **Pagination** | `components/activities/activity-list.tsx:108-120` (seule pagination faite main ; `Pagination` sert sur 15 écrans) | `components/pagination.tsx` |
| **Bouton sur fond de marque** | `app/(espaces)/modules/[slug]/module-detail.tsx:100, 110, 121` | Variante `onBrand` dans `components/ui/button.tsx` |

## 2) Les 10 problèmes transverses les plus fréquents (comptages par grep sur `app/` et `components/`, `*.tsx`)

| # | Problème | Nombre | Commande / motif | Priorité | Correctif |
|---|---|---|---|---|---|
| 1 | `CardTitle` rendu en `<div>` (`components/ui/card.tsx:21-27`) : aucun titre de section n'est un titre HTML, donc la navigation par titres au lecteur d'écran ne trouve rien | **94** usages | `grep -rn '<CardTitle'` | P2 (a11y, correctif en un point) | Rendre un `h2` par défaut, avec `asChild` ou `as` pour les cas imbriqués |
| 2 | Squelettes et chargements nommés par `aria-label` sur une `div` sans rôle (nom interdit sur un rôle générique en ARIA 1.2, non annoncé) | **61** `<TableSkeleton>` + 2 `<Skeleton aria-label>` | `grep -rn '<TableSkeleton'` ; `components/query-state.tsx:26` | P2 (correctif en un point) | `role="status"` + `<span className="sr-only">Chargement…</span>` dans `TableSkeleton` |
| 3 | `<label>` HTML bruts au lieu de `Label`/`FormField` (27 sur 39 dans les 5 fichiers activités/progression) | **39** | `grep -rn '<label'` | P2 | `FormField` (+ `fieldA11y`) |
| 4 | Surcharges de style ad hoc `rounded border p-2` sur `Input`/`NativeSelect`/`Textarea`, qui annulent `rounded-md`, `h-10` et le focus des primitives | **24** (uniquement `activity-detail` 9, `activity-list` 6, `annual-programme` 4, `statistics-board` 4, `my-path` 1) | `grep -rn 'rounded border p-2'` | P1 (dans le lot G/H) | Supprimer les surcharges |
| 5 | `useDeferredValue` utilisé comme anti-rebond de recherche : il ne retarde que le rendu, la clé de requête change à chaque frappe, donc une requête API par caractère | **13** appels (13 fichiers, toutes les barres de recherche) | `grep -rn 'useDeferredValue('` | P2 (charge réseau mobile) | Anti-rebond de 250-300 ms dans un `useDebouncedValue` partagé, intégré à `SearchField` |
| 6 | Badges de statut écrits en ligne au lieu d'un composant de statut | **13** lignes | `grep -rnE '<Badge[^>]*>\s*(Actif|Désactivé|Archivée|Active|Avec compte|Sans compte)<'` | P2 | Voir doublons |
| 7 | Messages d'erreur `<p role="alert">` ad hoc : 8 sont des erreurs de requête qui devraient être des `QueryError` avec « Réessayer » (`activity-detail` l.121 et 391, `activity-list` l.82, `annual-programme` l.42 et 147, `statistics-board` l.87, `my-path` l.26 et 135) ; 5 sont des erreurs de formulaire ou de synchronisation légitimes | **13** (dont 8 à corriger) | `grep -rnE '<p role="alert">|role=\{attendance'` | P1 (lot G/H) | `QueryError` |
| 8 | Cases à cocher natives non stylées (pas de primitive `Checkbox` dans `components/ui/`) | **11** | `grep -rn 'type="checkbox"'` | P2 | Ajouter `components/ui/checkbox.tsx` (shadcn) ou une classe commune |
| 9 | Dates non formatées (ISO brute ou `toLocale*` au lieu de `formatDate`/`formatDateTime`, qui servent dans 39 fichiers) | **10** | `grep -rnE '\{[a-z]+\.(plannedOn|heldOn)\b|toLocaleDateString|toLocaleString\(.fr-FR.\)'` (hors octets, `pathway-summary` et l'utilitaire de `device-panel`) | P2 | `formatDate` |
| 10 | Dialogues de motif faits main (`ConfirmDialog` + `Textarea`) au lieu de `CommentDialog` | **9** dialogues dans 4 fichiers | Fichiers qui contiennent `<ConfirmDialog` et `<Textarea` | P2 | `CommentDialog` |

Hors top 10, comptés aussi :
- `window.confirm` natif : 6 (`user-menu.tsx:31`, `offline-attempt.tsx:69`, `device-status.tsx:66`, `device-panel.tsx:280, 366, 378`).
- Chargement en texte brut `role="status">Chargement…` : 7.
- h1 recopiés : 14.
- Recherches à icône recopiées : 9.
- Pages sans `metadata` propre qui héritent d'un titre faux (« Suivi et validation ») : 6 (`activites`, `activites/[id]`, `presences`, `programme-annuel`, `statistiques`, `referentiel-age`).
- Actions destructives sans confirmation : 2 (`resources-panel.tsx:136`, `collaborators-panel.tsx:47`).
- Onglets faits main : 2.
- `role="radio"` sur des `<button>` : 2.
- Couleurs Tailwind brutes : 4, toutes dans les primitives (`ui/badge.tsx:13` variante `success` en `emerald`, `ui/toaster.tsx:40,46`) ; un jeton `--success` serait plus propre.
- Hex codé en dur : 2 (`global-error.tsx:15`, où c'est justifié car les styles ne sont pas chargés ; `layout.tsx:17`, `themeColor` obligatoire).
- Boutons icône sans `aria-label` : 0 sur 12 `size="icon"`.
- Tableaux sans repli mobile : 0 sur 9 (tous dans `ui/table.tsx` avec `overflow-x-auto` et colonnes masquées).

## Ordre de traitement suggéré
1. P1 sûreté : confirmations `resources-panel` et `collaborators-panel` ; garde `beforeunload` et `persist` bloquant dans `take-evaluation.tsx` et le mode jeu.
2. P1 cohérence : remettre dans le design system les 5 fichiers `activities/*`, `statistics-board.tsx` et `my-path.tsx` (états, `Card`, `FormField`, `Pagination`, `formatDate`, `BackLink`, `metadata`).
3. P2 en un point : `CardTitle` en titre, `TableSkeleton` annoncé, `PageHeading` avec actions, `SearchField` avec anti-rebond, `KpiCard`, `Tabs` et `CommentDialog` déplacés dans `components/`.
4. P2 ponctuel : règle `/administration/equipes` → `team.read`, cible de `/hors-ligne`, `window.confirm` → `ConfirmDialog`.
