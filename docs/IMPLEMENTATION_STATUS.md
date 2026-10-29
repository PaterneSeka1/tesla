# État d'implémentation

Dernière mise à jour : 2026-10-29 — phase 2 (modules pédagogiques, éditeur, workflow d'approbation, bibliothèque). Détails fonctionnels : [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo, lint, typecheck, tests, build | Les quatre commandes racine passent (2026-10-29, après la phase 2) |
| API : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `/health` |
| PostgreSQL 18 (Docker, port 5433), Prisma 7, 6 migrations | `db:deploy` sur la base de développement et `tesla_test` ; diff base ↔ schéma vide |
| **Authentification** : login/logout/me, Argon2id, sessions httpOnly, expiration, révocation, limitation, CSRF, garde globale | Tests unitaires + intégration HTTP ; recette navigateur |
| **Équipes, routiers, affectations, observations** (phase 1) | Intégration HTTP ; recette navigateur (phase 1) ; suite d'intégration rejouée sans régression |
| **Modules : modèle, versions, leçons, ressources, collaborateurs, historique** (migration `20261029120000_pedagogical_modules`) | Intégration HTTP + triggers |
| **Rédaction** : création, informations, leçons (ajout, contenu, ordre, suppression), ressources, collaboration, soumission, reprise, nouvelle version | Intégration HTTP ; recette navigateur |
| **Workflow** : approbation, corrections motivées, refus, publication atomique, archivage, historique | Intégration HTTP ; recette navigateur |
| **Concurrence** : révisions optimistes, verrous, une version de travail, une version publiée | Intégration HTTP (requêtes simultanées) |
| **Contenu sûr** : liste blanche du document, liens et images contrôlés, rendu sans HTML | Tests unitaires + intégration |
| **Bibliothèque** : liste, recherche, filtres étape/thème, recommandation, détail, lecteur, impression A4 | Intégration HTTP ; recette navigateur (impression émulée) |
| Modèle des tentatives papier, codes `NT-AAAA-NNNNNN`, dérogations (phase 1 bis) | 15 tests d'intégration (inchangés) |

### Tests exécutés (2026-10-29)
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 64 tests (14 fichiers), web 8 tests (2 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (base `tesla_test`) : 42 tests (3 fichiers, dont 11 pour les modules) — réussis.
- Recette navigateur (script hors dépôt, Chromium headless, API et web de production locaux sur la base jetable `tesla_test`, comptes fictifs) — les 15 critères de la phase réussis : connexion chef ; création d'un module ; deux leçons rédigées dans l'éditeur ; réordonnancement et ressource ; collaboration d'un second chef ; soumission et refus de publication par un chef (403) ; file de validation et contenu exact côté responsable ; demande de corrections motivée, reprise, nouvelle soumission, approbation ; publication ; bibliothèque routier avec badge « recommandé », lecteur et navigation ; version imprimable (cadre masqué à l'impression, PDF A4 généré par Chromium) ; nouvelle version servie seulement après publication, ancienne archivée ; mobile 390 px sans défilement horizontal (bibliothèque, module, éditeur). Aucune donnée ajoutée à la base de développement.

## Partiel ou non vérifié
- **Lecteurs d'écran, contraste mesuré** : non audités avec un outil dédié (barre d'outils de l'éditeur dotée de libellés et `aria-pressed`, non testée avec un lecteur d'écran).
- **Navigateurs réels (Safari iOS, Android)** : non testés ; seulement Chromium headless. Saisie Tiptap sur clavier mobile non testée sur appareil.
- **Swagger** : documentation générée ; rendu de `/api/docs` non revu manuellement.
- **Avertissement `pg`** : « client.query() when the client is already executing a query » émis pendant certains tests d'intégration des modules ; il provient de l'interpréteur de requêtes de Prisma 7 (relations chargées en parallèle dans une transaction interactive). Sans effet aujourd'hui ; à surveiller avant `pg@9`.
- **Limitation des tentatives de connexion** : en mémoire, réinitialisée au redémarrage.
- **Service worker / hors ligne, IndexedDB** : inchangés ; aucun module n'est disponible hors ligne.
- **CI GitHub Actions** : non exécutée (aucun push) ; tests d'intégration non configurés en CI.
- **Audit de dépendances** : 0 vulnérabilité signalée à l'installation de Tiptap ; audit complet non exécuté.

## Non développé
Gestion des comptes (création, activation, mot de passe), routes et écrans des tentatives papier et dérogations, génération PDF serveur, progression de lecture, lecture hors ligne des modules, téléversement de fichiers, quiz en ligne, file de validation des évaluations, validation officielle des acquis, espace routier (son suivi), consultation du journal d'audit complet, programme annuel, déploiement. Voir [ROADMAP.md](ROADMAP.md).
