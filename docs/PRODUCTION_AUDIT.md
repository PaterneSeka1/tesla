# Audit de préparation à la production

> **Mise à jour du 2026-11-02** (branche `chore/tesla-production-hardening`, depuis `main` `f2fdf68`) : voir [§ 5](#5-audit-de-consolidation-du-2026-11-02). Les sections 1 à 4 conservent l'audit du 2026-10-30 ; les statuts à jour sont au § 5.2.

Audit du 2026-10-30, branche `chore/preparation-production` créée depuis `main` (`13a2a1f`, arbre propre, aucun changement local préexistant). Méthode : lecture du code réel (API, web, schéma, 13 migrations, scripts, CI), exécution des contrôles, recettes navigateur. Deux audits en lecture seule (progression et mandats ; offline-first et interface) ont été recoupés dans le code avant d'être retenus.

Gravité : **P0** bloque toute mise en service ; **P1** à corriger avant un pilote ; **P2** avant la production ; **P3** amélioration. Statuts : *Corrigé* (correction et test exécutés), *Partiel*, *Ouvert*, *Bloqué (décision)*.

Mise en service et décision : [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Sécurité détaillée : [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## 1. Contrôles de départ (constatés sur `main`)

| Commande | Résultat |
| --- | --- |
| `git status --short` | Arbre propre ; branches distantes `feat/*` non fusionnées côté GitHub (`main` local en avance, non poussé) |
| `npm ci` | Réussi |
| `npm run lint` / `typecheck` / `build` | Réussis |
| `npm run test` | API 146, web 69 : réussis |
| `npm run test:int -w @tesla/api` (`tesla_test`) | 85 tests (8 fichiers) : réussis |
| `npm run format:check` | **Échec** : `.vscode/settings.json`, `apps/api/test/refonte.int-spec.ts` |
| `npm audit --omit=dev` | **Non exécutable** : le registre répond 400 « Invalid package tree » |
| Recette navigateur offline-first (web de `main`) | **Échec** au contrôle 25, boucle de 612 redirections `/connexion` ↔ page protégée |

## 2. Anomalies

### P0

| ID | Description | Preuve (code) | Risque | Correction | Validation | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | Aucun cycle de vie des comptes : pas de création, d'activation, de mot de passe, de désactivation. Seuls le seed de démonstration ou une requête SQL créaient un compte. | `apps/api/src/modules/users/users.module.ts` : « Module réservé : aucune route exposée » | Mise en service impossible sans manipuler la base ; mots de passe transmis en clair | Module `users` : création par périmètre, liens d'activation/réinitialisation à usage unique, désactivation, sessions, compte personnel ; installation du premier administrateur en ligne de commande (D118–D121) | `test/accounts.int-spec.ts` (9 tests) ; recette navigateur `apps/web/test/accounts.browser.mjs` (9 contrôles, 390 et 1280 px) | Corrigé |
| AUD-002 | Fuite entre comptes sur un appareil partagé : après expiration de la session de A, le coffre local de A restait ouvert ; B connecté écrivait ses copies dans le coffre de A et pouvait lire celles de A en cas d'erreur réseau. | `login-form.tsx` posait `/auth/me` en cache sans `confirmServerUser` ; `auth.ts` appelait `confirmServerUser` sans l'attendre | Divulgation de fiches et d'observations ; opérations de B rejouées sous l'identité de A | Confirmation du propriétaire (verrouillage du coffre d'un autre compte) avant toute lecture, à la connexion et dans `/auth/me` | Recette offline-first 28/28 (contrôle de changement de compte) ; test dédié « expiration puis autre compte » **non automatisé** | Corrigé (partiellement vérifié) |
| AUD-003 | Aucun élément d'exploitation : déploiement, supervision des processus, sauvegarde, restauration, TLS. | Absence de fichiers ; `IMPLEMENTATION_STATUS` : « déploiement non développé » | Perte de données sans retour possible | `deploy/` (systemd, Nginx, scripts), [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Sauvegarde chiffrée, restauration d'essai, restauration, refus d'écrasement et altération testés sur `tesla_test` ; **aucun test sur VPS** | Partiel |

### P1

| ID | Description | Preuve | Risque | Correction | Validation | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-004 | Limitation des tentatives de connexion en mémoire, remise à zéro au redémarrage, non partagée | `login-rate-limiter.ts` (`Map` en mémoire) | Force brute facilitée par un redémarrage | Table `auth_throttles` (empreintes, `INSERT … ON CONFLICT` atomique), portées IP+e-mail, e-mail seul, IP, liens, mot de passe ; purge quotidienne (D120) | Test d'intégration « limitation persistante » | Corrigé |
| AUD-005 | Une délégation restait active après la fin du mandat du délégataire | `leadership-rules.ts` : `activeDelegationWhere` ne testait que le délégant | Pouvoirs officiels (étapes, acquis) conservés jusqu'à la fin de la délégation | Mandat en vigueur du délégataire exigé | Test « une délégation cesse avec le mandat du délégataire » | Corrigé |
| AUD-006 | Boucle de redirection après expiration de session | `session-gate.tsx` et `login-form.tsx` : donnée `/auth/me` conservée par TanStack Query après un 401 | Application inutilisable jusqu'au rechargement ; charge réseau | Donnée retirée au 401 ; la connexion n'utilise qu'une session confirmée | Recette : 0 redirection parasite (612 sur `main`) | Corrigé |
| AUD-007 | Première visite : le service worker prend le contrôle et la page se recharge, effaçant la saisie (activation, connexion) | `service-worker-registration.tsx` : `controllerchange` → `reload()` sans condition | Premier usage d'un nouveau compte en échec intermittent | Rechargement réservé aux mises à jour (contrôleur préexistant) | Recette comptes stable (3 passages) ; offline-first 28/28 | Corrigé |
| AUD-008 | « Prêt pour une utilisation sans connexion » affiché alors que des copies manquaient (quota, coffre verrouillé, coupure) ; module téléchargé mêlant deux versions | `client.ts` : `storeResponse(...).catch(() => {})` et repli sur l'ancienne copie | Utilisateur sans données sur le terrain | Lectures strictes pendant la préparation et le téléchargement | Tests unitaires `client.test.ts` (2) ; recette 28/28 | Corrigé |
| AUD-009 | Une écriture mise en file après un envoi interrompu restait fusionnable : faux conflit `OPERATION_ID_REUSED`, perte de la seconde saisie à l'abandon | `operations.ts` : fusion si `retries === 0` | Perte silencieuse d'une saisie | Opération « déjà envoyée » jamais fusionnée | Revue de code ; **pas de test unitaire** (IndexedDB non simulé) | Corrigé (non testé automatiquement) |
| AUD-010 | Pages de création et de modification de fiche non préparées alors que ces écritures sont différables | `preparation.ts` | Fonction « hors ligne » inutilisable | Pages ajoutées à la préparation | Recette 28/28 (non spécifique) | Corrigé |
| AUD-011 | CI limitée à lint, types, tests unitaires, build | `.github/workflows/ci.yml` | Régressions de migrations, de permissions et d'offline non détectées | Jobs `integration` (PostgreSQL 18, dérive des migrations) et `browser` (recettes), formatage, audit des dépendances | YAML valide ; dérive contrôlée localement (code 0) ; **workflow non exécuté sur GitHub** | Partiel |
| AUD-012 | `format:check` en échec | Voir § 1 | CI rouge | Prettier appliqué | `format:check` réussi | Corrigé |
| AUD-013 | Fin anticipée d'un mandat effective seulement le lendemain (`endedEarlyOn >= date`) : un retrait urgent exige une date antidatée | `leadership-rules.ts`, test `refonte.int-spec.ts` qui évite le cas | Droits officiels conservés jusqu'à minuit | Révocation immédiate horodatée (`ended_at timestamptz`) | À écrire | Ouvert |
| AUD-014 | Référentiel d'âge : mise en vigueur rétroactive acceptée, aucun contrôle de chevauchement, d'étape `DEPART_ROUTIER` ni d'âge de sortie retiré ; `ageRules.manage` délégable | `age-progression.ts` (schéma), `pathway.service.ts` | Calculs passés non reproductibles ; sorties suspendues | Contrôles de cohérence (techniques) ; rétroactivité et délégabilité (décision) | Tests HTTP `POST /age-rules` à écrire | Bloqué (décision) / Ouvert |
| AUD-015 | Sortie de branche définitive sans annulation ; traitement quotidien acceptant une date future ; date de naissance modifiée sans trace des valeurs | `age-rules.ts:71`, `jobs/daily.ts`, `scout-profiles.service.ts` | Sortie erronée irréversible | Date future refusée ; ancienne et nouvelle date de naissance journalisées ; annulation de sortie = décision métier | Test « date de naissance journalisée » ; refus de date future **non testé** | Partiel |

### P2

| ID | Description | Preuve | Correction recommandée | Statut |
| --- | --- | --- | --- | --- |
| AUD-016 | Journaux HTTP et erreurs 500 avec chaîne de requête (recherches par nom, codes de tentative) | `request-logger.middleware.ts` | Chemin seul journalisé | Corrigé |
| AUD-017 | Réponses API sans en-têtes de sécurité ni `Cache-Control: no-store` | `app.setup.ts` | `security-headers.middleware.ts` (testé) ; en-têtes web complétés | Corrigé |
| AUD-018 | API à l'écoute sur toutes les interfaces | `main.ts` | `API_HOST=127.0.0.1` en production | Corrigé |
| AUD-019 | Phrase locale oubliée : coffre définitivement bloqué, opérations non synchronisées irrécupérables | `vault.ts` | Réinitialisation explicite avec avertissement de perte | Ouvert |
| AUD-020 | Aucun verrou de synchronisation entre onglets | `operations.ts` (`syncing` par onglet) | `navigator.locks` | Ouvert |
| AUD-021 | Aucune version de format des enregistrements IndexedDB ; `onblocked` bloque l'usage hors ligne si un ancien onglet reste ouvert | `db.ts` | Champ de version et migrations ; gestion de `versionchange` | Ouvert |
| AUD-022 | Remise locale d'une évaluation possible après l'expiration de la réservation de 24 h (refusée ensuite par le serveur) | `attempts.ts` | Contrôle local de l'échéance | Ouvert |
| AUD-023 | Éviction du stockage du navigateur non détectée | `device-panel.tsx` (seul `persist()`) | Marqueur de présence et alerte | Ouvert |
| AUD-024 | Copies d'évaluation : les échecs réseau consomment les 6 essais automatiques | `attempts.ts` | Aligner sur la file d'opérations | Ouvert |
| AUD-025 | Délégation réactivée si le même plein est renommé plus tard dans l'année | `activeDelegationWhere` | Lier la délégation au mandat du délégant | Ouvert |
| AUD-026 | `authorityValidUntil` ignore la fin du mandat du délégant | `auth.service.ts` | Prendre le minimum des deux bornes | Ouvert |
| AUD-027 | Notes éditoriales `A_VERIFIER` / `A_COMPLETER` des modules importés ignorées par la soumission et l'approbation | `module-editor.service.ts` | Les afficher et exiger un acquittement | Ouvert |
| AUD-028 | Obligation de rattrapage plus requise (`stillRequired = false`) ouvrant encore l'évaluation | `attempt-answers.ts` | Filtrer | Ouvert |
| AUD-029 | Décisions officielles possibles pour un routier sorti de la branche | `scout-progression.service.ts` | Selon décision (D95) | Bloqué (décision) |
| AUD-030 | Table `client_operations` jamais purgée | `idempotency.interceptor.ts` | Purge par la tâche quotidienne après une durée validée | Ouvert |
| AUD-031 | Compte désactivé : l'identité locale reste utilisable hors connexion jusqu'à 14 jours sur un appareil déjà préparé | D112 | Limite connue ; à arbitrer avec la durée D112 | Bloqué (décision) |

### P3

| ID | Description | Statut |
| --- | --- | --- |
| AUD-032 | Codes bruts visibles : actions d'activité (`activity-detail.tsx`), codes serveur des copies (`offline-attempt.tsx`, `attempts.ts`) | Ouvert |
| AUD-033 | Code mort : `readingPosition` (`use-offline-images.ts`) écrit mais jamais lu, alors que la doc annonce la position de lecture hors ligne | Ouvert |
| AUD-034 | `todayIso()` en UTC au lieu de `civilDateAt` (sans effet à Abidjan, UTC+0) | Ouvert |
| AUD-035 | Exclusions du coffre par liste noire : toute nouvelle route sensible est mise en cache par défaut | Ouvert |
| AUD-036 | `npm audit` refusé par le registre (pairs optionnels non installés) ; contournement `npm run audit:prod` | Partiel |
| AUD-037 | `matcher` du proxy sans `/mandats` ni `/mes-rattrapages` | Corrigé |
| AUD-038 | Pas de CSP de scripts côté web (nonces Next.js requis) | Ouvert |
| AUD-039 | PDF : caractères hors Windows-1252 remplacés par « ? » | Ouvert |

## 3. Contenus pédagogiques importés (« BASE DU SCOUTISME »)

Constaté en base de développement et dans les seeds : quatre modules `NT-SCOUT-M01` à `M04` (21 leçons dont **8 vides**), 21 brouillons « Découvrir la Route » **sans contenu**, **aucun questionnaire**, **aucun module publié**. Rien n'est publié automatiquement ; une leçon vide bloque la soumission. Les notes `A_VERIFIER` ne bloquent pas (AUD-027). Aucun module n'est marqué obligatoire avec source officielle : aucune obligation de rattrapage ne peut naître tant que le manuel SAPF-Route n'est pas fourni.

## 4. Décisions métier manquantes

Ces points ne sont pas codés et ne doivent pas l'être sans validation (`.claude/rules/pedagogy.md`) :

1. Durées et âges de l'Apprentissage et du Compagnonnage ; suite de l'échéance du Noviciat ; critères du Départ routier ; modules obligatoires par étape (manuel SAPF-Route absent du dépôt).
2. Délai de rattrapage, seuil d'alerte avant 21 ans, accès aux évaluations au titre d'un rattrapage (D98).
3. Droits d'un routier après la sortie (D95), décisions possibles après la sortie, procédure d'annulation d'une sortie enregistrée à tort.
4. Règle du 29 février et des fins de mois (D97).
5. Autorité qui nomme le plein et forme de l'acte (D101) ; droits de l'adjoint (D103) ; adjoint unique ou multiple (aucune contrainte aujourd'hui).
6. Gestion du référentiel d'âge : délégable ou non, rétroactivité permise ou non (AUD-014).
7. Séparation des tâches : le plein peut-il approuver ses propres modules ou valider ses propres propositions ?
8. Durées D111 (12 h), D112 (14 jours), D117/D78 (24 h), validité des liens de compte (72 h, D118), périmètre de création des comptes (D119).
9. Objectifs de perte de données et de rétablissement (RPO/RTO), durées de conservation ([SECURITY_AUDIT.md](SECURITY_AUDIT.md) § 6).

## 5. Audit de consolidation du 2026-11-02

Point de départ : `main` = `origin/main` = `f2fdf68`, arbre propre ; branches distantes `feat/*` toutes fusionnées (0 commit non fusionné). Méthode : contrôles automatiques, trois audits en lecture seule recoupés dans le code (gouvernance et sécurité API, stockage R2, exploitation), recettes et balayage dans Chromium réel.

### 5.1 Contrôles de départ

| Contrôle | Résultat sur `f2fdf68` |
| --- | --- |
| `npm ci`, `format:check`, `lint`, `typecheck`, `build` | Réussis |
| `npm run test` | API 187, web 72 : réussis |
| `npm run test:int -w @tesla/api` | 129 tests (13 fichiers) : réussis |
| `npm run audit:prod` | 558 paquets, 0 vulnérabilité bloquante (1 modérée : `minimatch`, ReDoS, outillage) |
| Recettes navigateur offline-first et comptes | **Échec** : sélecteurs et redirections antérieurs à l'application unique (titre « Tableau de bord », `/encadrement`, « Accès », « Mon compte ») |
| `nginx -t` (nginx 1.24 d'Ubuntu 24.04) | **Échec attendu** : `http2 on;` n'existe qu'à partir de 1.25.1 |
| Workflow GitHub Actions | Non consultable (`gh` absent) ; le job `browser` démarrait l'API de production sans `MEDICAL_DATA_KEY`, donc échouait |

### 5.2 Statut des anomalies antérieures

| ID | Statut au 2026-11-02 | Preuve |
| --- | --- | --- |
| AUD-005, AUD-013, AUD-025, AUD-026 | **Obsolètes** (mandats et délégations supprimés, D132–D134) ; fin de fonction horodatée et effective immédiatement | `leadership.service.ts` (`endedAt: new Date()`), droits recalculés à chaque requête (`auth.service.ts`) |
| AUD-014 | Délégabilité obsolète (`ageRules.manage` réservé au plein) ; **rétroactivité et contrôles de cohérence : Bloqué (décision)** | `age-progression.ts`, `pathway.service.ts` |
| AUD-015 | Date future refusée, date de naissance journalisée : **Corrigé** ; annulation d'une sortie : **Bloqué (décision)** | `jobs/daily.ts`, `scout-profiles.service.ts` |
| AUD-019 | **Corrigé** : effacement explicite des données du compte sur l'appareil (D147) | `vault.ts` (`resetVault`), `device-panel.tsx` ; recette 28/28 |
| AUD-020 | **Corrigé** : verrou inter-onglets `navigator.locks` (D148) | `db.ts` (`withSyncLock`) |
| AUD-021 | **Corrigé en partie** : connexion orpheline refermée après blocage, version plus récente signalée ; magasins jamais recréés. Pas de champ de format par enregistrement (aucune migration de données nécessaire à ce jour) | `db.ts` |
| AUD-022 | **Corrigé** : remise locale refusée après l'échéance, copie affichée comme expirée | `attempts.ts`, `offline-attempt.tsx` |
| AUD-023 | **Corrigé au mieux** : témoin hors IndexedDB et alerte d'effacement ; état de conservation durable affiché. Un effacement complet des données du site emporte aussi le témoin | `vault.ts`, `device-panel.tsx` |
| AUD-024 | **Corrigé** : coupure réseau sans consommation d'essai, copies et opérations alignées | `attempts.ts`, `operations.ts` (`classifyFailure().offline`), test unitaire |
| AUD-027 | **Corrigé** : acquittement exigé et journalisé à l'approbation (D146) | `module-review.service.ts` ; `pedagogy-seed.int-spec.ts` |
| AUD-028 | **Corrigé** (P1) : rattrapage ouvrant l'évaluation seulement si le module reste obligatoire (D145) | `attempt-answers.ts`, `evaluation-sessions.service.ts` ; test d'intégration qui échoue sans la correction |
| AUD-030 | **Bloqué (décision)** : durée de conservation de `client_operations` (au-delà, un appareil resté longtemps hors ligne ne serait plus dédupliqué) | — |
| AUD-032 | **Corrigé** : actions d'activité et messages de synchronisation en libellés métier | `activity-detail.tsx`, `offline-attempt.tsx` |
| AUD-033 | **Corrigé** : « Reprendre la lecture » sur la page du module | `module-detail.tsx` |
| AUD-038 | **Ouvert (P2)** : CSP de scripts à nonces | `next.config.ts` |
| AUD-039 | **Ouvert (P3)** : caractères hors Windows-1252 dans les PDF | — |
| AUD-011 | **Corrigé en local** : jobs `quality`, `integration`, `browser` (réparé), `ops` (nouveau) ; exécution GitHub non vérifiée | `.github/workflows/ci.yml` |
| AUD-003 | **Partiel** : scripts complets et vérifiés localement ; aucun VPS | § 5.3 |

### 5.3 Nouvelles anomalies

| ID | Gravité | Description | Correction | Validation | Statut |
| --- | --- | --- | --- | --- | --- |
| AUD-040 | P1 | Nginx incompatible avec nginx 1.24 d'Ubuntu 24.04 (`http2 on;`) | `listen 443 ssl http2` ; configuration paramétrée par instance | `nginx -t` sur nginx 1.24, deux instances (local et CI) | Corrigé |
| AUD-041 | P1 | Premier certificat impossible : le vhost HTTPS référence un certificat absent ; `certbot --nginx` ignore le webroot | Vhost provisoire `tesla-acme.conf`, `certbot certonly --webroot`, puis HTTPS (`bootstrap.sh`) | `nginx -t` des deux vhosts ; Let's Encrypt réel **non testé** | Corrigé (non vérifié sur serveur) |
| AUD-042 | P1 | `rollback.sh` pouvait viser une release cassée ou celle qui venait d'échouer | Marqueurs `HEALTHY` / `FAILED`, release supprimée si échec avant bascule (D149) | Simulation de la sélection et du nettoyage ; shellcheck | Corrigé |
| AUD-043 | P1 | Échecs du contrôle de santé et du traitement quotidien sans alerte | `tesla-alert@` + `OnFailure=` + `ALERT_URL` (D150) | Exécution locale de l'alerte (repli sur le journal) ; `systemd-analyze verify` | Corrigé |
| AUD-044 | P1 | Recettes navigateur obsolètes et job CI `browser` sans `MEDICAL_DATA_KEY` : aucune recette réellement verte | Recettes réalignées ; clé éphémère dans le job | Offline-first 28/28 (320, 390, 1280 px), comptes 9/9 (320, 390, 1280 px) | Corrigé |
| AUD-045 | P2 | Aucune installation serveur reproductible | `bootstrap.sh` idempotent (D151) | shellcheck ; génération de la configuration validée par `validateEnv` ; **non exécuté sur Ubuntu** | Corrigé (non vérifié sur serveur) |
| AUD-046 | P2 | Course R2 : une confirmation tardive pendant la purge pouvait valider un objet supprimé | Fiche réservée (`ABANDONNE`) avant suppression de l'objet, suppression retentée | `module-files.int-spec.ts` | Corrigé |
| AUD-047 | P2 | Sauvegarde des fichiers R2 ignorée sans alerte si non configurée | Échec signalé après la copie de la base quand `R2_BUCKET_NAME` est défini | `backup-scripts.test.sh` (9/9) | Corrigé |
| AUD-048 | P2 | Débordements horizontaux : détail d'activité (63 px à 320 px), évaluation (11 px), accueil de l'encadrement avec un titre long (94 px) | Boutons longs à la ligne ; `min-w-0` sur la primitive `Card` | Balayage : 434 affichages (4 profils, 46 pages, 7 largeurs) sans défaut | Corrigé |
| AUD-049 | P2 | `/api/v1/auth/password` sans limitation Nginx stricte ; pas de page 502/503 ; délais de connexion | Zone `tesla_auth`, page de maintenance, `proxy_connect_timeout` | `nginx -t` | Corrigé |
| AUD-050 | P3 | Release ≈ 2 Go (cache de build Next) ; jusqu'à 10 releases conservées | Cache supprimé, 5 saines + 2 en échec | Mesure locale | Corrigé |
| AUD-051 | P3 | Tables gelées : `UPDATE` encore possible sur `scout_years`, `DELETE` non bloqué par trigger sur les trois tables (seules les clés étrangères protègent) | Trigger `BEFORE UPDATE OR DELETE` (migration additive) | — | Ouvert |
| AUD-052 | P3 | Listes non paginées croissantes : tentatives d'un questionnaire (résultats), présences (tableaux de bord), historique de l'encadrement | Agrégation SQL ou pagination | — | Ouvert (volume faible pour 25 routiers) |
| AUD-053 | P3 | Pas d'inventaire R2 ↔ `stored_files` (objets sans fiche, fiches sans objet) ; colonne `bucket` non utilisée en lecture | Rapprochement périodique `ListObjectsV2` | — | Ouvert |
| AUD-054 | P3 | Reste invisible du streaming React : second `<main id="contenu">` vide dans un bloc `hidden` sur les pages dynamiques | Aucun impact visible ni d'accessibilité constaté ; à surveiller avec Next | Balayage (`main:visible`) | Accepté |
| AUD-055 | P2 | Rotation de `MEDICAL_DATA_KEY` non outillée | Script de rechiffrement (ancienne → nouvelle clé) à écrire avant la première rotation | — | Ouvert |

### 5.4 Gouvernance : matrice des décisions

| Question | Documents | Code actuel (référence) | Conséquence |
| --- | --- | --- | --- |
| Mandat annuel ou désignation sans mandat ? | D93, D101, D103 (mandats, délégations) **remplacées** par D132–D134 | Désignation directe par l'administrateur (`leadership_assignments`), sans durée ; tables de mandats gelées | Aucune reconduction annuelle n'est exigée ; la fin de fonction est un acte explicite, effectif immédiatement |
| Reconduction du plein | D101 (« reconduction explicite illimitée ») devenue sans objet | Le plein reste en fonction jusqu'à sa fin explicite | **À confirmer** : faut-il un rappel annuel (début d'année scoute) ? Non codé |
| Un seul plein | D132 | Index unique partiel + verrou consultatif | Garanti en base |
| L'administrateur peut-il être chef ? | D93 (« un compte par personne ») contre D142 (compte administrateur purement technique) | Rôle `ADMINISTRATEUR` exclu de toute fonction d'encadrement | Une personne qui administre et encadre a **deux comptes**. À confirmer (D142 retenue par le code) |
| Droits de l'adjoint et des assistants | D103 (« aucun droit officiel par défaut », À VALIDER) puis D133 | Tout l'encadrement consulte, rédige, observe, corrige ; décisions officielles réservées au plein | **À valider** : l'adjoint doit-il suppléer le plein absent ? Non codé (aucune délégation) |
| Gestion des comptes | D142 vs `account.manage` ouvert au plein | Le plein ne crée que des comptes routiers (depuis les fiches) ; l'administrateur crée tous les types | Cohérent avec « le plein crée les comptes routiers » ; à confirmer |
| Historique | D132 | Trigger interdisant suppression et modification d'une fonction terminée ; journal d'audit dans la même transaction | Conservé |

### 5.5 Décisions humaines encore nécessaires
Celles du § 4 restent ouvertes (durées après le Noviciat, rattrapages, sortie, D97, RPO/RTO, conservation médicale), sauf les points 5 et 6 rendus partiellement caducs par D132–D134 ; s'y ajoutent : reconduction annuelle et suppléance du plein (§ 5.4), double compte administrateur-encadrant, durée de conservation de `client_operations` (AUD-030), procédure de rotation de `MEDICAL_DATA_KEY` (AUD-055), contenu officiel de la Charte de la Route (non fourni, jamais inventé).
