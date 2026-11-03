# Design system — Nikola Tesla Académie

Règles visuelles et composants partagés de `apps/web`. Complète `.claude/rules/frontend.md` et D108 (sobriété des textes). Mise à jour : 2026-11-03.

## 1. Identité

| Jeton (`app/globals.css`) | Valeur | Usage |
|---|---|---|
| `--tesla-bordeaux` / `primary` | `#510d12` | Titres de page, boutons principaux, sidebar, en-tête mobile |
| `--tesla-rouge` / `ring` | `#801e23` | Liens, focus, état actif, barres de progression |
| `--tesla-or` / `accent` | `#d9a45f` | Entrée active du menu, accents rares (jamais en aplat de texte) |
| `--tesla-sable` / `secondary` | `#f2e0c3` | Pastilles d'icône, fonds discrets, frise |
| `--tesla-fond` / `background` | `#fcf9f4` | Fond de page |
| `--muted-foreground` | `#6b5557` | Texte secondaire, libellés d'axe |
| `--destructive` | `#b42318` | Actions destructives, erreurs |

Pas de dégradés ni de couleurs décoratives supplémentaires. Les couleurs passent toujours par les jetons (`bg-primary`, `text-tesla-bordeaux`…), jamais par un hex dans un composant. Exception existante : la variante `success` du badge (`emerald`).

### Graphiques
Palette catégorielle en **ordre fixe** (`--chart-1` à `--chart-3`), validée par script : bande de luminance OKLCH, chroma ≥ 0,10, séparation ΔE en daltonisme (≥ 17,5), contraste ≥ 3:1 sur blanc.

| Jeton | Valeur | Série type |
|---|---|---|
| `--chart-1` | `#9b2a30` | Série unique ; « Présents » |
| `--chart-2` | `#c0862c` | « Excusés » |
| `--chart-3` | `#2a76b0` | « Absents » |
| `--chart-grid` | `#ece3d6` | Grille horizontale |

Au plus trois séries par graphique. Une couleur suit l'entité, jamais son rang.

## 2. Typographie et hiérarchie

| Niveau | Classes | Composant |
|---|---|---|
| Titre de page (h1) | `text-2xl font-semibold tracking-tight text-tesla-bordeaux` | `PageHeading` |
| Section de page (h2) | `text-lg font-semibold text-tesla-bordeaux` | titre direct de `section` |
| Titre de carte | `font-semibold` (`text-base`) | `CardTitle` contenant un `h2` ou un `h3` |
| Corps | `text-sm` à `text-base` | — |
| Secondaire, aide | `text-sm` ou `text-xs text-muted-foreground` | — |
| Intertitre de menu | `text-[0.6875rem] uppercase tracking-wide` | `NavItem.section` |

Police système (aucune police distante : build hors réseau, VPS léger). La description de `PageHeading` reste réservée aux règles qui préviennent une erreur (D108).

## 3. Composants partagés

| Composant | Fichier | Rôle |
|---|---|---|
| `PageHeading` | `components/page-heading.tsx` | Titre de page (h1) |
| `StatCard` | `components/stat-card.tsx` | Indicateur chiffré (lien facultatif). Remplace `Kpi` (accueil) |
| `ChartCard` | `components/charts/chart-card.tsx` | Cadre de graphique : titre, état vide propre, tableau « Voir les données » |
| `CategoryBarChart`, `SeriesLineChart` | `components/charts/charts.tsx` | Barres horizontales (une série) et courbes (≤ 3 séries), Recharts |
| `ProgressBar` | `components/progress-bar.tsx` | `role="progressbar"`, valeur bornée, `aria-valuetext` |
| `Stepper` | `components/stepper.tsx` | Parcours en étapes (vertical sur mobile, horizontal à partir de `sm`) |
| `ProgrammeCalendar`, `SessionList` | `components/activities/programme-calendar.tsx` | Calendrier mensuel et liste des séances |
| `Disclosure` | `components/disclosure.tsx` | Section secondaire repliable (`details` natif) |
| `SearchInput` | `components/search-input.tsx` | Champ de recherche étiqueté avec icône |
| `Tabs` | `components/progression/tabs.tsx` | Onglets WAI-ARIA (flèches, Début, Fin) |
| `EmptyState` | `components/empty-state.tsx` | Absence de données |
| `QueryError`, `TableSkeleton` | `components/query-state.tsx` | Erreur avec « Réessayer » ; chargement annoncé (`role="status"`) |
| `ConfirmDialog` | `components/confirm-dialog.tsx` | Confirmation d'une action sensible ou destructive |
| `CommentDialog` | `components/modules/comment-dialog.tsx` | Décision avec motif |
| `FormField`, `fieldA11y` | `components/form-field.tsx` | Libellé, aide et erreur associés à un champ |
| `Pagination` | `components/pagination.tsx` | Pagination des listes |
| Badges de statut | `components/progression/status-badges.tsx`, `module-status-badge.tsx`, `attempt-status-badge.tsx` | Statut toujours en texte, jamais par la couleur seule |
| `BackLink` | `components/back-link.tsx` | Retour à la liste ou au module |

