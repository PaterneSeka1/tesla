---
paths:
  - "apps/web/**"
---
# Règles frontend (apps/web)

## Architecture Next.js
- Next.js 16 diffère des versions antérieures : consulter la doc embarquée `node_modules/next/dist/docs/` (version installée) avant d'utiliser une API inconnue ; respecter les avertissements de dépréciation.
- App Router dans `src/app`. Espaces par rôle dans le groupe `(espaces)/` (`routier`, `chef`, `responsable`), chacun avec son `layout.tsx` utilisant `DashboardShell`.
- `cacheComponents` est activé : les données dynamiques serveur doivent être sous `<Suspense>`.
- Navigation : déclarer les entrées dans `src/lib/spaces.ts`. **Aucune entrée vers un écran inexistant.**

## Server / Client Components
- Server Component par défaut. `'use client'` seulement pour l'état, les effets, les événements ou TanStack Query.
- Pousser `'use client'` au plus bas de l'arbre (ex. `ApiStatus`, `SpaceNav`, `LoginForm`).
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
