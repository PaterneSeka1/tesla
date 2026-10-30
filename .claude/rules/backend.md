---
paths:
  - "apps/api/src/**"
  - "apps/api/test/**"
---
# Règles backend (apps/api)

## Modules NestJS
- Un dossier par domaine dans `src/modules/<domaine>/` : `<domaine>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`.
- Modules réservés existants : `auth`, `users`, `pedagogy`, `progression`, `programmes`, `audit`. Les compléter plutôt que d'en créer des doublons.
- Modules métier : `scouts` (profils routiers, matricules, équipes, affectations), `evaluations` (questionnaires, passation, tentatives, codes, PDF, corrections, dérogations) et `pedagogy` (modules, versions, leçons, workflow de publication, bibliothèque).
- Permissions métier centralisées dans `src/common/permissions.ts` (`assertCan(actor, 'permission')`) ; les services reçoivent un `Actor` (`src/common/actor.ts`).
- ESM : imports relatifs avec extension `.js`.

## Contrôleurs légers, services métier
- Contrôleur : routage, décorateurs Swagger, validation d'entrée, appel d'un service. Aucune logique métier.
- Service : règles métier, accès Prisma, transactions, écriture du journal d'audit.

## Validation des entrées
- Schémas Zod dans `@tesla/shared` (réutilisés par le web). Valider chaque body/query/param avant le service.
- Configuration : `src/config/env.ts` (Zod). Toute nouvelle variable y est déclarée et ajoutée à `.env.example`.

## Erreurs
- Format homogène produit par `AllExceptionsFilter` : `{ statusCode, code, message, path, timestamp }`.
- Erreur métier : `throw new XxxException({ code: 'CODE_STABLE', message: 'Message affichable en français.' })`.
- Ne jamais renvoyer de stack, de requête SQL ou de détail interne.

## Autorisation
- Côté serveur, systématique : rôle **et** périmètre (propriétaire, statut de la ressource).
- Les actions sensibles (approbation, déblocage, validation d'acquis) écrivent un `AuditLog` dans la même transaction.

## Tests
- Vitest. Unitaires `*.spec.ts` à côté du code ; e2e `test/*.e2e-spec.ts` via `configureApp` + Supertest.
- Tester au minimum : cas nominal, refus d'autorisation, entrée invalide.
- Contraintes SQL, triggers et concurrence : tests d'intégration `test/*.int-spec.ts` sur base réelle (`npm run test:int`, `TEST_DATABASE_URL` vers une base `*_test`).

## Écritures rejouables (offline-first, D110)
- `IdempotencyInterceptor` (global) traite `x-tesla-operation-id` : ne rien dupliquer dans les services.
- Une écriture différable accepte une version de référence facultative (`expectedUpdatedAt`, révision, `expectedStatus`…) et répond `409` avec un code stable en cas de changement, sans écraser.