Utilitaires : `formatDate`, `formatDateTime`, `formatMonth`, `formatBytes` (`lib/format.ts`) ; `monthGrid`, `addMonths`, `programmeOverview` (`lib/calendar.ts`) ; `useDebouncedValue` (`lib/use-debounced-value.ts`).

Règle : avant de créer un composant, chercher l'existant. Un seul composant par usage.

## 4. États d'interface

| État | Rendu |
|---|---|
| Chargement | `TableSkeleton` ou squelette dédié (`aria-busy`, texte masqué) ; jamais « Chargement… » en texte brut |
| Vide | `EmptyState` (icône, titre, piste si des filtres sont actifs) ; pour un graphique, l'état vide de `ChartCard` |
| Erreur réseau | `QueryError` avec « Réessayer » ; le titre de page reste affiché |
| Accès refusé | Redirection vers `/accueil` (`SessionGate`) ; l'API reste l'autorité |
| Action en cours | Bouton désactivé (`busy`, `isSubmitting`) |
| Action réussie ou échouée | Notification (`usePedagogyAction`, `useModuleAction`) ; « Enregistré sur cet appareil » hors ligne |
| Suppression | `ConfirmDialog destructive` avec l'objet nommé ; jamais `window.confirm` |
| Conflit de synchronisation | « Cet appareil » : Réessayer ou Abandonner (confirmé) |

## 5. Navigation

- Rubriques fixées par D141 (routier : Accueil, Cours, Évaluations, Mon parcours, Mon profil ; encadrement : Accueil, Routiers, Cours, Évaluations, Mon profil ; « Administration » discrète).
- Intertitres facultatifs dans une rubrique longue (`NavItem.section`, D169) : « Organisation » et « Référentiels » (Routiers), « Décisions » (Cours, Évaluations). Ils ne changent ni les rubriques, ni les URL, ni les permissions.
- Barre inférieure mobile à cinq entrées pour qui suit un parcours personnel.
- Aucun rôle technique affiché, aucun choix d'espace.

## 6. Graphiques

- Un graphique seulement si deux indicateurs textuels ne suffisent pas.
- Barres horizontales pour les catégories (libellés longs lisibles sur mobile) ; valeur inscrite en bout de barre ; légende seulement à partir de deux séries, dans l'ordre des séries.
- Infobulle en français, tableau des valeurs toujours disponible, animation désactivée si « réduire les animations » est actif.
- Données issues de l'API uniquement ; aucun classement de routiers ; aucune donnée médicale.
- Recharts n'est chargé que par la page qui l'importe (Statistiques).

## 7. Responsive et accessibilité

- Mobile d'abord (360 px), puis `sm` (640), `lg` (1024). Aucun débordement horizontal de page (vérifié à 360, 390, 768, 1024 et 1440 px sur les écrans refondus).
- Tableaux : défilement contenu dans `Table` et colonnes secondaires masquées (`hidden sm:table-cell`).
- Cibles tactiles ≥ 40 px (`h-10`), 44 px pour les déclencheurs du menu.
- Focus visible (`ring-[3px]`), lien d'évitement, `aria-current` sur l'entrée active, `aria-live` sur les changements de mois et les compteurs.
- Animations discrètes, coupées par `prefers-reduced-motion`.
