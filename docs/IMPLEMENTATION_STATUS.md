# État d'implémentation

Dernière mise à jour : 2026-10-28 — fin de la phase 0 (fondations).

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo npm workspaces (`web`, `api`, `shared`, `config`) | `npm install` OK |
| Lint, typecheck, tests, build | Les quatre commandes racine passent |
| API NestJS : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `curl` sur `/health`, route inconnue (404 homogène), `/api/docs` |
| `GET /api/v1/health` avec test réel de la base | `ok/up` base active ; `degraded/down` base arrêtée |
| PostgreSQL 18 via Docker Compose (port hôte 5433) | Conteneur `tesla-postgres` démarré, état `healthy` |
| Prisma 7 : schéma (5 modèles), migration `init`, seed idempotent | `db:deploy` puis `db:seed` (deux fois, sans doublon) sur le conteneur Docker ; 5 tables + `_prisma_migrations` vérifiées |
| `npm run dev` avec base Docker | Healthcheck `ok` / `database: up`, accueil web en 200 |
| Web Next.js : accueil, connexion visuelle, espaces routier/chef/responsable, 404, erreur, chargement, hors ligne | Pages servies en 200 (404 pour une page inconnue) ; build statique |
| Client API typé + TanStack Query (`ApiStatus`) | Tests unitaires ; en-tête CORS vérifié pour `http://localhost:3000` |
| PWA : manifest, icônes, service worker, page hors ligne, structure IndexedDB | Fichiers servis ; voir limites ci-dessous |
| Règles Claude Code, AGENTS.md, documentation, CI, workspace VS Code | Créés |

## Partiel ou non vérifié
- **Appel du healthcheck depuis le navigateur** : vérifié indirectement (CORS, tests du client), pas dans un vrai navigateur.
- **Service worker** : enregistré en production uniquement ; installation et mode hors ligne non testés dans un navigateur.
- **IndexedDB** : structure définie, utilisée par aucun écran.
- **CI GitHub Actions** : non exécutée (aucun push).
- **Audit de dépendances** (`npm audit`) : non exécuté.

## Non développé
Authentification et sessions, gestion des comptes, protection des espaces par rôle, modules et leçons, workflow de publication, lecture et téléchargement hors ligne, évaluations, déblocages, validations, programme annuel, journal d'audit applicatif, déploiement. Voir [ROADMAP.md](ROADMAP.md).
