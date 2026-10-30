# CLAUDE.md — Nikola Tesla Académie

Point d'entrée de Claude Code. Court par design : les détails sont dans `.claude/rules/` (chargées selon les chemins modifiés) et `docs/`.

## 1. Projet
Plateforme pédagogique de la **Communauté Nikola Tesla** (Branche Route, District Requin de Sable, Abidjan), année scoute 2026–2027 : 25 routiers, un encadrement de responsables (plein, adjoint, assistants), une seule communauté. Indépendante de SCOUT-NDPST (ne jamais modifier ce projet).

## 2. Architecture
Monorepo npm workspaces : `apps/web` (Next.js PWA) ↔ REST `/api/v1` ↔ `apps/api` (NestJS) ↔ PostgreSQL (Prisma). Contrats partagés dans `packages/shared`. Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 3. Technologies
Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query, React Hook Form, Zod 4 · NestJS 12 (ESM), Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 18 · TypeScript 6 strict · Vitest · ESLint 9 · Prettier.

## 4. Organisation
```
apps/web          Next.js : src/app (routes), src/components, src/lib
apps/api          NestJS : src/{config,prisma,health,common,modules}, prisma/
packages/shared   Schémas Zod + constantes métier (compilé dans dist/)
packages/config   tsconfig de base, config ESLint
docs/             Documentation fonctionnelle et technique
```

## 5. Commandes
```bash
npm run dev | dev:web | dev:api     # développement
npm run lint && npm run typecheck && npm run test && npm run build
npm run db:up | db:migrate | db:seed | db:generate
```

## 6. Conventions
- Code (variables, fonctions) en anglais ; interfaces, messages et docs en français.
- Imports relatifs ESM avec extension `.js` côté API/shared ; alias `@/` côté web.
- Contrats d'API : schéma Zod dans `@tesla/shared`, utilisé par l'API **et** le web.
- Conventional Commits. Aucun commit/push sans demande explicite.

## 7. Règles métier fondamentales
Voir [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) et `.claude/rules/pedagogy.md`. En bref : publication **uniquement** après approbation du responsable ; évaluations selon la progression sauf déblocage individuel ; validation officielle des acquis **exclusivement humaine** (responsable). Ne jamais inventer une règle pédagogique : la rendre configurable et la signaler.

Règles structurantes du modèle (RM-001 à RM-012) :
- **Routier sans compte** : le profil routier (`ScoutProfile`) est la référence métier ; le compte (`User`) est facultatif et rattachable plus tard sans créer de second profil. Évaluations, dérogations et validations référencent le **profil**, jamais seulement le compte.
- **Matricule** : chaîne normalisée, facultative, unique si renseignée, jamais générée ni confondue avec un identifiant technique ou un code de tentative.
- **Équipe** : au plus une affectation ouverte par routier, historique conservé (`TeamAssignment`).
- **Tentative papier** : même éligibilité qu'en ligne ; la réimpression ne crée jamais de tentative.
- **Code unique** `NT-AAAA-NNNNNN` : émis par le backend (compteur transactionnel), immuable, jamais réutilisé, **pas un secret** (recherche protégée par permissions).
- **Validation officielle humaine** : un chef saisit et soumet ; seul le responsable décide ; aucun statut de tentative ne change l'étape d'un routier.
- **Application unique et encadrement (D32, D93, D132–D134)** : rôles d'accès internes `ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR`, **jamais affichés** ; aucun espace, aucun choix d'espace, aucun mandat ni délégation. Fonctions plein / adjoint / assistant désignées directement par l'administrateur (`leadership_assignments`, un seul plein en fonction, historique conservé) ; décisions officielles (fiches, matricules, étapes, équipes, affectations, rattachement, approbations, validations) = plein en fonction ; tout l'encadrement consulte, rédige et observe ; routiers = aucun accès aux fiches. Menu, pages et accueil (`/accueil`) découlent des permissions. Matrice : `packages/shared/src/permissions.ts`.
- **Âge et rattrapage** : étape théorique calculée selon l'âge (référentiel versionné), distincte de l'étape officielle ; sortie de la branche le jour du 21e anniversaire sans suppression ; obligations de rattrapage décidées par un humain. Voir `docs/REFERENTIEL_PEDAGOGIQUE.md`.
- **Observations** : accompagnement, jamais validation ; jamais supprimées ; modifiées par leur auteur seul (versions conservées).
- **Modules** : seule une version `BROUILLON` est modifiable (triggers) ; une version de travail et une version publiée au plus par module ; publication atomique par le responsable ; contenu des leçons en JSON par liste blanche (`lessonDocumentSchema`), jamais de HTML. Voir `docs/FEATURES/WORKFLOW_PUBLICATION.md`.
- **Évaluations** : même workflow que les modules (chef rédige et soumet, responsable approuve et publie, seule une version `BROUILLON` est modifiable) ; éligibilité calculée côté serveur (étape ou déblocage actif) ; corrigé et barèmes jamais transmis au routier ni imprimés sur sa feuille ; correction objective déterministe (`gradeObjectiveAnswer`), réponses libres notées par un humain, aucune IA ; « résultat accepté » (`VALIDEE`) n'est jamais une validation d'acquis. Voir `docs/FEATURES/EVALUATION_WORKFLOW.md`.

## 8. Sécurité
Autorisation vérifiée côté serveur (le masquage UI ne suffit pas) : garde de session globale (`@Public()` pour les exceptions) + `assertCan` dans les services. Sessions opaques en cookie httpOnly, Argon2id, en-tête `x-tesla-csrf` sur toute écriture. Comptes de démonstration uniquement via `DEMO_ACCOUNT_PASSWORD` local. Aucune donnée réelle, aucun secret dans Git ou les seeds. Navigation web par permissions effectives seulement (`apps/web/src/lib/navigation.ts`, menu unique, accueil commun `/accueil`, aucun choix d'espace), alignée sur la matrice API, qui reste l'autorité. Pas de cache hors ligne de données personnelles sensibles : le hors ligne passe par le coffre IndexedDB chiffré du routier, jamais par le cache du service worker (voir `docs/OFFLINE_FIRST.md`). Erreurs API sans détail interne.

## 9. Migrations
`prisma migrate dev --name <nom>` uniquement ; relire le SQL généré ; aucune migration destructive sans plan validé. Voir `.claude/rules/database.md`.

## 10. Usage de l'IA
Agent principal unique, lecture ciblée, pas de refactorisation non demandée, pas d'API d'IA dans l'application. Voir `.claude/rules/ai-usage.md` et [docs/AI_GOVERNANCE.md](docs/AI_GOVERNANCE.md).

## 11. Avant toute modification
1. Lire [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).
2. Identifier le module concerné et lire uniquement ses fichiers.
3. Réutiliser les composants, schémas et conventions existants.

## 12. Critères de validation
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` passent (ou échecs signalés tels quels).
- Docs concernées et `docs/IMPLEMENTATION_STATUS.md` à jour ; `CHANGELOG.md` pour les changements notables.
- Rapport final : changements, fichiers, tests exécutés et résultats, limites.
