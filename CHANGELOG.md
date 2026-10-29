# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon SemVer.

## [Non publié]

### Ajouté — phase 2 (modules pédagogiques et publication), 2026-10-29
- Modèle : modules, versions, leçons, ressources externes, collaborateurs, historique des versions et décisions (migration additive `20261029120000_pedagogical_modules`, contraintes SQL et triggers : contenu figé hors brouillon, transitions contrôlées, une version de travail et une version publiée par module).
- API : bibliothèque `/modules` (versions publiées uniquement), rédaction `/editor/*`, approbation `/admin/modules/*` (approuver, demander des corrections, refuser, publier de façon atomique, archiver, historique) ; concurrence optimiste (`409 EDIT_CONFLICT`) ; journalisation des décisions ; documentation Swagger.
- Contrats partagés : `lessonDocumentSchema` (liste blanche du contenu enrichi), schémas des modules, transitions.
- Web : éditeur de cours Tiptap, espace chef (`/chef/modules`, création, édition, aperçu, soumissions, tableau de bord éditorial), écrans du responsable (`/administration/modules-a-valider`, révision, tous les modules, historique des publications), bibliothèque (`/modules`, détail, lecteur, version imprimable A4), navigation par rôle.
- Tests : 11 tests d'intégration HTTP des modules, tests unitaires du contenu, des transitions et des permissions ; recette navigateur des 15 critères de la phase.

### Modifié — phase 2, 2026-10-29
- Espace chef ouvert au responsable pour la rédaction ; entrées de navigation filtrables par rôle ; lien actif déterminé par la correspondance la plus précise.
- `apiSend` accepte `DELETE` ; cadre de l'application masqué à l'impression.
- Dépendances web : `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image` (3.31.4, versions épinglées).

### Ajouté — phase 1 (authentification, équipes, routiers, observations), 2026-10-29
- Authentification : `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` ; mots de passe Argon2id ; sessions serveur (jeton haché, cookie httpOnly SameSite=Lax, Secure en production, expiration et révocation) ; limitation des tentatives ; protection CSRF (en-tête `x-tesla-csrf` + contrôle d'origine) ; garde globale.
- Routes `/teams`, `/scouts`, affectations (`/scouts/:id/teams/…`), observations (`/scouts/:id/observations`), historique pédagogique, référentiel des étapes ; documentation Swagger générée depuis les contrats Zod.
- Profil routier activable/désactivable ; observations avec niveau d'accès et historique des modifications (migration `20261028230000_scout_status_observations`).
- Journalisation (`AuditLog`) : connexions, équipes, affectations, inscription, modifications de fiche, changements d'étape, activation.
- Web : connexion réelle, protection des espaces (`proxy.ts` + vérification de session et de rôle), écrans `/administration/equipes` et `/administration/routiers` (liste, création, fiche, modification), tableaux de bord avec indicateurs réels.
- Seed : comptes de démonstration fictifs (hors production, mot de passe fourni par l'environnement).
- Tests : 16 tests d'intégration HTTP sur PostgreSQL, tests unitaires (limiteur, CSRF, Argon2id, contrats).

### Modifié — 2026-10-29
- Permissions : inscription, modification, affectation des routiers et gestion des équipes réservées au responsable ; chefs en consultation et saisie d'observations (D32).

### Modifié — 2026-10-28
- Matricule : format officiel imposé (7 chiffres suivis d'une lettre, ex. `0000001A`) dans `@tesla/shared` et en base (migration `20261028222140_matricule_official_format`).

### Ajouté — phase 1 bis (routiers, équipes, évaluations papier), 2026-10-28
- Profil routier indépendant du compte : `scout_profiles.user_id` facultatif, nom et prénom sur le profil, matricule facultatif unique et normalisé.
- Équipes et historique des affectations (une affectation ouverte, périodes sans chevauchement).
- Évaluations, versions, tentatives multimodes (`EN_LIGNE`, `HORS_LIGNE`, `PAPIER`), historique en ajout seul, dérogations.
- Code unique de tentative `NT-AAAA-NNNNNN` émis par compteur annuel transactionnel.
- Migration `20261028212208_teams_matricule_evaluation_attempts` (additive, contraintes SQL et triggers).
- Services `scouts` et `evaluations` (sans routes HTTP), matrice des permissions, contrats Zod partagés.
- Tests unitaires et suite d'intégration PostgreSQL (`npm run test:int -w @tesla/api`).
- Règles RM-001 à RM-012 et documentation associée.

### Ajouté — phase 0 (fondations), 2026-10-28
- Monorepo npm workspaces : `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- API NestJS 12 : préfixe `/api/v1`, validation de l'environnement, Swagger, format d'erreur homogène, journalisation des requêtes, CORS, `GET /api/v1/health`, modules réservés.
- Prisma 7 / PostgreSQL : modèles `User`, `Session`, `ScoutProfile`, `ProgressionStage`, `AuditLog`, migration initiale, seed des étapes de progression.
- Web Next.js 16 : identité visuelle de la Communauté Nikola Tesla, accueil, connexion (visuelle), espaces routier / chef / responsable, pages 404, erreur, chargement, hors ligne.
- PWA : manifest, icônes, service worker, structure IndexedDB.
- Outillage : ESLint, Prettier, Vitest, Docker Compose (PostgreSQL), GitHub Actions, workspace VS Code.
- Documentation : `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `docs/`.
