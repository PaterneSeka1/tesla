# Audit ESLint et TypeScript (phase 6, 2026-10-29)

## Commandes exécutées
```bash
npm run lint        # eslint . dans packages/shared, apps/api, apps/web
npm run typecheck   # build:shared puis tsc --noEmit (shared, api) et next typegen + tsc (web)
npm run build
```
Diagnostics de l'éditeur relus via l'extension VS Code (panneau Problèmes) le même jour.

## Avant correction
| Source | Erreurs | Avertissements | Détail |
| --- | --- | --- | --- |
| ESLint `packages/shared` | 0 | 0 | |
| ESLint `apps/api` | 1 | 0 | `prisma/seed.ts:16` — `'Prisma' is defined but never used` (`@typescript-eslint/no-unused-vars`) |
| ESLint `apps/web` | 0 | 0 | |
| TypeScript (3 paquets) | 0 | — | |
| Build API + web | 0 | — | |
| VS Code | 0 erreur | 1 indice | même import inutilisé (`ts(6133)`) |

L'unique erreur se trouvait dans une **modification locale non commitée** de `apps/api/prisma/seed.ts`. Aucune erreur dans les fichiers commités ni dans les fichiers générés (`src/generated/**` est exclu du lint, car produit par `prisma generate`).

## Cause probable des erreurs constatées dans VS Code
`npm run lint` et `npm run typecheck` passant, les erreurs visibles dans l'éditeur ne proviennent pas du code commité. Deux dépendances de résolution ne sont pas versionnées :
1. **`@tesla/shared` est résolu via `packages/shared/dist`** (champ `exports` → `./dist/index.d.ts`). Après un clonage, ou après une modification de `packages/shared/src` sans recompilation, l'éditeur voit des types absents ou périmés. `npm run typecheck` recompile `shared` avant de vérifier, d'où l'écart avec la ligne de commande.
2. **Client Prisma généré** (`apps/api/src/generated/`, ignoré par Git) : absent tant que `npm run db:generate` n'a pas été exécuté, et périmé après une migration tant que le serveur TypeScript de l'éditeur n'a pas été redémarré.

Indice concret : la modification locale de `seed.ts` ajoute un double cast `PROGRAMME_CATEGORIES as unknown as readonly ProgrammeCategorySeed[]` et un alias `prisma.programmeCategory`. La version commitée, **sans ces contournements**, passe `tsc --noEmit` (vérifié le 2026-10-29). Le cast masque donc une erreur d'éditeur, pas une erreur du code.

Procédure en cas d'erreurs dans l'éditeur seulement :
```bash
npm run build:shared && npm run db:generate
# puis VS Code : « TypeScript: Restart TS Server » et « ESLint: Restart ESLint Server »
```
La configuration de l'éditeur est cohérente (`typescript.tsdk` vers le TypeScript 6.0.3 du dépôt, `eslint.workingDirectories: auto`, ESLint 9.39.5 en configuration plate dans chaque paquet) : aucune modification n'a été nécessaire.

## Corrections
| Fichier | Correction |
| --- | --- |
| `apps/api/prisma/seed.ts` | Import inutilisé `type Prisma` retiré. Le reste de la modification locale (cast, alias) est **laissé à son auteur**, avec la recommandation de le retirer. Diff d'origine sauvegardé hors dépôt avant correction. |
| `apps/web/src/components/ui/toaster.tsx` | `useToast()` renvoie une référence stable (`useMemo`) : utilisable comme dépendance d'effet sans `eslint-disable` (nécessaire pour `SessionGate`). |

Aucune règle désactivée, aucun `eslint-disable` ajouté, aucun `any`, aucune exclusion de fichier source.

## Après correction
| Source | Erreurs | Avertissements |
| --- | --- | --- |
| ESLint (3 paquets) | 0 | 0 |
| TypeScript (3 paquets) | 0 | — |
| Build API + web | 0 | — |

## Limites
- Les erreurs vues précédemment dans l'éditeur n'ont pas pu être reproduites : seul l'état actuel a été observé. Le diagnostic ci-dessus reste une explication probable, cohérente avec le contournement trouvé dans `seed.ts`.
- `prettier --check` : non bloquant, non relancé sur l'ensemble du dépôt.
