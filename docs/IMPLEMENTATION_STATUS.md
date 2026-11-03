# État d'implémentation

Dernière mise à jour : 2026-11-03 — **Node.js 22 isolé sur le VPS OVH** (`TESLA_NODE_DIR`, `/opt/node22/bin`, Node.js 20 du système intact, D168), voir [§ Node.js 22](#nodejs-22-isolé-sur-le-vps-ovh-2026-11-03) ; 2026-11-03 — **déploiement Vercel + OVH sous `/var/www/tesla`** (web sur Vercel avec relais même origine, API seule sur un VPS partagé), voir [§ Vercel + OVH](#déploiement-vercel--ovh-sous-varwwwtesla-2026-11-03) et [DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md) ; 2026-11-02 — **évaluations collectives, inscription sur invitation et sécurité des comptes** (saisie / correction séparées, distribution collective, lien ou code, mot de passe oublié, limitation unifiée), voir [§ Évaluations collectives et comptes](#évaluations-collectives-inscription-sur-invitation-et-sécurité-des-comptes-2026-11-02) ; 2026-11-02 — **Entreprise routière et dix domaines d'action** (M09 en 13 leçons, M10 une leçon par domaine, fiches pratiques PDF, questionnaires refaits), voir [§ Entreprise](#entreprise-routière-et-domaines-daction-2026-11-02) et [QUALITY/AUDIT_ENTREPRISE_DOMAINES_2026-11-02.md](QUALITY/AUDIT_ENTREPRISE_DOMAINES_2026-11-02.md) ; 2026-11-02 — **finalisation du catalogue pédagogique** (leçons vides rédigées, questionnaires enrichis, vérificateur `pedagogy:audit`, révisions tracées, lecture), voir [§ Finalisation](#finalisation-du-catalogue-pédagogique-2026-11-02) et [QUALITY/AUDIT_PEDAGOGIQUE_2026-11-02.md](QUALITY/AUDIT_PEDAGOGIQUE_2026-11-02.md) ; 2026-11-02 — **consolidation production** (hors ligne, rattrapages, notes éditoriales, R2, installation OVH, alertes, recettes), voir [§ Consolidation](#consolidation-production-2026-11-02) et [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; 2026-11-02 — **stockage objet Cloudflare R2 et sauvegardes externes**, voir [§ Stockage R2](#stockage-objet-cloudflare-r2-et-sauvegardes-externes-2026-11-02) et [STORAGE_R2.md](STORAGE_R2.md) ; 2026-10-30 — **académie : navigation en rubriques, fiches médicales, quiz** (réponses courtes, résultats, mode jeu), voir [§ Académie](#académie--navigation-fiches-médicales-quiz-2026-10-30) ; 2026-10-30 — **gouvernance simplifiée et application unique** (mandats supprimés, encadrement désigné par l'administrateur, menu et accueil uniques), voir [§ Gouvernance](#gouvernance-simplifiée-et-application-unique-2026-10-30) ; 2026-10-30 — **bibliothèque de formation à la Route** (catalogue initial, textes fondamentaux, duplication), voir [§ Bibliothèque](#bibliothèque-de-formation-à-la-route-2026-10-30) et [CATALOGUE_PEDAGOGIQUE_INITIAL.md](CATALOGUE_PEDAGOGIQUE_INITIAL.md) ; 2026-10-30 — **préparation à la production** (comptes, sécurité, exploitation, CI), voir [§ Préparation à la production](#préparation-à-la-production-2026-10-30) et [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; 2026-10-30 — **offline-first global** (une seule application avec ou sans réseau, préparation de l'appareil, file de synchronisation, conflits), voir [§ Offline-first](#offline-first-global-2026-10-30) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; 2026-10-29 — **sobriété des interfaces** (textes, libellés et état serveur), voir [§ Sobriété](#sobriété-des-interfaces-2026-10-29) ; **refonte parcours Route et mandats** (âge, rattrapages, sortie à 21 ans ; mandats remplacés le 2026-10-30), voir [§ Refonte](#refonte--parcours-route-et-mandats-2026-10-29) ; parcours de l'encadrement (file « À faire », frise de l'année, menu allégé), voir [§ Parcours encadrement](#parcours-du-responsable-et-des-chefs-2026-10-29) ; phase 6 (navigation par rôle, UX, audit ESLint), voir [§ Phase 6](#phase-6--navigation-par-rôle-ux-et-stabilisation-2026-10-29) ; seed des modules « Bases du scoutisme » (brouillons), voir [§ Seed pédagogique](#seed-pédagogique--bases-du-scoutisme-2026-10-29) ; phase 5 (hors ligne) livrée, voir [§ Phase 5](#phase-5--pwa-hors-ligne-2026-10-29) et [OFFLINE_FIRST.md](OFFLINE_FIRST.md) ; phase 4 livrée en complément de la phase 3 ; voir [rapport de livraison](FEATURES/PHASE_4_REPORT.md). Phase 3 (évaluations : questionnaires, passation en ligne, papier, correction, examen des résultats). Détails fonctionnels : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md), [FEATURES/MODULES_PEDAGOGIQUES.md](FEATURES/MODULES_PEDAGOGIQUES.md), [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md), [FEATURES/ROUTIERS_EQUIPES.md](FEATURES/ROUTIERS_EQUIPES.md).



## Node.js 22 isolé sur le VPS OVH (2026-11-03)

Branche `chore/node22-isole` (depuis `main` d6a6e5d, non poussée). Décision D168. Rien n'a été installé ni déployé ; aucune connexion au VPS.

### Audit
- `bootstrap.sh` : contrôle et installation éventuelle (NodeSource, paquet `nodejs`) de **`/usr/bin/node`** — sur le VPS (Node.js 20.20.0), arrêt du script ; installation éventuelle = modification globale.
- `tesla-api@`, `tesla-daily@` : `ExecStart=/usr/bin/node` (Node.js 20) ; `tesla-web@` : `node_modules/.bin/next` (`#!/usr/bin/env node` → `PATH` systemd → `/usr/bin/node`).
- `deploy.sh` : `npm ci`, builds, `npx prisma migrate deploy` résolus par le `PATH` de la session `tesla` → Node.js 20.
- Docs : premier administrateur (`node dist/jobs/create-admin.js`) et `npx prisma migrate status` (restauration) lancés avec le `node` de la session.
- Sans Node.js : `backup.sh`, `restore.sh`, `verify-backup.sh`, `healthcheck.sh`, `alert.sh`, `rollback.sh` (redémarrage seul), unités `tesla-backup@`, `tesla-healthcheck@`, `tesla-alert@`, sudoers, Nginx.

### Changements
- `common.sh` : `TESLA_NODE_DIR` (défaut `/opt/node22/bin`, chemin absolu hors `/home` et `/root`), `tesla_check_node` (≥ 22.12, `npm`, `npx`), `tesla_use_node` (dossier en tête du `PATH` du script), `tesla_render_unit`, `tesla_check_units`.
- `deploy.sh` : Node.js de TESLA pour `npm ci`, builds et Prisma ; version journalisée ; refus si une unité installée exécute un autre `node`.
- `bootstrap.sh` : `--node-dir` ; plus aucune installation de Node.js ; contrôle du dossier avant tout paquet ; même dossier exigé pour les deux instances ; `TESLA_NODE_DIR` écrit dans le fichier d'instance ; unités rendues avec ce dossier.
- Unités `tesla-api@`, `tesla-daily@`, `tesla-web@` : `ExecStart=/opt/node22/bin/node …` et `Environment=PATH=/opt/node22/bin:…`.
- `exec.sh` (nouveau) : commandes ponctuelles dans `current/apps/api` avec l'environnement de l'instance et Node.js 22. Docs : DEPLOYMENT_VERCEL_OVH (§ 2, 3, 4, 5, 6, 9, 11, 12), DEPLOYMENT (§ 3), BACKUP_RESTORE.

### Vérifications (locales, 2026-11-03)
- `deploy-scripts.test.sh` : tous les contrôles réussis (Node.js 20 simulé en tête du `PATH`, 22 dans `TESLA_NODE_DIR`).
- ShellCheck (`koalaman/shellcheck:stable`, `-x -S warning`) : aucun avertissement. `systemd-analyze verify` : seules les erreurs tolérées par la CI (binaires et `postgresql.service` absents) ; unités rendues avec un dossier Node.js existant : `node` résolu.
- Release `git archive` construite avec Node.js 22.23.4 isolé et un faux Node.js 20 bloquant en tête du `PATH` : `npm ci`, `build:shared`, build de l'API, `prisma validate`, `prisma migrate status` (base locale) ; aucun appel à Node.js 20.
- `npm run lint` (0 avertissement), `npm run typecheck`, `npm run test` (API 207 tests, web 85), `npm run build` : réussis.

### Limites
- Non exécuté sur OVH : `bootstrap.sh` en root, services réels, `ProtectSystem=strict` avec `/opt/node22`.

## Déploiement Vercel + OVH sous /var/www/tesla (2026-11-03)

Branche `chore/deploiement-vercel-ovh` (depuis `main` 350208e, non poussée). Décision D167. Rien n'a été installé ni déployé.

### Audit initial
- Chemins actifs : `/opt/tesla/<instance>` dans `bootstrap.sh`, `deploy.sh`, `rollback.sh`, 5 unités systemd, docs ; `/var/www/letsencrypt` et `/var/www/tesla` (page de maintenance) créés hors de la racine Tesla ; ports 3000/4000 et 3100/4100 figés ; `tesla-web@` toujours activé et redémarré.
- Risques sur un VPS partagé : suppression du site Nginx par défaut, activation forcée d'UFW, installation de Node.js 22 et de PostgreSQL 18 sans tenir compte de l'existant (cluster 18 sur 5433 si un autre occupe 5432), réglage journald global, `nginx -t` en échec laissant un site cassé activé.
- `deploy/logrotate/tesla` ne visait aucun fichier réel (`tesla.access.log` au lieu de `tesla-<instance>.access.log`) et aurait doublonné `/etc/logrotate.d/nginx` une fois corrigé : supprimé.
- Web : appels inter-domaines vers `NEXT_PUBLIC_API_URL` absolue ; derrière un relais Vercel, toutes les limites par IP (D165) auraient été partagées entre tous les utilisateurs.
- Lint : l'ordre `build:shared` → ESLint était déjà corrigé (`350208e`) ; vérifié depuis un état sans `packages/shared/dist`.

### Implémenté
- `deploy/scripts/common.sh` : `TESLA_DEPLOY_ROOT` (défaut `/var/www/tesla`, refus de `/`, `/var/www`, `/opt`, `..`…), `WEB_HOSTING` (`vercel` | `local`), verrou `shared/deploy.lock`, suppression de release limitée à `releases/<AAAAMMJJhhmmss>-<sha12>` hors `current`, bascule atomique.
- `deploy.sh` / `rollback.sh` : mode Vercel (build `@tesla/shared` + API, redémarrage de `tesla-api@` seul), variables `<…>` refusées, rollback limité aux dossiers de `releases/` (chemins résolus). `healthcheck.sh` : web contrôlé seulement en mode local.
- `bootstrap.sh` : options `--web-url`, `--web-hosting`, `--api-port`, `--web-port`, `--pg-port`, `--enable-firewall`, `--with-journald` ; ports occupés refusés ; Node.js et PostgreSQL existants conservés (refus explicite si inadaptés) ; ACME et maintenance sous `/var/www/tesla` ; clone `ubuntu` → `tesla` limité à `repo/` ; racine clonée refusée ; secret du relais (`/etc/nginx/tesla/<instance>-proxy.conf`, 0600) ; `nginx -t` en échec → version précédente rétablie, aucun rechargement ; site par défaut jamais supprimé ; `tesla-web@` ni activé ni démarré en mode Vercel.
- systemd : chemins `/var/www/tesla/%i`, `TemporaryFileSystem=/var/www:ro` + `BindReadOnlyPaths` (API, quotidien, sauvegarde, santé). Sudoers : `restart tesla-api@<instance>` seul ajouté.
- Nginx `tesla-api.conf` : API seule, adresse client retenue uniquement avec le secret exact (sinon `$remote_addr`), en-têtes du relais retirés, 503 JSON au format `apiErrorSchema`, `location /` 404, `proxy_read_timeout` 120 s.
- Web : `src/lib/api-proxy.ts` (relais `/api/v1/*` → `TESLA_API_ORIGIN`, `Host` de l'API, secret, adresse établie par Vercel, 503 si configuration absente ou non sûre), `NEXT_PUBLIC_API_URL` accepte `/api/v1`, `apps/web/vercel.json` (installation à la racine, build de `@tesla/shared` puis du web).
- CI : ShellCheck `-x`, `deploy-scripts.test.sh`, `systemd-analyze verify`, `nginx -t` des vhosts API ×2 + historique + ACME, build web en mode `/api/v1`.

### Vérifications exécutées (locales, 2026-11-03)
- `npm ci`, `build:shared`, `format:check`, `lint` (aussi sans `dist` partagé), `typecheck`, `test` (API et web, dont 9 tests du relais), `build`, `audit:prod` (559 paquets, 0 vulnérabilité bloquante) : réussis.
- `deploy-scripts.test.sh` : 41 contrôles réussis (releases, échec de build, échec de santé et retour automatique, rollback, release FAILED et chemins hors `releases/` refusés, verrou, rétention, modes vercel/local, racines interdites). `backup-scripts.test.sh` : 9/9 (PostgreSQL 18.6 local). ShellCheck 0.9 : aucun avertissement. `systemd-analyze verify` : aucune erreur de syntaxe. `nginx -t` (nginx 1.24.0 d'Ubuntu 24.04) : réussi ; un secret de 64 caractères dépassait `map_hash_bucket_size` → 32 caractères.
- Chaîne réelle `next start` (build `/api/v1`) → relais → Nginx 1.24 TLS → API de production → PostgreSQL 18 : connexion (`HttpOnly; Secure; SameSite=Lax`), `/auth/me`, 403 sans en-tête CSRF et pour une origine étrangère, écriture JSON accentuée, PDF binaire identique à l'appel direct (hors `/ID` et date), déconnexion puis 401, `Host` de l'API (un site par défaut simulé n'est pas atteint), adresse client retenue via le relais et ignorée sans secret ou avec un mauvais secret, 503 JSON conforme quand l'API est arrêtée (deux défauts corrigés : statut 502 et horodatage `+00:00`).
- Recettes Chromium à travers le relais : comptes 11/11 ; offline-first : étapes 1–12 réussies, échec à l'étape 24 (page d'encadrement ouverte hors ligne par un routier : page « non préparée » au lieu du retour à `/accueil`), identique en mode historique sans relais → antérieur à ce travail.
- **Étape 24 corrigée** : le repli `/hors-ligne` n'appliquait pas `canAccessPath` (la réussite du 2026-11-02 dépendait d'une page d'administration déjà en cache dans le profil) ; `hors-ligne/forbidden-redirect.tsx` renvoie à `/accueil` comme `SessionGate`. Recette rejouée avec un profil neuf (mode historique, `tesla_test`) : **28/28** ; sans le correctif, même protocole : échec à l'étape 24.

- Contre-vérification (2026-11-03, même branche) : `format:check`, `lint` depuis un état sans `packages/shared/dist`, `typecheck`, `test` (API 207, web 85), `build` avec `NEXT_PUBLIC_API_URL=/api/v1`, `audit:prod`, `deploy-scripts.test.sh` et intégration PostgreSQL (`tesla_test`, **144 tests, 16 fichiers**) réussis ; ShellCheck absent de ce poste (non relancé). Commandes de restauration du guide rendues absolues (dossier d'instance en 0750 : `restore.sh` lu par root, exécuté par `postgres`).

### Non exécuté / limites
- Aucun VPS, aucun projet Vercel, aucun R2 réel ; `bootstrap.sh` non exécuté en root (seule la génération du fichier d'instance a été rejouée hors root) ; workflow GitHub Actions non exécuté (pas d'accès).
- À confirmer sur Vercel : `Set-Cookie`, `Origin`, gros ZIP et délai maximal d'une réponse relayée, réécriture de `x-forwarded-for`. Sur OVH : `TemporaryFileSystem` réel, coexistence `listen 443 ssl http2` avec les autres sites, Certbot.

## Évaluations collectives, inscription sur invitation et sécurité des comptes (2026-11-02)

Branche `feat/distribution-collective-comptes` (depuis `main` 87e9eab, non poussée). Décisions D161–D166.

### Audit initial
- **Réutilisé** : tentatives papier (codes, éligibilité, PDF questionnaire / corrigé / grille, versions figées), moteur de correction, file d'examen, hors ligne ; comptes sans mot de passe, jetons d'activation et de réinitialisation à usage unique (empreintes, consommation atomique, sessions révoquées), récupération administrée par nouveau lien ; limitation persistante `auth_throttles` (connexion, liens, changement de mot de passe) ; Nginx écrasant `X-Forwarded-For`, `trust proxy 1`.
- **Anomalies** : tout l'encadrement recevait le corrigé (`/corrections/:code`, corrigé et grille PDF, résultats agrégés) et pouvait noter et soumettre ; aucune distribution collective ; pas de code de secours, pas de « mot de passe oublié », pas de pages `/inscription` ; limitation sans `Retry-After`, ni comptage de requêtes, ni politique centralisée ; mots de passe triviaux acceptés ; pages de compte conservées par le service worker.

### Implémenté
- **Permissions** (D161) : `attempt.answerKey`, `attempt.grade`, `attempt.submit` = plein ; `attempt.transmit` = encadrement ; copie expurgée côté API (`answerKey`, notes non publiées à `null`), aussi dans la fiche routier ; administrateur exclu.
- **Saisie / transmission** : saisie provisoire et reprise par tout l'encadrement, transmission qui clôt la saisie (`POST /corrections/:code/transmit`), file `queue=saisie|correction`, page « Copies » (« Copies à corriger » pour le plein), validation de la note puis publication depuis la copie.
- **Distribution collective** (D163) : `GET /evaluations/:id/distribution`, `POST /paper-batches` (idempotent, 60 au plus), `GET /paper-batches/documents` (PDF collectif ou ZIP), page « Préparer une distribution » depuis le module, « Saisir les réponses » sur la fiche routier.
- **Bascule au papier** (D164) : `POST /corrections/:code/switch-to-paper`.
- **Comptes** (D162, D166) : code de secours à chaque lien, `/auth/activation/{verify,complete}`, `/auth/password-reset/{request,verify,complete}`, envoi SMTP facultatif (`nodemailer` 10.1.7), pages `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` (formulaire commun), `/activation` redirige les anciens liens, liens d'aide sur `/connexion`, dialogue du lien avec code et envoi réel signalé ; mots de passe courants refusés.
- **Limitation** (D165) : `RATE_LIMIT_POLICY`, `consume` atomique, `Retry-After`, portées récupération, code, renvoi, lots, documents ; Nginx : zones d'authentification étendues.
- **Hors ligne** : pages de compte jamais conservées (service worker `v5`), `no-referrer`, `no-store` ; distribution et documents groupés exclus du cache local.
- Migration additive `20261112090000_paper_transmission_activation_codes` (colonnes `transmitted_*`, `code_hash`, `code_failures` ; reprise des copies papier déjà saisies) appliquée sur `tesla_test` seulement ; dérive nulle.

### Vérifications exécutées
- Format, lint, types, build (API, web, shared) réussis ; `audit:prod` : 559 paquets, 0 vulnérabilité bloquante.
- Tests unitaires : API 207, web 76 réussis.
- Intégration PostgreSQL (`tesla_test`) : **144 tests (16 fichiers) réussis**, dont `account-recovery.int-spec.ts` (7 : lien, code, 5 essais, e-mail inconnu, compte désactivé, fiche conservée, récupération sans et avec SMTP simulé, sessions révoquées, expiration, 429 + `Retry-After`, requêtes simultanées, redémarrage, IP partagée, `X-Forwarded-For` ignoré, purge) et les scénarios D161, D163, D164 de `scouts-evaluations.int-spec.ts`.
- Recettes Chromium (API et web de production sur `tesla_test`, comptes fictifs) : comptes 11/11 à 320, 390, 1440 px ; circuit papier 7/7 à 320, 375, 390, 768, 1024, 1440 px (un défaut trouvé et corrigé : la distribution lisait la liste de l'éditeur, filtrée par auteur) ; balayage de l'interface 441 affichages, aucun problème.

### Non exécuté / limites
- SMTP réel jamais testé (transport simulé) ; Nginx et VPS non testés (configuration seulement) ; appareils réels, Safari, Firefox.
- **À arbitrer** : un chef qui rédige un questionnaire en voit les bonnes réponses dans l'éditeur (D161) ; les valeurs de limitation (D165) et la durée de 60 min (D166) sont des propositions.
- **À faire sur la base de développement** : `npm run db:deploy` (migration additive, non appliquée sur `tesla`).

## Entreprise routière et domaines d'action (2026-11-02)

Branche `feat/finalisation-entreprise-domaines`. Décisions D158–D160. Rapport avant/après et GO / NO-GO : [QUALITY/AUDIT_ENTREPRISE_DOMAINES_2026-11-02.md](QUALITY/AUDIT_ENTREPRISE_DOMAINES_2026-11-02.md).

### Réalisé
- `NT-ROUTE-M09` réécrit (8 → 13 leçons, sections comprendre → bilan, 15 parties du dossier, budget, étude de cas externe, boîte à outils) d'après le Guide de l'Entreprise Nikola Tesla, la fiche technique n° 7, l'ossature et le SAPF-Route.
- `NT-ROUTE-M10` : exactement dix leçons = `ACTION_DOMAINS` (`@tesla/shared`), rubriques complètes ; contrôle `DOMAINES_ACTION` / `DOMAINE_EN_DOUBLE` dans `pedagogy:audit`.
- Neuf fiches pratiques PDF (`PRACTICAL_SHEETS`, `GET /modules/:slug/sheets/:key/pdf`, carte « Fiches pratiques ») ; encadrés « Exemple » et « Précautions particulières ».
- Questionnaires M09 et M10 refaits (12 questions chacun) : 143 questions préparées.
- Base `tesla` : sauvegarde, révisions M09 (n° 4) et M10 (n° 3) appliquées aux brouillons intacts, réexécution sans écriture ; audit : 15 modules E, 0 bloquant, 25 notes.

### Vérifications exécutées
format, lint (0), typecheck, build : réussis · tests API 204 / web 76 · intégration 134 (15 fichiers) · recettes navigateur catalogue 8/8 et offline-first 28/28 (390 px).

### Non exécuté / restant
Publication (aucun plein désigné) ; suppression des 21 brouillons vides (par le plein, à la mise en service) ; appareils réels ; VPS OVH et R2 réels.

## Finalisation du catalogue pédagogique (2026-11-02)

Décisions D152–D157. Rapport avant/après et matrice des 36 modules : [QUALITY/AUDIT_PEDAGOGIQUE_2026-11-02.md](QUALITY/AUDIT_PEDAGOGIQUE_2026-11-02.md).

### Audit initial (base `tesla`)
36 modules, tous en brouillon, aucun publié ; 29 leçons vides (21 brouillons « Découvrir la Route », 8 dans `NT-SCOUT-M02`–`M04`) ; aucun questionnaire en base ; aucun responsable plein désigné ; `NT-SCOUT-M01`–`M04` « à classer ».

### Réalisé
- **Contenus** : 8 leçons vides rédigées (application de la loi, six éléments de la méthode scoute reliés au manuel SAPF-Route, exercice de transmission Morse) ; corrections vérifiées de « Base du scoutisme » consignées en note (D153) ; leçon « La cérémonie d'accueil » ; 11 leçons minces étoffées d'après le manuel ; classement (D156).
- **Questionnaires** : 139 questions (8 à 11 par module) avec leçon, niveau et explication dans le corrigé (D154).
- **Vérificateur** `npm run pedagogy:audit` (`prisma/seeds/pedagogy-audit.ts`) branché sur `pedagogy:release` (D155).
- **Révisions tracées** des brouillons importés intacts : `db:seed:pedagogy -- --mettre-a-jour`, table `module_source_revisions` (ajout seul), notes en vigueur lues par l'éditeur, l'approbation et la mise en service (D152). Migration additive `20261111090000_module_source_revisions`.
- **Lecture** : encadrés pédagogiques et références en pied de leçon (`lesson-structure.ts`, D157).
- **Base `tesla`** : sauvegarde `pg_dump` préalable, migration déployée (dérive nulle), révisions appliquées (15 modules), réexécution sans écriture ; audit : 15 modules prêts pour validation, 0 anomalie bloquante.

### Vérifications exécutées
- `npm run format:check`, `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (sans `NODE_ENV` exporté) : réussis.
- `npm run test` : API 193 tests (23 fichiers), web 75 tests (7 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **132 tests (14 fichiers) réussis**, dont `test/catalogue-finalisation.int-spec.ts` (révision d'un brouillon intact, refus si une personne l'a modifié, ajout seul, audit et blocage de la mise en service) ; 3 tests existants adaptés au catalogue complété.
- Recettes navigateur (Chromium headless, Playwright 1.64.1 hors dépôt, API et web de production sur `tesla_test`, 390 px) : offline-first **28 contrôles réussis** ; catalogue publié (`apps/web/test/catalogue-lecture.browser.mjs`, fixture `apps/api/test/catalogue-browser-fixture.mts`) **6 contrôles réussis** — bibliothèque sans brouillon, encadrés et références, navigation, questionnaire sans corrigé, lecture sans réseau, aucun défilement horizontal.

### Non exécuté / restant
- **Publication sur `tesla`** : aucun responsable plein en fonction ; aucune approbation n'a été produite par l'agent. Procédure : rapport d'audit § 4.
- 22 points de validation humaine (rapport d'audit § 3) ; contrôle réseau des liens (`--liens`) non exécuté (aucun lien externe dans le catalogue) ; passation complète d'un questionnaire du catalogue en navigateur et appareils réels non testés ; balayage d'interface `ui-sweep` non relancé.

## Consolidation production (2026-11-02)

Branche `chore/tesla-production-hardening`. Détails : [PRODUCTION_AUDIT.md § 5](PRODUCTION_AUDIT.md#5-audit-de-consolidation-du-2026-11-02), décisions D145–D151.
- **Hors ligne** : phrase oubliée (effacement explicite), verrou inter-onglets, mise à niveau IndexedDB, échéance de réservation, alerte d'effacement du stockage, coupures sans consommation d'essai, reprise de lecture.
- **Pédagogie** : rattrapage limité aux modules encore obligatoires (P1) ; acquittement des points « à vérifier » à l'approbation et dans `pedagogy:release` (`--notes-verifiees`).
- **R2** : purge des envois abandonnés sans course avec une confirmation ; sauvegarde en échec si les fichiers ne sont pas copiés.
- **Exploitation** : `bootstrap.sh` (installation Ubuntu 24.04 idempotente), Nginx compatible 1.24 et paramétré par instance, certificat en deux temps, page de maintenance, alertes `OnFailure`, releases `HEALTHY`/`FAILED`, CI `ops`.
- **Interface** : trois débordements mobiles corrigés, accueil du routier réordonné, libellés métier ; balayage navigateur automatisé.
- Vérifications : suite complète verte (187 + 72 unitaires, 129 intégration), recettes et balayage navigateur ; non exécutés : VPS, R2 réel, appareils réels, CI GitHub.

## Réalisé et vérifié

| Élément | Vérification effectuée |
| --- | --- |
| Monorepo, lint, typecheck, tests, build | Les quatre commandes racine passent (2026-10-29, après la phase 3) |
| API : préfixe `/api/v1`, config Zod, CORS, filtre d'erreurs, journalisation, Swagger | Démarrage réel ; `/health` |
| PostgreSQL 18 (Docker, port 5433), Prisma 7, 6 migrations | `db:deploy` sur la base de développement et `tesla_test` ; diff base ↔ schéma vide ; migration 6 rejouée sur une base jetable avec données historiques |
| **Authentification** : login/logout/me, Argon2id, sessions httpOnly, expiration, révocation, limitation, CSRF, garde globale | Tests unitaires + intégration HTTP ; recette navigateur |
| **Équipes, routiers, affectations, observations** (phase 1) | Intégration HTTP ; recette navigateur (phase 1) |
| **Modules, rédaction, workflow, bibliothèque** (phase 2) | Intégration HTTP ; recette navigateur (phase 2) ; suite rejouée sans régression |
| **Questionnaires** : 5 types de questions, barèmes, crédit partiel, versions, workflow d'approbation, publication atomique, cohérence avec le module (migration `20261030090000_evaluation_engine`) | Intégration HTTP + triggers ; recette navigateur |
| **Passation en ligne** : éligibilité serveur, déblocages, démarrage idempotent, sauvegarde, remise unique, correction objective | Intégration HTTP (dont requêtes concurrentes) ; recette mobile 390 px |
| **Papier** : routier sans compte, codes `NT-AAAA-NNNNNN` sous concurrence, réimpression sans tentative, PDF questionnaire / corrigé / grille | Intégration HTTP (texte des PDF contrôlé) ; recette ; rendu visuel des trois PDF |
| **Correction et examen** : notation humaine, révision optimiste, soumission, acceptation, nouvelle correction motivée, aucun changement d'étape | Intégration HTTP ; recette |
| **Historique du routier** (`/mes-resultats`) et résultats conservés après une nouvelle publication | Intégration HTTP ; recette |

### Tests exécutés (2026-10-29)
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 81 tests (15 fichiers, dont 27 pour les évaluations : contrats, moteur de correction, éligibilité), web 9 tests (2 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (base `tesla_test`) : 47 tests (4 fichiers) — réussis. Nouveau fichier `test/evaluations.int-spec.ts` (5 tests couvrant les 20 exigences de la phase et les deux parcours) ; `test/scouts-evaluations.int-spec.ts` adapté au nouveau modèle (15 tests, mêmes garanties).
- Recette navigateur (script hors dépôt, Chromium headless, API et web de production locaux sur la base jetable `tesla_test`, comptes fictifs) — 23 contrôles réussis : création d'un questionnaire et de deux questions par un chef, soumission, approbation refusée au chef (403), approbation et publication par le responsable ; routier : liste, éligibilité, passation mobile 390 px sans corrigé dans la page, remise ; correction automatique de la question objective, notation de la réponse libre, soumission ; examen et acceptation ; résultat visible dans « Mes résultats » ; papier : routier sans compte, code unique, PDF téléchargé et réimprimé sans nouvelle tentative, corrigé refusé à un routier, saisie et correction, examen, étape inchangée ; trois écrans sans défilement horizontal à 390 px. Deux défauts trouvés par la recette et corrigés (changement de type de question, relance du démarrage après remise). Aucune donnée ajoutée à la base de développement.

## Partiel ou non vérifié
- **Lecteurs d'écran, contraste mesuré** : non audités avec un outil dédié.
- **Navigateurs réels (Safari iOS, Android)** : non testés ; seulement Chromium headless.
- **Swagger** : documentation générée ; rendu de `/api/docs` non revu manuellement.
- **PDF** : caractères hors Windows-1252 remplacés par « ? » ; questionnaire de plusieurs pages non recetté visuellement.
- **Avertissement `pg`** « client.query() when the client is already executing a query » émis pendant certains tests d'intégration (interpréteur de requêtes de Prisma 7) ; sans effet aujourd'hui ; à surveiller avant `pg@9`.
- **CI GitHub Actions** : intégration, migrations et recettes configurées (2026-10-30) ; non exécutée (aucun push).
- `REFUSEE` et la réouverture d'un résultat examiné : disponibles dans l'API, sans bouton dans les écrans.

## Non développé
Envoi des liens de compte par e-mail, changement de rôle d'accès d'un compte, téléversement des copies numérisées (le stockage objet existe, D143 ; catégorie et conservation à décider), support de cours en PDF serveur, progression de lecture synchronisée avec le serveur, consultation du journal d'audit complet, déploiement. Voir [ROADMAP.md](ROADMAP.md).

## Phase 4 — progression, compétences, activités et pilotage (2026-10-29)

- Dossier pédagogique complet et historique immuable des étapes, avec décisions transactionnelles du responsable et corrections tracées.
- Référentiel de compétences administrable, propositions justifiées, complément/refus/approbation réservés au responsable, révocation motivée. Aucun acquis automatique.
- Modules étudiés (papier, collectif et numérique), routiers avec ou sans compte ; déclarations personnelles explicites.
- Programme annuel : catégories distinctes des étapes, correspondances à confirmer, import Markdown prévisualisé et idempotent, conservation des modifications manuelles.
- Activités : préparation, réalisation/report/annulation, compte rendu, liens vers modules et compétences, historique ; présences groupées, sans absence implicite.
- Tableaux de bord par rôle, statistiques filtrées par équipe, étape et période ; parcours personnels progression/compétences/activités.
- Sept migrations synchronisées sur les bases locales `tesla` et `tesla_test` ; aucune réinitialisation de la base de développement. Références initialisées sans compte de démonstration. Diff Prisma/base vide.

Détails fonctionnels et vérifications : [rapport de livraison](FEATURES/PHASE_4_REPORT.md), [progression](FEATURES/PROGRESSION.md), [compétences](FEATURES/COMPETENCES.md), [programme](FEATURES/PROGRAMME_ANNUEL.md), [activités](FEATURES/SUIVI_ACTIVITES.md), [tableaux de bord](FEATURES/DASHBOARDS.md).

Limites : source officielle des séances absente du dépôt ; référentiel de compétences et correspondances à valider humainement. Gestion structurée séparée des actions d'accompagnement à échéance (les observations et propositions restent utilisables). Le build Turbopack est bloqué par l'environnement ; compilation Webpack vérifiée. Le seuil d'affichage des absences reste provisoire (D74).

Vérifications phase 4 : lint et types réussis ; 106 tests API et 9 web réussis ; suite PostgreSQL 61 tests réussis, puis 14 scénarios phase 4 rejoués après le correctif du compte rendu ; build API et web Webpack réussis ; recette Chromium mobile : 19 contrôles réussis. Détails et limites dans le rapport.

## Phase 5 — PWA hors ligne (2026-10-29)

Implémenté (détails : [OFFLINE_FIRST.md](OFFLINE_FIRST.md), décisions D76–D83) :
- Coffre IndexedDB v2 chiffré (AES-GCM, phrase locale), un enregistrement par module et par tentative, révision optimiste entre onglets, verrouillage à la déconnexion et entre onglets.
- Téléchargement de tout module publié : paquet versionné avec empreinte SHA-256, images bornées, ressources externes signalées indisponibles, écriture atomique, suppression locale, vérification et mise à jour explicite des versions.
- Lecture hors ligne : leçons, navigation, images, références, position de lecture.
- Évaluations : préparation serveur (éligibilité, dérogation, limite, tentative ouverte), réservation `HORS_LIGNE` de 24 h sans corrigé, saisie et reprise locales, remise locale immuable.
- Synchronisation : file persistante bornée (6 envois automatiques, 5 s × 2ⁿ ≤ 30 min), déclenchements réseau/ouverture/premier plan/manuel ; réception transactionnelle et idempotente, revérification des droits, correction serveur, conflits et rejets motivés ; écrans de statut.
- Service worker `v2` : coquille `/hors-ligne` pré-cachée, `/api` et `/connexion` exclus. Relance des requêtes en erreur au retour du réseau (défaut trouvé par la recette).
- Migration additive `20261101090000_offline_reservations`, appliquée sur `tesla` et `tesla_test` ; diff schéma ↔ base vide.

Vérifications exécutées :
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web, Turbopack) : réussis. `prettier --check` : seul `apps/api/prisma/seed.ts` signalé, fichier antérieur non modifié.
- `npm run test` : API 106 tests (16 fichiers), web 13 tests (3 fichiers, dont 4 hors ligne : schéma strict refusant un score, extraction d'images, SHA-256, temporisation) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 65 tests (5 fichiers) réussis, dont 3 scénarios hors ligne (+1 paquet de module) : préparations concurrentes, absence de corrigé, chef refusé, autre routier refusé, passation en ligne refusée, schéma invalide, conflit de paquet, double envoi concurrent sans doublon, autre copie refusée, correction serveur, étape inchangée, statut personnel, session expirée (401), hors progression refusé, dérogation valide puis révoquée, autorisation expirée, nouvelle publication sans effet sur la version réservée.
- Recette navigateur `apps/web/test/offline.browser.mjs` (fixture `apps/api/test/offline-browser-fixture.mts`, API et web de production locaux sur `tesla_test`, Chromium headless Playwright 1.64.1, fenêtre 390 px) : **13 contrôles réussis** — activation du coffre, téléchargement, préparation, cache sans API ni connexion, saisie sans réseau, fermeture puis réouverture hors réseau, remise locale immuable, lecture et position conservées, verrouillage et mauvaise phrase, reconnexion et synchronisation répétée sans doublon, absence de texte en clair dans IndexedDB, suppression du module sans perte de copie, déconnexion verrouillant les données, pas de défilement horizontal.

Non vérifié ou non couvert par un test automatisé :
- Appareils réels et navigateurs autres que Chromium headless (Chrome Android, Safari iOS, Edge, Firefox) ; installation PWA ; éviction du stockage ; redémarrage complet du navigateur (seule la fermeture/réouverture d'onglet est testée).
- Téléchargement interrompu, image en échec, quota insuffisant et erreur serveur 5xx temporaire : logique implémentée, sans test automatisé dédié.
- Proposition de mise à jour d'un module téléchargé : non recettée dans le navigateur.
- Arbitrages D78 (durée, rejet ou mise en attente, conservation serveur des copies rejetées) et ouverture du mode hors ligne aux chefs.
- Playwright n'est pas une dépendance du dépôt (exécutable fourni par variable d'environnement) ; recette non intégrée à la CI.

## Seed pédagogique « Bases du scoutisme » (2026-10-29)

Implémenté (détails : [SEEDS_PEDAGOGIQUES.md](SEEDS_PEDAGOGIQUES.md), décisions D84–D85) :
- Quatre modules `NT-SCOUT-M01` à `M04`, 21 leçons (8 vides, à rédiger), étapes recommandées Noviciat/Apprentissage, tous en `BROUILLON`, créés par le système (auteur nul), jamais approuvés ni publiés ; aucun questionnaire créé.
- Import transactionnel par module, réexécution sans écriture avec rapport d'écarts, prévisualisation `--dry-run`, commandes `npm run db:seed` et `npm run db:seed:pedagogy`.
- Migration additive `20261102090000_module_source_imports` appliquée sur `tesla` et `tesla_test` ; diff schéma ↔ base vide. Seed exécuté sur `tesla` (4 créations), puis réexécuté (aucune écriture).
- Provenance et notes éditoriales visibles dans l'éditeur et la révision, absentes de la bibliothèque, du paquet hors ligne et de l'impression.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 115 tests (17 fichiers, dont 9 pour la définition du seed), web 13 tests — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis, dont 6 nouveaux (`test/pedagogy-seed.int-spec.ts`) : quatre modules en brouillon et ordre des leçons, aucun accès routier, prévisualisation sans écriture, réexécution sans doublon ni écriture, modification du responsable conservée, leçon vide bloquant la soumission, publication humaine non remplacée et écarts de source signalés, slug occupé, CHECK et trigger d'ajout seul.
- Contrôle ponctuel (hors dépôt) : chaque texte de leçon retrouvé dans le texte extrait du PDF, hors ajouts éditoriaux listés.

Non vérifié : rendu visuel de l'encart de provenance (pas de recette navigateur) ; transcription de l'alphabet Morse relue à l'œil uniquement ; manuel SAPF-Route et programme annuel absents du dépôt.

## Phase 6 — navigation par rôle, UX et stabilisation (2026-10-29)

Implémenté (détails : [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md), [QUALITY/UX_UI_AUDIT.md](QUALITY/UX_UI_AUDIT.md), [QUALITY/ESLINT_AUDIT.md](QUALITY/ESLINT_AUDIT.md), décisions D86–D90) :
- Orientation automatique par rôle (`lib/navigation.ts`) : connexion, `/`, `/connexion` déjà connecté, rechargement, session restaurée ; `?suivant=` limité aux pages internes autorisées ; route non autorisée → notification et tableau de bord ; session expirée en cours d'usage → connexion avec retour.
- Menu unique groupé par rôle et cadre commun (`(espaces)/layout.tsx`) : sidebar desktop, menu latéral mobile, barre d'accès rapides du routier. Écran de choix d'espace supprimé.
- Aucun modèle multirôle : le responsable dispose déjà de toutes les permissions des chefs (D86).
- Tableaux de bord refondus sur les données réelles de l'API ; titres de page en `h1` ; service worker `v3`.
- Lint : 1 erreur → 0 (aucune règle désactivée).
- Aucune modification de l'API ni du schéma ; aucune migration.

Vérifications exécutées :
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 115 tests (17 fichiers), web 40 tests (4 fichiers, dont 27 nouveaux dans `navigation.test.ts` : destination par rôle, absence de boucle, accès par chemin, redirections externes refusées, entrées de menu existantes, autorisées et sans doublon).
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis.
- Recette navigateur (script hors dépôt, Chromium headless, API et web de production sur `tesla_test`, comptes fictifs) : **21 contrôles réussis** — accueil sans choix d'espace ; routier, chef et responsable dirigés vers leur tableau de bord ; rechargement ; `/` et `/connexion` déjà connecté ; route interdite ; menu mobile et barre d'accès rapides ; retour navigateur ; écran hors ligne ; déconnexion puis accès direct ; `?suivant=` interdit ignoré, autorisé conservé ; responsable sur les écrans des chefs sans changement de menu ; accès direct par URL ; 390 px et 820 px sans défilement horizontal ; session révoquée côté serveur puis reconnexion vers la page demandée ; aucune erreur JavaScript.
- Recette hors ligne `apps/web/test/offline.browser.mjs` rejouée : 13 contrôles réussis (étape de déconnexion adaptée au menu latéral mobile).

Non vérifié : appareils réels (Android, iOS), lecteurs d'écran, contraste mesuré ; parcours métier complets (création de module, approbation, correction) seulement couverts par les tests d'intégration API et non rejoués dans le navigateur pendant cette phase ; « Mon profil », « Utilisateurs et accès » et « Paramètres » non développés.

## Parcours du responsable et des chefs (2026-10-29)

Implémenté (détails : [FEATURES/DASHBOARDS.md](FEATURES/DASHBOARDS.md), [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md), décisions D91–D92) :
- `/responsable` et `/chef` : bandeau d'accueil, actions rapides, file « À faire maintenant » (éléments réels avec ancienneté et lien vers l'écran qui porte l'action), frise de l'année (programme, jalons, prochaine activité) ; indicateurs en bas de page.
- API : champs `tasks`, `taskTotal` et `year` ajoutés aux deux tableaux de bord (ajout compatible ; aucune migration, aucune nouvelle permission).
- Menu : groupes secondaires repliables ; séparation contenus / personnes conservée.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis.
- `npm run test` : API 115 tests (17 fichiers), web 44 tests (4 fichiers, dont `formatWaiting` et le groupe du tableau de bord jamais repliable) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 71 tests (6 fichiers) réussis, dont les nouvelles assertions sur `tasks` (types, tri, périmètre du chef) et `year` (activités hors programme exclues des jalons, prochaine activité).

Non vérifié :
- Recette navigateur (rendu desktop et 390 px, repli du menu au clavier) : non exécutée.
- Tâches « module / questionnaire renvoyé » et « copie papier » : couvertes par le typage, sans test d'intégration dédié.
- Frise avec un programme réel importé : non recettée visuellement.

## Accueil, connexion et animations (2026-10-29)

Implémenté : accueil et connexion refondus ; animations CSS (`globals.css` : `animate-rise`, `animate-halo`, `animate-drift`, `animate-shake`, `animate-pop`, `animate-grow`, conteneur `.stagger`) sur toutes les tailles d'écran ; `PageTransition` dans le cadre connecté ; menu, barre du routier, boutons, alertes, lignes de tableau et états vides animés. `PasswordInput` (afficher/masquer) sur la connexion et la phrase du coffre hors ligne. Aucune modification de l'API.

Vérifications exécutées : `npm run lint`, `npm run typecheck`, tests web (44) et build web réussis. Captures Chromium headless (serveur de production local, sans API) de l'accueil et de la connexion en 390 px et 1366 px : aucun défilement horizontal, bascule d'affichage du mot de passe fonctionnelle, alerte affichée lorsque l'API est injoignable ; bascule afficher/masquer contrôlée sur `/connexion` et `/hors-ligne` (type du champ et `aria-pressed`).

Non vérifié : animations des écrans connectés (cadre, tableaux de bord, menu latéral) dans un navigateur ; appareils réels ; fluidité sur téléphone d'entrée de gamme.

## Refonte — parcours Route et mandats (2026-10-29)

Branche `feat/refonte-parcours-route-mandats`. Détails : [REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) (audit, matrice de traçabilité), [FEATURES/PROGRESSION_PAR_AGE.md](FEATURES/PROGRESSION_PAR_AGE.md), [FEATURES/RATTRAPAGE.md](FEATURES/RATTRAPAGE.md), [FEATURES/MANDATS_RESPONSABLES.md](FEATURES/MANDATS_RESPONSABLES.md), décisions D93–D107.

Implémenté :
- Moteur d'âge pur et déterministe (Abidjan, 29 février, mois calendaires), référentiel d'âge versionné et figé, version `2026.1` limitée aux deux règles fournies.
- Étape théorique, étape officielle et écart distincts ; échéances ; sortie à 21 ans calculée à la lecture et enregistrée par un traitement idempotent (`MembershipService`, `npm run jobs:daily -w @tesla/api`), historique intégralement conservé.
- Plans de rattrapage idempotents, statuts calculés, décision humaine motivée ; éligibilité `ELIGIBLE_RATTRAPAGE` et `SORTI_BRANCHE`.
- Rôles d'accès `ROUTIER`/`ENCADREMENT`/`ADMINISTRATEUR`, fonctions par mandats annuels (un seul plein, reconductions illimitées et explicites, fins anticipées, changements de fonction), délégations ; permissions recalculées à chaque requête, exposées par `/auth/me`.
- Typologie des modules (catégorie, obligation, source officielle) dans le workflow existant ; catalogue « Découvrir la Route » (21 brouillons, aucun contenu inventé).
- Web : espace unique `/encadrement` (anciennes URL redirigées), menu filtré par permissions, `/mandats`, `/mes-rattrapages`, `/administration/referentiel-age`, bloc « Mon parcours », section parcours de la fiche, indicateurs de parcours, filtre de catégorie de la bibliothèque, formulaire de typologie.
- Deux migrations additives appliquées sur une copie (`tesla_refonte_check`), puis `tesla_test` et `tesla` ; diff schéma ↔ base vide. Seed exécuté sur `tesla` (référentiel `2026.1`, 21 brouillons), réexécution sans écriture vérifiée.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 146 tests (18 fichiers ; nouveaux : moteur d'âge, statut et origine des rattrapages, écart d'étapes, éligibilité, fonctions et délégations, synchronisation des enums), web 57 tests (4 fichiers ; navigation réécrite pour les nouveaux profils) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **79 tests (7 fichiers) réussis**, dont 71 existants adaptés au nouveau modèle et 8 nouveaux (`test/refonte.int-spec.ts`) : reprise des anciens comptes sans droit officiel, un seul plein (service et contrainte), auto-nomination refusée, dix reconductions successives, retour d'un ancien plein, immutabilité, fin anticipée et perte immédiate des droits, changement de fonction, délégation limitée et révocation, étape théorique sans et avec référentiel, inscription tardive et rattrapage idempotent, décision humaine, sortie à 21 ans (veille/jour, idempotence, historique conservé), typologie et catalogue sans doublon ni exposition aux routiers.

Non vérifié :
- **Recette navigateur** des nouveaux écrans (`/mandats`, `/mes-rattrapages`, fiche, tableau de bord, bibliothèque) : non exécutée ; rendu mobile non contrôlé visuellement.
- Traitement `jobs:daily` : non exécuté en conditions réelles (logique couverte par les tests d'intégration via `MembershipService` et `PathwayService`) ; aucune planification (cron) installée.
- Création d'un référentiel d'âge par l'interface : API seulement (pas de formulaire web).
- Libellés « chef » / « responsable » subsistant dans certains textes d'écrans antérieurs (sens inchangé : encadrement / personne habilitée).
- Base jetable `tesla_refonte_check` laissée en place (suppression non effectuée sans autorisation).

### Mise en service
1. Sauvegarder la base, puis `npm run db:deploy -w @tesla/api` (deux migrations, additives).
2. Créer le premier compte d'administration technique : `admin:create` (lien d'activation à usage unique, voir [DEPLOYMENT.md](DEPLOYMENT.md) § 3).
3. Dans `/mandats` (administration technique) : déclarer l'année scoute en cours, puis consigner la nomination du responsable plein avec l'autorité de nomination. **Jusque-là, aucune décision officielle n'est possible** (D107).
4. Le responsable plein consigne l'adjoint et les assistants, résout les comptes « sans mandat », et délègue si nécessaire.
5. Renseigner les dates de naissance manquantes (indicateur du tableau de bord).
6. Planifier `npm run jobs:daily -w @tesla/api` une fois par jour (après `npm run build`).
7. Faire valider les points `A_VALIDER` et fournir les références manquantes ([REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) § 4).

## Sobriété des interfaces (2026-10-29)

Nettoyage du frontend, sans changement de règle, de workflow, de permission ni d'API (D108) :
- Badge « Serveur opérationnel · vX » retiré de la sidebar, de l'en-tête mobile et de l'accueil (composant `ApiStatus` et requête `health` côté web supprimés ; endpoint `/api/v1/health` inchangé).
- `PageHeading` et `EmptyState` : description facultative. ~30 descriptions de page supprimées ou réduites à la règle utile ; ~25 états vides « … apparaîtront ici » allégés.
- Menu : libellés courts (« Progression », « Résultats », « Responsables », « Décisions »…), rôle interne retiré du pied de menu.
- Tableaux de bord : sous-titres de cartes, surtitre décoratif et indications redondantes retirés ; files d'action, échéances, alertes et indicateurs conservés.
- Hors ligne : statuts de synchronisation traduits (plus de code brut), jargon technique retiré ; avertissements de délai, d'effacement et de confidentialité conservés.
- Erreurs réseau génériques : « Connexion impossible. Vérifiez votre réseau, puis réessayez. » / « Une erreur est survenue. Réessayez. »

Conservé volontairement : règles de validation humaine, avertissements d'irréversibilité, confidentialité des observations et des corrigés, échéances, conflits d'édition, formats de saisie (matricule, code de tentative).

Vérifications : lint, typecheck, `npm run test` (API 146, web 57) et build web réussis. Accueil et connexion contrôlés en Chromium headless à 390 et 1280 px (aucun défilement horizontal). **Non exécuté** : recette visuelle des écrans connectés (identifiants de démonstration non disponibles dans cette session).

## Offline-first global (2026-10-30)

Branche `feat/offline-first-global` (non commitée, non poussée). Référence : [OFFLINE_FIRST.md](OFFLINE_FIRST.md) (matrice des fonctionnalités § 2), décisions D109–D117.

Implémenté :
- Lecture offline-first de tous les écrans par `apiFetch` (copie chiffrée par compte, date des données affichée) ; session sans réseau par identité locale bornée (14 jours, fin de mandat) ; déverrouillage local sur la connexion et dans le cadre.
- Coffres par compte (tous les rôles), compatibles avec le coffre de la phase 5 ; déverrouillage conservé 12 h ; changement de compte.
- Préparation de l'appareil (`/appareil`) par rôle : données autorisées, pages et segments RSC, rapport « Prêt » / « Préparation incomplète », vérification sans réseau.
- Service worker `v4` : pages, charges RSC, ressources statiques ; repli `/hors-ligne` réservé aux pages jamais préparées ; mise à jour proposée.
- File d'opérations globale (présences, activités, observations, fiches, affectations) : identifiants provisoires, dépendances, fusion, rebasage, affichage provisoire, conflits, réessai et abandon confirmé.
- API : idempotence générique (`client_operations`, migration additive `20261030085910_client_operations` appliquée sur `tesla` et `tesla_test`), versions de référence facultatives (fiche, équipe, présences), `authorityValidUntil` dans `/auth/me`.
- Évaluations : préparation et passation hors ligne dans les écrans habituels ; onglet « Hors ligne », `OfflineHub` et `OfflineReader` supprimés (`/telechargements`, `/synchronisation` → `/appareil`).

Vérifications exécutées (2026-10-30) :
- `npm run lint`, `npm run typecheck`, `npm run build` (API, web) : réussis.
- `npm run test` : API 146 tests (18 fichiers), web 69 tests (5 fichiers, dont 13 offline-first : clés du dépôt, exclusions, identité locale et fin de mandat, identifiants provisoires, classement des échecs, fusion, rebasage, affichage provisoire, absence de décision officielle différable) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 85 tests (8 fichiers) réussis, dont `offline-sync.int-spec.ts` (6) : rejeu sans doublon, identifiant réutilisé ou d'un autre compte refusé, permissions revérifiées et réservation libérée, réception non confirmée, conflits de présence, de fiche et d'équipe, échéance des habilitations.
- Recette navigateur `apps/web/test/offline-first.browser.mjs` (Chromium headless Playwright, profil persistant, API et web de production sur `tesla_test`, comptes fictifs) : **28 contrôles réussis à 390 px et à 1280 px**, aucune erreur JavaScript — scénarios 1 à 25 de la mission (hors 26–27), sans aucune redirection vers `/hors-ligne`.

Non vérifié :
- Appareils réels (Android, iOS), Safari, Firefox, Edge ; installation PWA depuis l'écran d'accueil ; éviction réelle du stockage.
- Scénarios 26 (21 ans) et 27 (fin de mandat) hors connexion : couverts par tests unitaires (identité locale) et règles serveur existantes, pas par la recette navigateur.
- Création d'activité et de fiche hors ligne, changement d'équipe hors ligne : couverts par la logique commune et les tests d'intégration de conflits, non recettés dans le navigateur.
- Bouton « Mettre à jour » lui-même : le mécanisme (activation, repli de rechargement, conservation des opérations) est recetté, le clic sur le bouton non.
- Recette non intégrée à la CI (Playwright hors dépôt).

À arbitrer : durées D111 (12 h), D112 (14 jours), D117/D78 (24 h) ; purge des `client_operations`.

## Préparation à la production (2026-10-30)

Branche `chore/preparation-production` (commits atomiques, non poussée). Audit : [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) ; bilan et décision : [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) ; décisions D118–D123.

Implémenté :
- **Comptes** (API `/users`, `/auth/account-link/*`, `/auth/password`, `/auth/profile`, `/auth/sessions*` ; écrans `/activation`, `/compte`, `/administration/comptes`, « Créer son compte » sur la fiche) ; commande `admin:create` ; migration additive `20261104090000_account_lifecycle` (`account_tokens`, `auth_throttles`) appliquée sur `tesla_test` uniquement.
- **Sécurité** : limitation persistante, en-têtes, `no-store`, journaux sans chaîne de requête, `API_HOST`, délégation liée au mandat du délégataire, coffre d'un autre compte verrouillé avant lecture.
- **Offline-first** : lectures strictes (préparation, téléchargement), pas de fusion après envoi interrompu, pages de fiche préparées, boucle de redirection supprimée, pas de rechargement à la première installation du service worker.
- **Exploitation** : `deploy/` (systemd, Nginx, scripts), [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
- **CI** : jobs `quality` (+ formatage, audit), `integration`, `browser` ; [TEST_PLAN.md](TEST_PLAN.md).

Vérifications exécutées : format, lint, types, build réussis ; tests unitaires API 144 et web 74 ; intégration 94 (9 fichiers) ; dérive migrations nulle ; `audit:prod` 0 vulnérabilité (532 paquets) ; recettes Chromium offline-first 28/28 et comptes 9/9 à 390 et 1280 px ; sauvegarde, restauration d'essai, restauration, refus d'écrasement et détection d'altération sur `tesla_test`.

Non exécuté : workflow GitHub, VPS (systemd, Nginx, Certbot, rclone), appareils réels, Safari, Firefox.

**À faire sur la base de développement** : `npm run db:deploy` (migration additive des comptes, non appliquée sur `tesla` par cet audit).

## Bibliothèque de formation à la Route (2026-10-30)

Branche `feat/bibliotheque-route` (créée depuis `chore/preparation-production`, non poussée). Décisions D124–D128.

### Audit initial (avant modification)
- **Fonctionnel** : modules versionnés et workflow d'approbation, leçons (JSON liste blanche), ressources par URL, collaborateurs, archivage, historique ; bibliothèque (filtres étape, thème, catégorie), lecteur, impression A4 navigateur, téléchargement hors ligne ; questionnaires, papier, routiers sans compte ; référentiel d'âge `2026.1`, rattrapages, sortie à 21 ans ; import documentaire idempotent (`--dry-run`, provenance en ajout seul).
- **Contenus existants** : 4 modules « Bases du scoutisme » (`NT-SCOUT-M01–M04`, 8 leçons vides) et 21 brouillons vides « Découvrir la Route », tous non modifiés depuis l'import.
- **Manquant** : manuel SAPF-Route exploité, contenus de formation à la Route, textes fondamentaux, liens entre modules, duplication.
- **Bloqué par une règle non validée** : âges des étapes après le noviciat, sens du tableau synoptique, modules obligatoires, conditions de cérémonie (voir [REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) § 5).

### Implémenté
- Manuel `SAPF-Route (2).pdf` versé dans `docs/sources/` ; matrice manuel ↔ moteur ; aucun changement du référentiel d'âge (D124).
- Seed `route-bibliotheque.seed.ts` : Prière de la Route (texte fondamental, version rédactionnelle à valider, original en provenance) et modules `NT-ROUTE-M03` à `M12` (71 leçons rédigées d'après les sources) en brouillon ; modules 01–02 = `NT-SCOUT-M01/M02` (D126).
- Catégorie `TEXTE_FONDAMENTAL` et liens `module_text_links` (API `GET /editor/texts`, `PUT /editor/modules/:id/texts` ; carte dans l'éditeur ; « Textes fondamentaux » sur la fiche publique ; recopie dans les nouvelles versions) (D125).
- Duplication d'un module (`POST /editor/modules/:id/duplicate`, bouton « Dupliquer ») (D127).
- Migration additive `20261105090000_fundamental_texts` appliquée sur `tesla_test`, puis sur `tesla` après sauvegarde ; dérive nulle sur les deux bases. Seed exécuté sur `tesla` (11 créations) puis réexécuté sans écriture.

### Vérifications exécutées
- `npm run lint` (0 problème), `npm run typecheck`, `npm run build` (API et web) : réussis. Le build web échoue au prérendu si `NODE_ENV=development` est exporté depuis `.env` dans le shell ; réussi sans cette variable (comportement antérieur, sans lien avec cette phase).
- `npm run test` : API 152 tests (19 fichiers, dont 8 nouveaux sur la définition du catalogue), web 74 tests — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **100 tests (10 fichiers) réussis**, dont 6 nouveaux (`test/bibliotheque-route.int-spec.ts`) : import en brouillon sans publication, sans questionnaire ni obligation, prière liée et stockée une seule fois, aucun contenu de Charte ; prévisualisation sans écriture, réexécution sans doublon, modification humaine conservée ; module citant un texte non importé ignoré ; texte cité invisible avant sa publication puis visible, rubrique par catégorie, lien figé hors brouillon (trigger) et recopié dans la version 2 ; création d'un texte « Charte » par l'administration, association, refus (module ordinaire, auto-citation, chef non autorisé, routier) ; duplication (original inchangé, obligation non reprise, audit).
- Correction d'un test existant (`modules.int-spec.ts`) qui supposait un code module à exactement 3 chiffres alors que la séquence de `tesla_test` dépasse 999 (format réel : 3 chiffres au moins).

### Non vérifié / non développé
- **Recette navigateur** des nouveaux écrans (carte « Textes fondamentaux cités », bouton « Dupliquer », fiche publique) : non exécutée.
- Dépôt du PDF de la Charte, extraction et prévisualisation automatiques (D128) ; textes cités absents de l'aperçu, de l'écran de révision et de la version imprimable ; mention des textes cités dans le paquet hors ligne (volontairement inchangé).
- Questionnaires d'entraînement : aucun créé (à construire dans le workflow des évaluations).
- Améliorations d'interface de la phase 10 (vue « modules recommandés / antérieurs / facultatifs / déjà étudiés », file « contenus sans source validée ») : non développées ; l'existant (badge « Recommandé pour votre étape », filtres, études déclarées, `/mes-rattrapages`) est inchangé.
- Contenus à compléter et points à valider : [CATALOGUE_PEDAGOGIQUE_INITIAL.md](CATALOGUE_PEDAGOGIQUE_INITIAL.md) § 3.

### Complément — mise en service, questionnaires, PDF (2026-10-30, D129–D131)
Demande du responsable : supprimer les modules vides, rendre les autres utilisables, un questionnaire pour chacun, cours téléchargeable aux couleurs de la communauté.
- Migration `20261106090000_purge_empty_module_drafts` (fonctions et triggers uniquement, aucune donnée modifiée) : suppression d'un brouillon vide par `purge_empty_module_draft` ; API `POST /admin/modules/:id/purge`, bouton « Supprimer ce brouillon vide », audit `module.purged`.
- Commande `npm run pedagogy:release` (`prisma/seeds/release-catalog.ts`) : brouillons importés vides supprimés, leçons vides retirées, modules soumis, approuvés et publiés, 14 questionnaires d'entraînement publiés — au nom du responsable plein en exercice, via les services de l'API. Catalogue « Découvrir la Route » retiré du seed.
- Support de cours PDF (`GET /modules/:slug/pdf`, bouton « Télécharger le cours (PDF) ») : page de garde au logo et au nom de la communauté, en-tête et pied de page sur chaque page. Identité PDF commune extraite dans `src/common/pdf-brand.ts` (réutilisée par les feuilles papier). `resolveAuthority` exporté pour les commandes serveur.

Vérifications exécutées : `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` (sans `NODE_ENV` exporté) réussis ; `npm run test` : API 155 tests (21 fichiers, dont rendu PDF et validité des 14 questionnaires), web 74 — réussis. Contrôle du texte extrait d'un PDF réel du module 04 (9 pages, en-tête et pied de page présents).

Migration `20261106090000_purge_empty_module_drafts` appliquée sur `tesla_test`, puis sur `tesla` après sauvegarde ; dérive nulle sur les deux bases. `npm run test:int` : **104 tests (11 fichiers) réussis**, dont `test/mise-en-service.int-spec.ts` (4) : suppression motivée et refusée, protections actives hors suppression, publication complète au nom du responsable, questionnaires rattachés à la version publiée, réexécution sans écriture, refus sans responsable habilité, PDF réservé aux modules publiés.

**Non exécuté** : `pedagogy:release` sur `tesla` — aucun responsable plein en exercice n'y est consigné (prévisualisation refusée, comportement attendu) ; à lancer après la nomination dans `/mandats`, ou avec `--acteur`. Rendu visuel du PDF non contrôlé (aucun outil de rendu disponible).

## Gouvernance simplifiée et application unique (2026-10-30)

Décisions D132–D134. Détails : [FEATURES/ENCADREMENT.md](FEATURES/ENCADREMENT.md), [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md).

Audit des dépendances (avant modification) : mandats, années scoutes et délégations utilisés par le schéma (3 modèles, 2 contraintes d'exclusion, 3 triggers), `AuthService.resolveAuthority` et `authorityValidUntil`, le module `leadership` (9 routes), la matrice partagée (niveaux `OFFICIEL`/`PLEIN`, 6 permissions), le web (écran `/mandats` de 801 lignes, navigation par rôle avec trois tableaux de bord, identité hors ligne bornée par l'échéance du mandat, préparation hors ligne), le seed de mise en service, 6 fichiers de tests, la documentation. Aucun job ni seed ne créait de mandat.

Réalisé :
- **Données** : migration additive `20261107090000_leadership_assignments` (fonctions sans année ni échéance ; un plein et une fonction par personne par index uniques partiels ; trigger d'immutabilité) ; mandats en vigueur repris ; `leadership_mandates`, `delegations`, `scout_years` gelées en lecture seule, rien supprimé. Testée sur une base jetable (`tesla_gouvernance_check`, copie de `tesla_test` avec un mandat en vigueur), appliquée sur `tesla_test` et `tesla` ; diff schéma ↔ base vide. Base `tesla` : 26 comptes conservés, aucun mandat préexistant, donc **aucun responsable plein désigné** à ce jour.
- **API** : décisions officielles = plein en fonction ; délégations retirées du calcul ; `leadership.read` (tous) / `leadership.manage` (administrateur) ; désignation, remplacement confirmé (transaction sérialisée, audit), fin de fonction, historique ; anciennes routes supprimées ; `authorityValidUntil` retiré.
- **Web** : menu unique filtré par permissions, accès par permission (plus aucun rôle dans la navigation), accueil commun `/accueil` réutilisant les tableaux de bord existants, page `/communaute` (composition pour tous, gestion pour l'administrateur), redirections des anciennes URL, relecture de session sur 403, « Mon compte » affiche la fonction et plus le rôle, « Type de compte » en langage courant, textes « chef » / « responsable pédagogique » / « délégation » remplacés ; accueil public sans « Un espace pour chacun ».
- **Hors ligne** : identité locale sans échéance d'autorité (D133) ; opération rejouée par une personne qui n'est plus habilitée → `403` → `REJETE`, conservée.
- Correctif mobile trouvé par la recette : débordement horizontal (badge d'écart d'étape non sécable, grille sans colonne explicite) sur l'accueil d'un routier sans date de naissance.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 154 tests (21 fichiers), web 61 tests (5 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 106 tests (11 fichiers) réussis, dont 6 nouveaux scénarios de gouvernance (accès directs refusés, désignation, remplacement confirmé et atomique, retrait immédiat des droits, historique et audit, unicité en base et sous concurrence, adjoint et assistants, changement et fin de fonction, immutabilité, tables gelées, anciennes routes en 404), fin de fonction du plein (comptes) et opération hors ligne rejouée après remplacement (refusée, sans effet).
- Recette navigateur hors dépôt (Chromium headless, 390 px, API et web de production sur `tesla_test`, comptes fictifs) : **15 contrôles réussis** — connexion sans choix d'espace pour administrateur, plein et routier ; menus par permissions ; aucun libellé technique (rôle, mandat, délégation, espace) ni défilement horizontal ; redirections `/mandats`, `/encadrement`, `/routier` ; désignation puis remplacement du plein avec confirmation ; ancien plein renvoyé à l'accueil, menu sans décisions, accès encadrement conservé ; routier voyant le nouveau plein sans contrôle de gestion ; accès direct refusé ; aucune erreur JavaScript.

Non vérifié :
- Recettes navigateur du dépôt (`apps/web/test/*.browser.mjs`) : URL d'arrivée mises à jour, non rejouées (fixtures et serveurs dédiés).
- Appareils réels ; scénario hors ligne complet en navigateur avec changement de responsable (couvert côté API et par test unitaire de classification).
- Les points d'API historiques `/dashboard/chef`, `/dashboard/responsable`, `/editor/chefs` gardent leur nom technique (non affiché, protégé par permissions).
- **Mise en service** : l'administrateur doit désigner le responsable plein depuis « Encadrement » ; d'ici là, les décisions officielles restent suspendues.

## Académie — navigation, fiches médicales, quiz (2026-10-30)

Branche `feat/academie-quiz-fiches-medicales` (depuis `main` 9d83d4e ; 7 commits le 2026-11-02, non poussée). Décisions D135–D142. Détails : [MEDICAL_RECORDS.md](MEDICAL_RECORDS.md), [QUIZ_ENGINE.md](QUIZ_ENGINE.md), [USER_JOURNEYS.md](USER_JOURNEYS.md), [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md).

### Audit initial
Déjà en place et réutilisé : suppression des mandats et application unique (D132–D134), comptes avec activation à usage unique rattachée à la fiche (D118–D121), bibliothèque et catalogue initial, PDF de cours, hors ligne, moteur d'âge et rattrapages, 5 types de questions, passation en ligne, papier et hors ligne. Manquants : menu à 5 rubriques (≈ 30 entrées en 8 groupes), fiches médicales, correction automatique des réponses courtes, association/classement, mode jeu, résultats par questionnaire, reprise du dernier cours. Arbitrage du responsable : matrice de permissions inchangée (voir DECISIONS.md).

### Réalisé
- **Navigation** (D141) : rubriques (routier 5, encadrement 5, administrateur 3), pages de la rubrique active dépliées, barre mobile à 5 accès, « Mon profil ».
- **Administrateur technique** (D142) : comptes et désignation de l'encadrement dans « Administration », aucune fiche médicale (permission `medicalRecord.own`).
- **Fiches médicales** (D135–D137) : migration additive `20261108090000_medical_records`, module API `medical`, chiffrement AES-256-GCM, PDF A4, carte « Fiche médicale » dans Mon profil, exclusion du cache hors ligne.
- **Réponses courtes** (D138) : migration additive `20261109090000_short_answer_variants`, moteur `gradeShortAnswer`, champ « Variantes acceptées » dans l'éditeur, corrigé papier.
- **Résultats d'un questionnaire** (D139) : `GET /editor/evaluations/:id/results`, page `/encadrement/evaluations/[id]/resultats`.
- **Mode jeu à paliers** (D140) : `/evaluations/[id]/jeu`.
- **Accueil routier** : « Reprendre la lecture ».
- Migrations appliquées sur `tesla_test` et `tesla` (`migrate deploy`, aucune réinitialisation) ; dérive schéma ↔ base nulle sur les deux.

### Vérifications exécutées
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` (sans `NODE_ENV` exporté) : réussis.
- `npm run test` : API 166 tests (22 fichiers), web 72 tests (6 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : **120 tests (12 fichiers) réussis**, dont 12 fiches médicales et 2 évaluations (réponse courte, résultats).

### Non vérifié / non développé
- **Recette navigateur** des nouveaux écrans (menu en rubriques, fiche médicale, résultats, mode jeu) : non exécutée ; rendu visuel du PDF médical non contrôlé.
- Questions **association** et **classement** : non développées (conception requise, voir QUIZ_ENGINE.md).
- Habilitation médicale d'urgence, durée de conservation, rotation de clé : non développées / à valider.
- Base `tesla` : `MEDICAL_DATA_KEY` absente du `.env` local → fiches médicales indisponibles (503) tant que la clé n'est pas ajoutée.
- Statistiques globales du tableau de bord de l'encadrement (nombre de quiz disponibles, réalisés) : non ajoutées à l'accueil ; disponibles par questionnaire.

## Stockage objet Cloudflare R2 et sauvegardes externes (2026-11-02)

Branche `feat/stockage-r2`. Audit, architecture, configuration Cloudflare, coûts et checklist : [STORAGE_R2.md](STORAGE_R2.md) ; décisions D143–D144.

Implémenté :
- Audit : aucun fichier n'était téléversé ni écrit durablement par l'application (PDF en mémoire, images externes) ; aucune migration de fichiers locaux nécessaire. Trois écarts de sauvegarde corrigés (contrôle d'archive sous `pipefail`, table gelée dans `verify-backup.sh`, `MEDICAL_DATA_KEY` absente de l'exemple de production).
- API : module `src/storage` (port `ObjectStorage`, implémentation S3/R2 avec `@aws-sdk/client-s3` et `@aws-sdk/s3-request-presigner`, service de cycle de vie), configuration `R2_*` validée par Zod (tout ou rien, facultative : 503 sans configuration), fichiers des modules (`module-files.*`) : demande d'envoi, confirmation vérifiée (taille, signature, SHA-256 en flux), lecture par URL signée selon la publication, ressources `IMAGE`/`DOCUMENT` adossées à un fichier, nettoyage et indicateurs dans `jobs:daily`.
- Base : migration additive `20261110090000_stored_files` (table, CHECK, trigger d'immutabilité, `module_resources.file_id`), appliquée sur `tesla` et `tesla_test`.
- Web : choix « Adresse https / Fichier de l'appareil » dans les ressources du module (calcul SHA-256, envoi direct, confirmation, progression), liste des ressources (téléchargement, taille, mention imprimée), mention hors ligne « fichier joint indisponible hors ligne ».
- Sauvegardes : copie R2 vérifiée par relecture, rétention locale réduite, contrôle d'espace, alerte et signal de réussite, copie chiffrée des fichiers ; test `deploy/scripts/tests/backup-scripts.test.sh`.

Vérifications exécutées :
- `npm run lint`, `npm run typecheck`, `npm run build` (API et web) : réussis.
- `npm run test` : API 187 tests (23 fichiers, dont 26 nouveaux : signatures binaires, liste blanche, noms de fichiers, contrats, URL signées hors réseau, configuration R2), web 72 tests (6 fichiers) — réussis.
- `npm run test:int -w @tesla/api` (`tesla_test`) : 129 tests (13 fichiers) réussis, dont 9 nouveaux (`test/module-files.int-spec.ts`, stockage simulé en mémoire) : envoi valide et clé générée, double confirmation, trop volumineux, type interdit, extension trompeuse, fichier inexistant, contenu falsifié, empreinte différente, fichier rejeté non attachable, panne du stockage, routier et chef étranger refusés, identifiant d'un autre module refusé, brouillon invisible des routiers puis lisible après publication, empreinte du paquet hors ligne, nouvelle version sans copie d'objet, modification de clé et suppression refusées par la base, CHECK adresse/fichier, nettoyage avec échec puis reprise, orphelins signalés, absence d'URL signée et de clé dans les journaux, stockage non configuré.
- `deploy/scripts/tests/backup-scripts.test.sh` : 8 contrôles réussis (voir [BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 7).

Non vérifié :
- **Aucun appel à Cloudflare R2 réel** (aucun compte ni jeton fourni) : signature de `If-None-Match` et `content-length` par R2, CORS, verrou et cycle de vie, rclone R2, erreurs réelles du fournisseur. À recetter en préproduction (STORAGE_R2.md § 13).
- Parcours navigateur de l'envoi (sélection, progression, téléchargement) : non recetté ; seulement types, lint, build et tests API.
- Images insérées dans le texte des leçons : toujours des URL externes (non migrées vers R2).
- Pas d'écran d'administration du stockage (indicateurs dans le journal du traitement quotidien, D143).
