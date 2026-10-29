# État d'implémentation

Dernière mise à jour : 2026-10-29 — phase 1 (authentification, équipes, routiers, affectations, observations). Détail fonctionnel : [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo, lint, typecheck, tests, build | Les quatre commandes racine passent (2026-10-29) |
| API : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `/health` |
| PostgreSQL 18 (Docker, port 5433), Prisma 7, 5 migrations | `db:deploy` sur la base de développement et `tesla_test` ; diff base ↔ schéma vide |
| **Authentification** : login/logout/me, Argon2id, sessions httpOnly, expiration, révocation, limitation, CSRF, garde globale | Tests unitaires + intégration HTTP sur PostgreSQL ; recette navigateur |
| **Équipes** : liste, recherche, filtres, création, modification, archivage | Intégration HTTP ; recette navigateur |
| **Routiers** : sans compte, matricule, recherche, filtres, fiche, modification, étape (responsable), activation, rattachement de compte, doublons | Intégration HTTP ; recette navigateur |
| **Affectations** : transaction, historique, auteur, journal, concurrence | Intégration HTTP (dont 5 affectations simultanées) |
| **Observations** : saisie, visibilité, modification par l'auteur, historique, non-suppression | Intégration HTTP + triggers ; recette navigateur |
| **Web** : connexion, protection des espaces, écrans `/administration/…`, tableaux de bord | Build ; recette Chromium (Playwright) desktop 1366 px et mobile 390 px |
| Modèle des tentatives papier, codes `NT-AAAA-NNNNNN`, dérogations (phase 1 bis) | 15 tests d'intégration (inchangés, adaptés à la matrice D32) |

### Tests exécutés (2026-10-29)
- `npm run test` : API 50 tests (13 fichiers), web 8 tests (2 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (base `tesla_test`) : 31 tests (2 fichiers) — réussis.
- Recette navigateur (script hors dépôt, Chromium headless) : connexion refusée/acceptée, création de 2 équipes, routier sans compte avec matricule et équipe, changement d'équipe (2 affectations), observation d'un chef visible par le responsable, `POST /teams` d'un chef refusé (403), recherche par nom puis matricule, absence de défilement horizontal à 390 px, déconnexion — réussie. Elle a laissé des données fictives « Recette … » dans la base de développement.

## Partiel ou non vérifié
- **Lecteurs d'écran, contraste mesuré** : non audités avec un outil dédié.
- **Navigateurs réels (Safari iOS, Android)** : non testés ; seulement Chromium headless.
- **Swagger** : documentation générée ; rendu de `/api/docs` non revu manuellement.
- **Limitation des tentatives** : en mémoire, réinitialisée au redémarrage ; non partagée entre instances.
- **Service worker / hors ligne, IndexedDB** : inchangés, non testés en navigateur.
- **CI GitHub Actions** : non exécutée (aucun push) ; tests d'intégration non configurés en CI.
- **Audit de dépendances** (`npm audit`) : 0 vulnérabilité signalée à l'installation d'`argon2`, audit complet non exécuté.

## Non développé
Gestion des comptes (création, activation, mot de passe), routes et écrans des tentatives papier et dérogations, génération PDF, modules et leçons, publication, quiz en ligne, validation officielle des acquis, espace routier (son suivi), consultation du journal d'audit, programme annuel, déploiement. Voir [ROADMAP.md](ROADMAP.md).
