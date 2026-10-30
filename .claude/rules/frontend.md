---
paths:
  - "apps/web/**"
---
# Règles frontend (apps/web)

## Architecture Next.js
- Next.js 16 diffère des versions antérieures : consulter la doc embarquée `node_modules/next/dist/docs/` (version installée) avant d'utiliser une API inconnue ; respecter les avertissements de dépréciation.
- App Router dans `src/app`. Pages connectées dans le groupe `(espaces)/`, dont le `layout.tsx` unique monte `DashboardShell` ; les layouts de dossier ne portent que le titre (`metadata`). Application unique : aucun écran de choix d'espace, aucun rôle affiché ; les permissions effectives déterminent menu, pages et blocs de l'accueil (`/accueil`).
- `cacheComponents` est activé : les données dynamiques serveur doivent être sous `<Suspense>`.
- Navigation et accès : `src/lib/navigation.ts` (`NAVIGATION` unique filtré par permissions, `ACCESS_RULES` par chemin et permission, `HOME_ROUTE`, `resolvePostLoginPath`). Toute nouvelle page connectée doit avoir une règle d'accès. **Aucune entrée vers un écran inexistant ni en double** (vérifié par `navigation.test.ts`). Alignement avec `apps/api/src/common/permissions.ts`.

## Server / Client Components
- Server Component par défaut. `'use client'` seulement pour l'état, les effets, les événements ou TanStack Query.
- Pousser `'use client'` au plus bas de l'arbre (ex. `AppNav`, `LoginForm`).
- Ne jamais passer de fonction ou composant (icône) d'un Server vers un Client Component : importer la configuration côté client.

## Données
- Appels API via `apiFetch(path, schema)` (`src/lib/api/client.ts`) avec un schéma Zod de `@tesla/shared`.
- Requêtes déclarées en `queryOptions` dans `src/lib/api/<domaine>.ts`, consommées par `useQuery`.
- Formulaires : React Hook Form + `zodResolver`, messages d'erreur en français.
- Variables d'environnement publiques validées dans `src/lib/env.ts`.

## Composants
- Primitives shadcn/ui dans `src/components/ui` (ajout : `npx shadcn@latest add <composant>`). Ne pas les dupliquer.
- Couleurs via les jetons du thème (`bg-primary`, `text-tesla-bordeaux`…) définis dans `globals.css`, jamais de valeurs hex en dur dans les composants.
- États obligatoires pour toute donnée distante : chargement, vide, erreur.

## Responsive, accessibilité, performance
- Mobile-first : concevoir pour 360 px puis élargir (`sm`, `lg`).
- Contraste AA, `lang="fr"`, labels associés, `aria-invalid`/`aria-describedby` sur les champs, focus visible, lien d'évitement.
- Images via `next/image`. Pas de bibliothèque lourde sans justification. Pas de polices distantes (build hors réseau, VPS léger).

## Offline-first (D109–D117)
- Toute lecture passe par `apiFetch` : la copie locale est automatique, ne pas créer de cache par écran. Nouvelle route API contenant corrigés, barèmes ou secrets : l'ajouter aux exclusions de `src/lib/offline/repository.ts`.
- Écriture utilisable sans réseau : la déclarer dans `OPERATION_TYPES` (`src/lib/offline/operations.ts`) avec sa permission et une version de référence, passer un `OfflineWrite` à `apiSend`, traiter `OfflineQueuedError` comme « Enregistré sur cet appareil ». Jamais pour une décision officielle.
- Nouvelle page : vérifier qu'elle est préparée (`src/lib/offline/preparation.ts`) si elle doit fonctionner sans réseau. Voir `docs/OFFLINE_FIRST.md`.
