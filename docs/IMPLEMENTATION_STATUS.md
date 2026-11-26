# État d'implémentation

Dernière mise à jour : 2026-11-25 — **parcours des routiers** (D203), vue d'ensemble de l'encadrement par étape (`/administration/parcours`, `GET /statistics/pathways/board`) ; branche `feat/tesla-immersive-audit`, non commitée. Le 2026-11-24 : **fiabilité de l'entraînement et jeux** (D201, D202), voir [§ Audit post-implémentation](#audit-post-implémentation-de-lexpérience-immersive-2026-11-24) ; même jour : **expérience immersive** (D194–D200), voir [§ Expérience immersive](#expérience-immersive-2026-11-24). Le 2026-11-17 : **fiche médicale pour tout le monde** (D191) et **routier sorti considéré comme adulte** (D190), voir [§ Sortie vers adulte](#routier-sorti-considéré-comme-adulte-2026-11-17) ; **référencement et métadonnées** (D189), voir [§ Référencement](#référencement-et-métadonnées-2026-11-17) ; **actes du plein sans validation** (D188), voir [§ Actes du plein](#actes-du-plein-sans-validation-2026-11-17) ; **préparation de la migration du web vers OVH** (D187, non déployée), voir [§ Migration du web vers OVH](#migration-du-web-vers-ovh-2026-11-17) ; même jour : **lien d'activation valable 7 jours** (D186), voir [§ Lien d'activation](#lien-dactivation-de-7-jours-2026-11-17). Le 2026-11-16 : **apprenants adultes** (D185), voir [§ Apprenants adultes](#apprenants-adultes-2026-11-16). Même jour : **invitation à installer l'application, iPhone compris** (D184), voir [§ Installation](#installation-de-lapplication-2026-11-16) ; **sexe du routier** (D183), voir [§ Sexe du routier](#sexe-du-routier-2026-11-16) ; **refonte mobile : barre inférieure commune, ajout direct de leçons** (D182), voir [§ Refonte mobile](#refonte-mobile-2026-11-16) ; **parcours officiel des routiers : étape toujours déterminée, parcours antérieur reconnu, lecture libre** (D181), voir [§ Parcours officiel](#parcours-officiel-2026-11-16).

## Audit post-implémentation de l'expérience immersive (2026-11-24)

Branche `feat/tesla-immersive-audit` (depuis `feat/tesla-immersive-learning` 8362a4f, **non commitée, non poussée**). Décisions D201, D202 ; suivi [TESLA_IMMERSIVE_PROGRESS.md](TESLA_IMMERSIVE_PROGRESS.md#chantier-2--audit-et-perfectionnement-2026-11-24). Migration additive `20261126090000_practice_attempts_badges` appliquée sur `tesla_test` seulement.
- Terminé : lots B et C (idempotence, versions, erreurs, badges, révisions, identité des leçons, sauvegarde des parties), disponibilité commune des jeux, sélection des exercices, L'Ascension et jeu de mémoire reliés au suivi, refonte visuelle de L'Ascension, du jeu de mémoire et de la salle des défis.
- Non réalisé : carte d'aventure illustrée, expéditions, éditeur (difficulté et désactivation des exercices dérivés), missions, jeu collectif, carnet personnalisé, recette navigateur et mesures de performance de ce chantier.

## Expérience immersive (2026-11-24)

Branche `feat/tesla-immersive-learning` (depuis `fix/progression-audit` + `origin/main`, **non commitée, non poussée**). Décisions D194–D200 ; documentation [FEATURES/EXPERIENCE_IMMERSIVE.md](FEATURES/EXPERIENCE_IMMERSIVE.md) ; suivi des lots [TESLA_IMMERSIVE_PROGRESS.md](TESLA_IMMERSIVE_PROGRESS.md). Migration additive `20261125090000_learning_events_practice` appliquée sur `tesla_test` seulement ; aucun déploiement.

### Réalisé
- Bloc « Activité » des leçons (7 types) dans l'éditeur, le lecteur, le PDF et la version imprimable ; banque d'entraînement issue des seules versions publiées, complétée d'activités dérivées du texte publié.
- Défis (10 modes, registre), carnet (XP et badges serveur idempotents), révisions espacées, indicateur agrégé « Notions à retravailler » (Statistiques).
- Lecteur en mode concentration (Découverte / lecture intégrale), accueil apprenant (une aventure, une suggestion), carte d'aventure du module, préférences de confort, barre inférieure à 4 destinations pour les apprenants.

### Vérifications
- Voir [TESLA_IMMERSIVE_PROGRESS.md § Tests exécutés](TESLA_IMMERSIVE_PROGRESS.md#tests-exécutés).

### Reste
- Missions, jeu collectif, avatar, notes et favoris (décisions attendues) ; appliquer la migration sur `tesla` et en production sur autorisation ; recette sur téléphones réels.

## Audit de la progression (2026-11-23)

Branche `fix/progression-audit` (commits c4dd5da à ca5d349 et documentation, non poussée). Décisions D192 (alerte et rappels, fenêtre 7 jours) et D193 (annonce du passage d'étape). Migrations additives `20261123090000_catch_up_reminders` et `20261124090000_stage_transition_notifications` appliquées sur `tesla_test` seulement ; base `tesla` et production intouchées ; aucun déploiement. Rapport : [QUALITY/AUDIT_PROGRESSION_2026-11-23.md](QUALITY/AUDIT_PROGRESSION_2026-11-23.md) (comparaison avec le suivi pédagogique CMG).

### Réalisé
- Indicateurs de rattrapage alignés sur la fiche (`summarizeOpenCatchUps`, champ `toReview`) ; `assertCanAtWrite` sur `decideCatchUp` ; garde apprenant adulte dans le plan de rattrapage ; `syncAllCatchUps` pour le traitement quotidien (chargement unique, erreurs isolées).
- D192 : `catchUpAlertDays` au référentiel (formulaire et consultation) ; `catchUpLock.deadline` et bandeau « Échéance proche / dépassée » ; table `notifications` (trigger d'immutabilité), module `notifications` (`GET /me/notifications`, `POST /me/notifications/read`, permission `notification.own`) ; `CatchUpRemindersService` dans `jobs:daily` ; envoi SMTP au plus une fois (transport partagé `common/mail-transport.ts`) ; fenêtre « Notifications » dans le cadre de l'application, exclue du hors ligne.
- Référentiel `2026.3` (seed, en vigueur au 2026-11-24) : alerte à 7 jours. D193 : `StageAnnouncementsService` dans `jobs:daily` (notification `ETAPE_NOUVELLE`).

### Vérifications
- `lint`, `typecheck`, `test` (API 310, web 146) ; API 312 ; intégration `tesla_test` : **200 réussis**, 1 ignoré (classeur réel absent), dont `catch-up-reminders.int-spec.ts` 6/6 ; seed vérifié sur `tesla_test` (2026.3 créé) ; `prisma migrate diff` : aucune dérive. Recette navigateur de la fenêtre non exécutée ; envoi SMTP réel non testé.

### Reste
- Sur autorisation : appliquer les deux migrations et le seed (référentiel `2026.3`) sur `tesla` ; planifier `jobs:daily` sur le serveur ; recette navigateur de la fenêtre et envoi SMTP réel.

## Routier sorti considéré comme adulte (2026-11-17)

Décision D190. Aucune migration.

### Réalisé
- API : `MembershipService.applyExits` passe au rôle `ADULTE` les comptes `ROUTIER` rattachés à une fiche `SORTI` (idempotent, audit `membership.account_adult`, champ `accountsConverted` du rapport) ; `computeEligibility` applique les règles adultes à un routier sorti ; distribution collective limitée aux routiers membres de la branche.

### Vérifications
- `lint`, `typecheck`, `test` (API 301, web 139) ; intégration sur `tesla_test` : `refonte`, `apprenants-adultes`, `evaluations`, `stage-override` (31 réussis).
- **Déployé en production** le 2026-11-18 à 09:27 UTC avec D191 (`c752164`, build Next.js neuf, sauvegarde chiffrée préalable copiée sur R2, aucune migration) : release marquée saine, `tesla-api` et `tesla-web` actifs, santé de l'API, origine OVH (403 sans secret, 200 avec), domaine public (`/`, `/connexion`, `robots.txt`, `sitemap.xml`, manifeste, image de partage, redirection de `/accueil`).

### Reste
- Fiche médicale ouverte à tous les comptes (D191 : permission partagée, tests `medical-records` 3 suites d'intégration réussies) ; arbitrer « Ma progression » pour un routier sorti (voir D190) ; lancer le traitement quotidien sur la base pour convertir les sorties existantes.

## Référencement et métadonnées (2026-11-17)

Décision D189. Aucune migration, aucun déploiement.

### Réalisé
- `src/lib/site.ts` : domaine canonique (`SITE_URL`, défaut domaine Vercel), textes, pages indexables, préfixes privés, constructeurs `robots`, `sitemap` et données structurées.
- `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` (1200×630, logo) ; racine : `metadataBase`, description, mots-clés, Open Graph `fr_CI`, carte `summary_large_image`, `noindex` par défaut conservé.
- `/` et `/connexion` indexables avec URL canonique ; JSON-LD `EducationalOrganization` + `WebSite` sur l'accueil ; manifeste aligné.

- Sécurité : Next.js et `eslint-config-next` 16.4.3 → **16.4.6** (versions exactes), corrigeant GHSA-mfr8-8qww-v76h et GHSA-vc7v-qv4w-wrv8 (fuites de cache `use cache`, modérées) ; lockfile limité aux paquets Next.

### Vérifications (Node 22.23.5)
- `lint`, `typecheck`, `test` (API 301/301, web 146/146 dont 7 nouveaux dans `site.test.ts`), `build` (API + web, sans alerte de sécurité de Next) ; rendu contrôlé avec `next start` : balises de `/`, `/connexion`, pages de compte et `/hors-ligne` (`noindex`), `robots.txt` (19 exclusions), `sitemap.xml`, image de partage (200, PNG), redirection des pages connectées sans session.
- Sous Node 20 (poste de développement), les tests de l'API plantent toujours au démarrage (SIGSEGV) : utiliser Node ≥ 22.12 (`.nvmrc`).
- Non exécutés : tests d'intégration (`test:int`, base `tesla_test`), l'API n'étant pas modifiée.
- **Déployé en production** le 2026-11-17 à 19:03 UTC (`0fce2a6`, sauvegarde chiffrée préalable, aucune migration) : contrôlé sur l'origine OVH et sur le domaine public (`robots.txt`, `sitemap.xml`, balises, image de partage, santé de l'API).

### Reste
- Après déploiement : Google Search Console (vérification du domaine, envoi du plan du site) et test des aperçus de partage (WhatsApp, Facebook).
- `npm audit` : `minimatch` (modérée, outil de lint seulement, via typescript-eslint 8.72) ; correctif typescript-eslint 8.73.0 publié le 2026-11-16, à adopter après quelques jours de recul.

## Actes du plein sans validation (2026-11-17)

Décision D188. Aucune migration, aucun déploiement.

### Réalisé
- API : soumission d'un module ou d'un questionnaire par le plein = approbation et publication atomiques ; soumission d'une copie par le plein = résultat accepté ; proposition d'acquis du plein = validation officielle ; correction de fiche par le plein sans motif ni confirmation (`scout.correctDirectly`). Script de mise en service du catalogue adapté.
- Web : boutons « Publier » (modules, questionnaires, résultat d'une copie), « Valider un acquis », formulaires de fiche (routier, adulte) sans motif ni case de confirmation pour le plein.

### Vérifications
- `lint`, `typecheck`, `test` (API 301, web 139), `build` ; intégration sur `tesla_test` : 192 réussis, 1 ignoré (tests adaptés au nouveau circuit, nouveau scénario D188 pour les acquis).

### Reste
- Recette navigateur avec un compte plein ; arbitrage des motifs conservés (voir D188).

## Migration du web vers OVH (2026-11-17)

Décision D187. Préparation dans le dépôt uniquement : **aucune action sur le VPS ni sur Vercel** (pas d'accès SSH autorisé ni d'accès au projet Vercel depuis le poste). Aucun code applicatif modifié. Dossier : [migration-ovh/](migration-ovh/10-rapport-final.md).

### Réalisé
- Mode `WEB_HOSTING=ovh` (`common.sh`, `deploy.sh`, `healthcheck.sh`, `rollback.sh`, `bootstrap.sh`, modèle d'environnement) ; vhost d'origine `deploy/nginx/tesla-origin.conf` ; proxy Vercel `deploy/vercel-proxy/vercel.json`.
- Audit : production publique saine ; manifeste et `sw.js` de production identiques au dépôt ; anomalie préexistante : sur Vercel, `sw.js` ne reconnaît aucun script des pages (`/_next/static/immutable/…`), la préparation hors ligne n'enregistre donc pas les scripts à l'avance.

### Vérifications
- `deploy-scripts.test.sh` 69/69, `vercel-proxy.test.sh` 10/10 ; `nginx -t` et 12 scénarios sur Nginx 1.24 (Docker) ; vrai Next.js 16.4.3 (`next start`) derrière le vhost d'origine.
- Non exécutés : lint, typecheck, tests Vitest (aucun code TypeScript modifié) ; ShellCheck (absent).

### Exécuté sur le VPS (2026-11-17, 17:58–18:02 UTC)
- Audit § 1 : `nginx -t` OK, 18 Gio disponibles, base à jour (30 migrations, aucune en attente), sauvegarde du jour présente. Port 3000 occupé par une autre application → **`WEB_PORT=3100`**.
- Étape A : `5999d1e` déployé en mode vercel (sauvegarde, aucune migration, `HEALTHY`).
- Étape B : `/etc/tesla/production.env.avant-ovh` conservé ; `WEB_HOSTING=ovh`, `WEB_PORT=3100`, `NEXT_PUBLIC_API_URL=/api/v1`, `WEB_ORIGIN_DOMAIN=tesla.veilleurdesmedias.org` ; vhost API identique au modèle avant `bootstrap.sh` ; certificat `tesla.veilleurdesmedias.org` (expire 2027-02-15), vhost `tesla-production-origin`, `tesla-web@production` activé. Avertissement Nginx non bloquant « protocol options redefined » sur 443.
- Étape C : `5999d1e` en mode ovh, `tesla-api@production` et `tesla-web@production` en service (127.0.0.1:4100, 127.0.0.1:3100).
- Contrôles § 6 : origine 403 sans secret, 200 avec ; `sw.js` `no-store` ; santé `ok` ; redirection `/accueil` relative ; manifeste `"id":"/"`. Contrôle de santé périodique OK (un échec transitoire à 18:00, pendant le changement de mode).
- Constat préexistant : `tesla-alert` échoue (`ALERT_URL` : « Bad hostname ») — alertes non reçues.

### Reste
- Essai du proxy dans un projet Vercel séparé ; **bascule Vercel** ([07](migration-ovh/07-bascule-vercel.md) § 3) ; recette sur téléphones réels ; corriger `ALERT_URL`.

## Lien d'activation de 7 jours (2026-11-17)

Décision D186. Aucune migration, aucun déploiement.

### Réalisé
- `ACTIVATION_LINK_TTL_DAYS` (7 par défaut, 1 à 30) dans `src/config/env.ts`, `.env.example`, `deploy/env/production.env.example`, README et DEPLOYMENT.
- `issueLink` (`accounts.service.ts`) : durée par défaut selon la finalité (activation en jours, réinitialisation `ACCOUNT_LINK_TTL_HOURS`) ; « mot de passe oublié » inchangé.
- Usage unique et réémission (révocation de l'ancien lien) déjà en place, réutilisés tels quels (`POST /users/:id/link`, permission `account.manage` et périmètre vérifiés côté serveur).
- Fiche (`scoutDetailSchema.account`) : `id` et `status` du compte rattaché ; bouton « Nouveau lien d'activation » dans `scout-actions.tsx` (compte `A_ACTIVER`, `account.manage`), lien remis par `AccountLinkDialog` ; mention « En attente d'activation » dans `scout-profile.tsx`.
- Test d'intégration `accounts.int-spec.ts` complété : 7 jours à la création et à la réémission, 72 h pour la réinitialisation ; état du compte sur la fiche et réémission par le plein.

### Vérifications
- `npm run typecheck`, `npm run lint`, Prettier, `npm run build` (avec `NEXT_PUBLIC_API_URL=/api/v1`) et tests web (139/139) : réussis.
- Tests Vitest de l'API et d'intégration **non exécutables** dans l'environnement de cette session : Node 20 au lieu de ≥ 22.12, les processus de test plantent (SIGSEGV) avant le premier test, y compris sur le code d'origine. À relancer sous Node 22 (`npm run test:int -w @tesla/api`).

### Limites
- Bouton de la fiche non recetté dans un navigateur.

## Apprenants adultes (2026-11-16)

Branche `feat/apprenants-adultes` (non poussée). Décision D185. Migration additive `20261121090000_learner_kind_adults` appliquée sur la base jetable `tesla_test` seulement. Aucun déploiement.

### Réalisé
- Modèle : `LearnerKind` (`ROUTIER`, `ADULTE`) sur `scout_profiles`, rôle `ADULTE` ; contrainte `scout_profiles_adult_fields_check` (ni matricule ni dates), trigger `scout_profiles_kind_frozen`, trigger `route_only_scout_profile` sur les 12 tables propres à la Route.
- Calcul central : motif d'étape `ADULTE` (`computedStageOf`), éligibilité sans condition d'étape (`computeEligibility`, `loadEligibility`), `subject()` par permission (`evaluation.take`) et non plus par rôle.
- Permissions : `ADULTE` = `module.read`, `evaluation.read`, `evaluation.take`, `results.readOwn` (nouvelle, aussi routiers), `leadership.read`.
- API : `POST /scouts/adults`, liste `?kind=ADULTE`, champs Route refusés (`ADULT_NOT_IN_ROUTE`), comptes du même type que la fiche, plein habilité aux comptes adultes, « Mon profil » sans partie Route ; refus explicites (équipe, observation, étude, compétence, exception, parcours antérieur, dérogation) ; populations Route filtrées (statistiques, tableaux de bord, présences, distribution collective, résultats « concernés », tâche quotidienne, sortie, diagnostic).
- Web : page « Adultes » (liste, inscription, fiche réduite, modification), accueil et onglets de l'adulte, « Mes résultats » sur `results.readOwn`, comptes, préparation hors ligne et appareil par permission.

### Vérifications
- `lint`, `typecheck`, `build` ; tests unitaires API 301, web 139 ; intégration complète sur `tesla_test` : 191 réussis, 1 ignoré (dont `apprenants-adultes.int-spec.ts`, 3 scénarios).
- Captures WebKit (iPhone, session simulée) : accueil de l'adulte, formulaire « Nouvel adulte ».

### Reste
- Appliquer les migrations `scout_sex` et `learner_kind_adults` sur `tesla` (`npm run db:deploy`).
- Recette navigateur complète (passation par un adulte, correction, résultat) ; pas de compte adulte de démonstration dans le seed.
- À confirmer : observations refusées aux adultes ; accès des adultes à la composition de l'encadrement.

## Installation de l'application (2026-11-16)

Décision D184. Aucun déploiement. Interface web seulement : aucune route API, migration ni permission.

### Réalisé
- `src/lib/pwa-install.ts` (détection : application installée, iPhone/iPad, navigateur intégré, invitation native ; pages exclues) et `src/components/pwa/install-prompt.tsx` (modale), montée dans le layout racine sous `Suspense` ; script en ligne captant `beforeinstallprompt` avant React.
- Manifeste : `id: '/'` ; balise `apple-mobile-web-app-capable` (Next 16 ne l'émet plus).
- Entrée « Installer l'application » dans `UserMenu` (menu « Plus » et barre latérale), navigateur seulement (`useInstallGuide`), qui rouvre l'invitation.

### Vérifications
- `lint`, `typecheck`, `test` (web : 133, dont 5 pour D184), `build`.
- Recette `installation-pwa.browser.mjs` : **11/11** (iPhone 13 sous WebKit, image Docker Playwright 1.64.1 ; Pixel 7 et ordinateur sous Chromium, invitation native simulée ; session fictive simulée pour le menu). Captures iPhone SE contrôlées.

### Reste
- Essai sur iPhone et Android réels, en HTTPS (préproduction) : installation effective, icône, ouverture plein écran.

## Sexe du routier (2026-11-16)

Décision D183. Aucun déploiement. Migration additive `20261120090000_scout_sex` appliquée sur la base jetable `tesla_test` seulement (pas sur `tesla`).

### Réalisé
- Enum `ScoutSex` (`GARCON`, `FILLE`) et colonne `scout_profiles.sex` (nullable pour les fiches antérieures) ; constantes `SCOUT_SEXES`, `SCOUT_SEX_LABELS` dans `@tesla/shared`.
- **Obligatoire à l'inscription** (API `400 VALIDATION_ERROR`, formulaire « Choisir… ») ; donnée administrative protégée (D173, `SCOUT_ADMIN_FIELDS`) : correction motivée et journalisée, jamais retirée ; fiche antérieure complétée librement.
- Fiche du routier : ligne « Sexe ». Tests d'intégration : toutes les inscriptions fournissent le sexe, inscription sans sexe refusée.

### Vérifications
- `lint`, `typecheck`, `test` (427), `build` ; intégration complète sur `tesla_test` : 188 réussis, 1 ignoré.
- Recette `parcours-anterieur.browser.mjs` adaptée (choix du sexe) mais **non relancée**.

### Reste
- Appliquer la migration sur `tesla` (`npm run db:deploy`) ; compléter le sexe des fiches existantes (aucune valeur déduite), puis éventuellement `NOT NULL`.
- Non exposé dans « Mon profil », la liste, les filtres ni les statistiques (à décider si utile).

## Refonte mobile (2026-11-16)

Branche `feat/refonte-mobile-lecons` (worktree séparé, intègre D181 ; non poussée). Décision D182. Interface web seulement : aucune migration, route API, permission ni règle pédagogique modifiée. Aucun déploiement.

### Réalisé
- Barre inférieure commune (`bottomTabsFor`, `activeBottomTab`, `moreNavigationFor`), menu « Plus », hamburger supprimé, barre masquée en passation et pendant la saisie ; sidebar repliable.
- Ajout direct d'une leçon (mobile, liste, module en ligne via version de travail explicite) ; en-tête de l'éditeur avec l'étape ; encart « module en ligne » simplifié.
- Reprise de lecture robuste aux nouvelles versions (`reading-position.ts`) ; ancien lien de leçon expliqué.
- Routiers sur téléphone : filtres repliables, lignes tactiles avec étape ; fiche compacte.
- Accueil de l'encadrement : accès « Cours et leçons ».
- Recettes `refonte-mobile` (Chromium et WebKit) et `accessibilite` (axe-core) ; recettes `referentiel-age` et `profil-progression` remises en conformité avec D176, D177 et D181.

### Vérifications
lint, typecheck, build OK ; unitaires API 297, web 128 ; intégration 188 (1 ignoré) ; recettes : refonte mobile 20/20 (Chromium et WebKit), accessibilité 33 écrans sans violation, ui-sweep sans problème, et 12 recettes de non-régression réussies. Détail et limites : [QUALITY/AUDIT_REFONTE_MOBILE_2026-11-16.md](QUALITY/AUDIT_REFONTE_MOBILE_2026-11-16.md).

### Reste
Fusion dans `main` ; recette sur iPhone et Android réels ; validation de l'absence d'onglet Évaluations pour le routier ; `programme-import` non rejouée (classeur réel hors dépôt).

## Parcours officiel (2026-11-16)

D181 intégré à `main` par `774ff0c`. Migration additive `20261119090000_prior_stage_recognitions` appliquée sur la base jetable `tesla_parcours_test` seulement. Aucun déploiement ; base `tesla` et production intouchées (lecture seule pour l'audit). Audit : [QUALITY/AUDIT_PARCOURS_ROUTIERS_2026-11-16.md](QUALITY/AUDIT_PARCOURS_ROUTIERS_2026-11-16.md) ; fonctionnel : [FEATURES/PARCOURS_ANTERIEUR.md](FEATURES/PARCOURS_ANTERIEUR.md).

### Réalisé
- Invariant « routier actif = une étape » : date de naissance obligatoire, refus explicite si l'étape est indéterminable (inscription, correction, réactivation), aperçu serveur `GET /scouts/stage-preview`, trigger SQL contre le retrait de la date.
- Parcours antérieur : `prior_stage_recognitions` (plein seul, historisé, révocable), à l'inscription et depuis la fiche ; rattrapages de l'étape reconnue non créés et non bloquants, aucun acquis fabriqué.
- Parcours : frise `timeline` (reconnue / période terminée / en cours / à venir), `priorStages`, indicateurs séparés côté routier ; panneau « Parcours antérieur » de la fiche.
- Lecture libre de tous les cours publiés (catalogue, leçons, impression, PDF, fichiers, hors ligne) ; verrou D177 limité aux évaluations et déclarations d'étude.
- Fiches sans étape signalées « À régulariser » ; diagnostic en lecture seule `npm run diagnose:stages -w @tesla/api`.

### Vérifications (2026-11-16, local)
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis ; `npm run format:check` : 3 avertissements **préexistants** sur `main` (fichiers non modifiés).
- `npm run test` : API **297**, web **112** réussis.
- Intégration (`tesla_parcours_test`, `NODE_ENV=test`) : 25 fichiers, **188 réussis**, 1 ignoré (classeur réel absent, préexistant), dont `parcours-anterieur.int-spec.ts` 5/5. Fixtures adaptées (inscription sans date de naissance désormais refusée). `prisma migrate diff` : aucune dérive.
- Recettes Chromium (API et web compilés, fixture fictive) : `parcours-anterieur.browser.mjs` **15/15** (360, 768, 1440 px), `rattrapages.browser.mjs` **4/4** (adaptée à D181), `progression-exception.browser.mjs` **8/8**, `offline-first.browser.mjs` **25/25**.

### Restant
- Base `tesla` : 21 routiers actifs sans date de naissance, `2026.2` non appliqué : appliquer migrations et seed, compléter les dates, reconnaître les parcours antérieurs, puis relancer le diagnostic. Contrainte `NOT NULL` à poser ensuite.
- Bibliothèque : filtre « Mon étape » ajouté ; onglet « Cours terminés » non réalisé (aucune donnée « terminé » côté catalogue).
- À valider : déclaration d'étude fermée pendant un rattrapage, visibilité de l'observation de reconnaissance par l'adjoint et les assistants.

## Parcours officiel (2026-11-16)

Branche `feat/parcours-anterieur-progression` (depuis `main` 23b1331, **non commitée, non poussée**). Décision D181. Migration additive `20261119090000_prior_stage_recognitions` appliquée sur la base jetable `tesla_parcours_test` seulement. Aucun déploiement ; base `tesla` et production intouchées (lecture seule pour l'audit). Audit : [QUALITY/AUDIT_PARCOURS_ROUTIERS_2026-11-16.md](QUALITY/AUDIT_PARCOURS_ROUTIERS_2026-11-16.md) ; fonctionnel : [FEATURES/PARCOURS_ANTERIEUR.md](FEATURES/PARCOURS_ANTERIEUR.md).

### Réalisé
- Invariant « routier actif = une étape » : date de naissance obligatoire, refus explicite si l'étape est indéterminable (inscription, correction, réactivation), aperçu serveur `GET /scouts/stage-preview`, trigger SQL contre le retrait de la date.
- Parcours antérieur : `prior_stage_recognitions` (plein seul, historisé, révocable), à l'inscription et depuis la fiche ; rattrapages de l'étape reconnue non créés et non bloquants, aucun acquis fabriqué.
- Parcours : frise `timeline` (reconnue / période terminée / en cours / à venir), `priorStages`, indicateurs séparés côté routier ; panneau « Parcours antérieur » de la fiche.
- Lecture libre de tous les cours publiés (catalogue, leçons, impression, PDF, fichiers, hors ligne) ; verrou D177 limité aux évaluations et déclarations d'étude.
- Fiches sans étape signalées « À régulariser » ; diagnostic en lecture seule `npm run diagnose:stages -w @tesla/api`.

### Vérifications (2026-11-16, local)
- `npm run lint`, `npm run typecheck`, `npm run build` : réussis ; `npm run format:check` : 3 avertissements **préexistants** sur `main` (fichiers non modifiés).
- `npm run test` : API **297**, web **112** réussis.
- Intégration (`tesla_parcours_test`, `NODE_ENV=test`) : 25 fichiers, **188 réussis**, 1 ignoré (classeur réel absent, préexistant), dont `parcours-anterieur.int-spec.ts` 5/5. Fixtures adaptées (inscription sans date de naissance désormais refusée). `prisma migrate diff` : aucune dérive.
- Recettes Chromium (API et web compilés, fixture fictive) : `parcours-anterieur.browser.mjs` **15/15** (360, 768, 1440 px), `rattrapages.browser.mjs` **4/4** (adaptée à D181), `progression-exception.browser.mjs` **8/8**, `offline-first.browser.mjs` **25/25**.

### Restant
- Base `tesla` : 21 routiers actifs sans date de naissance, `2026.2` non appliqué : appliquer migrations et seed, compléter les dates, reconnaître les parcours antérieurs, puis relancer le diagnostic. Contrainte `NOT NULL` à poser ensuite.
- Bibliothèque : filtre « Mon étape » ajouté ; onglet « Cours terminés » non réalisé (aucune donnée « terminé » côté catalogue).
- À valider : déclaration d'étude fermée pendant un rattrapage, visibilité de l'observation de reconnaissance par l'adjoint et les assistants.

## Refonte UX (2026-11-15)

Branche `feat/refonte-ux-editeur-hors-ligne` (non poussée). Décisions D178–D180. Migration additive `20261118090000_offline_devices` appliquée sur `tesla_test` seulement. Aucun déploiement.

### Réalisé
- Éditeur de module en sections, rédaction des leçons en deux zones, enregistrement automatique (brouillon local, conflits explicites), blocs pédagogiques, image de leçon depuis l'appareil, vérification avant envoi, aperçu téléphone ([architecture/EDITOR_UX.md](architecture/EDITOR_UX.md)).
- Retour de correction mutualisé modules/questionnaires ; envoi pour validation clarifié.
- Mot de passe unique en ligne et hors connexion : coffre format 3, `/auth/offline-devices`, reprotection, retrait d'appareil, conversion des anciens coffres ([architecture/OFFLINE_AUTH.md](architecture/OFFLINE_AUTH.md)).
- Notifications info/avertissement, sans répétition.

### Vérifications
lint, typecheck, build OK ; unitaires API 287, web 112 ; intégration 183 (1 ignoré) ; recettes Chromium : éditeur 15/15, mot de passe unique 17/17, offline-first 28/28, catalogue 8/8, gestion des modules 13/13, papier 7/7, balayage 343 affichages. Détail : [QUALITY/UX_ACCEPTANCE_TESTS.md](QUALITY/UX_ACCEPTANCE_TESTS.md) ; bilan : [QUALITY/REFONTE_FINAL_REPORT.md](QUALITY/REFONTE_FINAL_REPORT.md).

### Reste
Validation humaine D178–D180 et des durées ; préproduction (migration, R2 réel et CORS `GET`, Safari iOS) ; tableaux de bord, navigation et éditeur de questions non refondus.
## Rattrapages par étape et verrou des cours (2026-11-06)

Même branche `feat/progression-exception-secours` (non commitée). Décision D177. Aucun déploiement.

### Réalisé
- Migration additive `20261117090000_catch_up_delay_days` (colonne facultative, contrôle 1–365) ; `2026.2` : 21 jours par étape (seed non encore appliqué hors bases de test).
- `catchUpStageSchedule` / `catchUpDueOn` (jours) : étapes enchaînées dans l'ordre, échéances existantes conservées, plafond à la veille du 21e anniversaire.
- `catch-up-lock.ts` : verrou calculé à la lecture, utilisé par le parcours (`catchUpLock`, `blocking`, `locked`), le catalogue (liste, module, leçon, impression, PDF, paquet hors ligne, fiche), les fichiers, la déclaration d'étude et l'éligibilité (`VERROUILLE_RATTRAPAGE`, dérogation seule exception).
- Web : modules fermés dans la bibliothèque (sans lien), bandeau d'échéance, badges « Fermé » / « ensuite », délai en jours dans le référentiel, préparation hors ligne limitée aux modules ouverts.

### Vérifications (2026-11-06, local)
- lint, typecheck, format, build : réussis ; `npm run test` : API **286**, web **100**.
- Intégration (`tesla_d176_test`, `NODE_ENV=test`) : **177 réussis**, 1 ignoré ; dont `catch-up-lock.int-spec.ts` (arrivée à 20 ans : échéances J+20 / J+41 / J+62, verrou du catalogue, 403, évaluations en ligne et papier, études, dérogation, passage à l'étape suivante, levée complète, rien d'effacé). Un passage précédent de la suite complète a vu échouer une fois `refonte.int-spec.ts` (« adjoint et assistants ») : réussi seul 3/3 puis dans la suite complète suivante ; échec intermittent non reproduit, cause non établie.
- Recettes Chromium : `rattrapages.browser.mjs` **4/4** (360 et 1440 px), `progression-exception.browser.mjs` **8/8** rejouée sur la fixture enrichie.

### Restant
- **Aucun module n'est obligatoire** dans le catalogue réel : le verrou ne s'appliquera qu'une fois des modules marqués `OBLIGATOIRE` (source officielle exigée, D99) et publiés par le responsable.
- 21 jours retenus dans « 2 à 3 semaines » : à confirmer.
- Migrations et seed à appliquer sur `tesla` et en production après sauvegarde.


## Progression automatique, exception de secours et sortie à 21 ans (2026-11-06)

Branche `feat/progression-exception-secours` (depuis `main` a4a0450, **non commitée, non poussée**). Décision D176. Aucun déploiement (ni Vercel, ni OVH) ; base `tesla` et production intouchées.

### Audit de départ
- Moteur unique déjà en place (D173) : `computeAgeProgression` + `computed-stage.ts`, lu par éligibilité, catalogue, listes, statistiques, parcours, profil ; sortie à 21 ans calculée à la lecture (`effectiveMembership`), traitement quotidien idempotent ; `assertCanAtWrite` pour le plein.
- Écarts : référentiel `2026.1` limité au noviciat (étape non déterminée après 18 ans + 1 mois) ; aucune procédure de secours ; référentiel et version du calcul visibles de tout l'encadrement ; motifs détaillés des rattrapages (étape, référentiel) transmis au routier ; échéance de rattrapage calculée depuis la date de création (rétroactive pour un nouvel arrivant ou un nouveau référentiel) ; un routier sorti pouvait encore déclarer une étude ; étape `DEPART_ROUTIER` libellée « Départ routier » (confusion avec la cérémonie).

### Réalisé
- Référentiel `2026.2` (seed `seedAgeRuleSet2026_2`, en vigueur au 2026-11-06 ; `2026.1` inchangé) ; libellé « Préparation au Départ routier ».
- Migration additive `20261116090000_stage_overrides` : table `stage_overrides`, contrôles (période, motif, étape distincte, levée complète), exclusion `stage_overrides_no_overlap` (exceptions non levées), trigger `stage_overrides_guard` (ni suppression ni modification hors levée unique).
- `computedStageOf` : étape appliquée (`stage`), étape normale (`computedStage`), exception (`override`), calendrier cohérent ; exception ignorée après la sortie ou sans date de naissance.
- `StageOverridesService` / contrôleur : supervision, aperçu, création (verrou du profil, `assertCanAtWrite`), levée ; journal sans motif.
- Permissions : `progression.supervise` (plein) ; `ageRules.read` passe de l'encadrement au plein.
- Confidentialité : `ruleSetVersion` et motifs détaillés retirés du parcours, du profil et des indicateurs hors plein ; libellés courts côté web ; supervision exclue du cache hors ligne ; référentiel préparé hors ligne pour le plein seulement.
- Rattrapages : `catchUpReferenceDate` (fin d'étape, entrée ou création, publication, référentiel).
- Sortie : déclaration d'étude refusée après la sortie ; saisie de l'encadrement limitée aux études antérieures.
- Web : section « Supervision de la progression » de la fiche (plein) avec périodes, étape normale / appliquée, historique, dialogues d'exception (aperçu obligatoire) et de levée.

### Vérifications (2026-11-06, local)
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` : réussis.
- `npm run test` : API **280**, web **100** réussis (dont `progression-2026-2.spec.ts`, 39 cas : transitions, exemple du 27/10/2008, 00 h 00, fins de mois, 29 février, arrivée tardive, exception, échéances).
- Intégration PostgreSQL (base jetable `tesla_d176_test`) : 22 fichiers, **176 réussis**, 1 ignoré (classeur réel absent) ; dont `stage-override.int-spec.ts` 8/8 (plein, adjoint, assistant, routier, administrateur, ancien plein, concurrence, motifs, dates, chevauchement, levée, historique, routier sorti, DTO). `module-files.int-spec.ts` échoue si `NODE_ENV=development` est hérité du `.env` (préfixe de clé de stockage) : 9/9 avec `NODE_ENV=test`. `prisma migrate diff` : aucune dérive.
- Recette Chromium `apps/web/test/progression-exception.browser.mjs` (fixture `apps/api/test/progression-browser-fixture.mts`, API et web compilés) : **8/8** (routier à 360/768/1440 px sans explication ni défilement horizontal, supervision à 360/1440 px, aperçu obligatoire, exception appliquée, motif absent des autres profils et de l'API, adjoint / assistant / administrateur sans outil et 403, levée, retour au Compagnonnage, routier de 21 ans).

### Non vérifié / restant
- Migration et seed `2026.2` non appliqués sur `tesla` ni en production (`db:deploy` puis `db:seed` après sauvegarde).
- **À valider** : délai de rattrapage (durée courte), seuil d'alerte avant sortie, durée maximale d'une exception, information éventuelle de l'adjoint et des assistants qu'une exception est en cours.
- Aucun module n'est encore `OBLIGATOIRE` : aucune obligation de rattrapage n'est créée en pratique.
- Mode hors ligne : exclusions vérifiées par test unitaire et par l'absence de requête de préparation ; aucune recette navigateur hors connexion rejouée.


## Sobriété de l'interface et « Mon profil » simplifié (2026-11-06)

Branche `feat/simplification-libelles-profil` (depuis les commits D173). Décision D174. Interface seulement : aucune route API, permission, règle métier, migration ni mécanisme hors ligne modifié. Aucun déploiement.

### Réalisé
- « Mon profil » : cartes Identité, Progression, Connexion (adresse + mot de passe), fiche médicale ; sessions retirées de l'interface (fonctions web `sessionsQueryOptions`, `revokeSession`, `revokeOtherSessions` supprimées ; API inchangée).
- Fiche médicale : textes « facultatif » et répétitions supprimés, champs visibles, identité non répétée ; confidentialité en une phrase (`MEDICAL_RECORD_PURPOSE`).
- `PageHeading` : titre identique à l'entrée de menu masqué visuellement sous `lg` (lecteurs d'écran conservés).
- Accueil routier : étape, compteurs, rattrapages / acquis, à étudier, résultats, activités — blocs vides masqués. Accueil encadrement : files d'attente fusionnées (non vides), doublons retirés, indicateurs sur deux colonnes.
- Progression : frise + synthèse du parcours (étape calculée), historique d'étapes antérieur affiché seulement s'il existe.
- Modules (21 fichiers), évaluations (20), administration et activités (22) : descriptions, badges et messages redondants supprimés ou raccourcis.

### Vérifications (2026-11-06, local)
- `npm run lint`, `typecheck`, `format:check`, `build` : réussis ; `npm run test` : API 248, web 100.
- Recettes Chromium sur base jetable `tesla_profil_test` (API et web compilés) : profils 10/10 (dont absence des sessions et de « facultatif », fiche médicale chargée, titre unique, 360 → 1440 px), gestion des modules 13/13, hors ligne 25/25 (recette réalignée sur D172), distribution papier 7/7, lecture du catalogue 8/8 ; balayage 4 profils × 360/1440 px sans défilement horizontal ni squelette résiduel.
- Compléments (même jour) : fiche routier — étape affichée une seule fois (carte « Informations ») ; onglet « Progression » fusionné dans « Historique » (décisions d'étape antérieures, seulement s'il en existe) ; bouton « Voir ma copie » au lieu d'un libellé d'état ; « Soumissions » charge toutes les pages (plus de limite à 100) ; visibilité d'observation « Tout l'encadrement ».
- **Saisie du référentiel d'âge (D175)** : formulaire de brouillon et mise en vigueur sur `/administration/referentiel-age` (plein en fonction) ; contrôles de cohérence des périodes dans `createAgeRuleSetInputSchema` ; `assertCanAtWrite` dans la création et la mise en vigueur. Tests : intégration `age-rules.int-spec.ts` 3/3 (création, mise en vigueur, immutabilité, audit, incohérences, assistant, administrateur, plein remplacé) ; recette `referentiel-age.browser.mjs` 7/7 (valeurs fictives). Aucune période réelle saisie.
- Recettes complémentaires : comptes 11/11 (sessions absentes de « Mon profil »), balayage UI 490 affichages (4 profils × 7 largeurs) sans anomalie, import du programme 15/15 avec un classeur **fictif** généré par `apps/api/test/xlsx-fixture.ts` (hors dépôt). Intégration API (`tesla_test`) : 165 réussis, 1 ignoré (classeur réel).


## Profils protégés, gouvernance des droits et progression automatique (2026-11-06)

Branche `feat/profil-progression-automatique` (depuis `main` ce09603, **non commitée, non poussée, non fusionnée**). Décision D173. Aucun déploiement ; base de production et base `tesla` intouchées.

### Audit de départ (écarts constatés)
- Étape « officielle » saisie (inscription, `POST /scouts/:id/stage-changes`) et lue par l'éligibilité, les statistiques, les listes ; étape théorique calculée à part → deux vérités possibles.
- Fiches routiers gérées par le plein seul ; l'administrateur n'y avait pas accès ; correction d'une donnée sans motif (seule la date de naissance était journalisée) ; retrait d'une valeur sans contrôle.
- Date d'entrée obligatoire et préremplie avec la date du jour par le formulaire.
- « Mon profil » permettait au titulaire de modifier son nom ; aucune donnée Route ni progression affichée.
- Droits du plein recalculés à chaque requête (D132) mais non revérifiés dans la transaction d'écriture (fenêtre de concurrence avec un remplacement).

### Réalisé
- **Étape calculée** (`computed-stage.ts`) utilisée partout : fiche, liste et filtre, parcours, « Mon profil », éligibilité (en ligne, papier, distribution), résultats « concernés », statistiques, suivi, équipes, copies, propositions, catalogue, accueil du routier. Route, permission et champs de saisie d'étape supprimés (`422 STAGE_IS_COMPUTED`).
- Migration additive `20261115090000_computed_stage_admin_profiles` : `joined_at` facultatif ; triggers figeant `current_stage_id` / `current_stage_since` et fermant `scout_stage_changes` aux ajouts. Aucune donnée supprimée, aucune étape attribuée.
- Gouvernance : `scout.create/update/setMatricule/setActive/linkAccount` = administrateur ou plein ; `scout.read` ouvert à l'administrateur (fiche sans dossier pédagogique) ; `assertCanAtWrite` (verrou partagé `leadership_assignments`) dans les écritures de fiches et de comptes.
- Complétion / correction (`admin-changes.ts`) : motif + confirmation pour toute correction, ancienne et nouvelle valeurs au journal ; dates contrôlées ; aperçu `GET /scouts/:id/birth-date-impact` ; correction du nom d'un compte (administrateur) motivée.
- « Mon profil » : `GET /auth/profile` (lecture seule) ; `PATCH /auth/profile` supprimé ; page `/compte` en sections (identité, informations personnelles et Route, progression, compte, mot de passe, fiche médicale, sessions).
- Rattrapages : `arrival` (avant / depuis l'arrivée), statut `A_REEXAMINER` (jamais d'effacement) ; trois catégories distinctes (étape, à rattraper, acquis) sur le parcours du routier et la fiche.
- Web : formulaire de fiche sans étape ni date par défaut, panneau de correction avec aperçu ; fiche en lecture seule pour l'étape (historique conservé) ; navigation : « Routiers » pour l'administrateur, programme et équipes réservés à l'encadrement.
- Seeds de démonstration : date de naissance fictive au lieu d'une étape saisie.

### Vérifications (2026-11-06, local)
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` : réussis.
- `npm run test` : API 248, web 100 réussis.
- Intégration PostgreSQL (`tesla_test`) : 19 fichiers, **165 réussis**, 1 ignoré (recette du classeur réel, sans fichier) ; dont `gouvernance-profils.int-spec.ts` (7 : désignation, remplacement, ancienne session, appel direct, reconduction, administrateur, adjoint, **concurrence**, profils protégés, aperçu). `prisma migrate diff` : aucune dérive.
- Recette Chromium (`apps/web/test/profil-progression.browser.mjs`, base isolée `tesla_profil_test`, fixture `apps/api/test/profil-browser-fixture.mts`, API et web compilés) : **10/10** (profil routier en lecture seule à 360, 390, 768, 1024, 1440 px sans défilement horizontal ; trois catégories de modules ; refus API ; données manquantes ; complétion ; correction avec aperçu, motif, confirmation ; fiche et formulaire aux cinq largeurs ; administrateur sans pédagogie ; assistant en consultation ; aucune erreur JavaScript).

### Non vérifié / restant
- **Référentiel d'âge à compléter** : avec `2026.1`, toute personne hors du mois de noviciat a une étape non déterminée et n'accède qu'aux évaluations ouvertes par rattrapage ou déblocage. Écran de saisie disponible depuis D175 (« Référentiel d'âge », responsable plein) : reste à y saisir les périodes validées.
- Recette hors ligne (file d'attente) d'une correction motivée non rejouée dans le navigateur.
- Migration non appliquée sur `tesla` ni en production ; à appliquer après sauvegarde (`db:deploy`).
- Chefs : aucun champ date de naissance ni matricule (non prévus par le modèle, non ajoutés).

## Import Excel du programme annuel et suivi prévu / réalisé (2026-11-05)

Branche `feat/import-excel-programme` (non fusionnée, non poussée). Détails : [FEATURES/IMPORT_PROGRAMME_EXCEL.md](FEATURES/IMPORT_PROGRAMME_EXCEL.md), guide : [GUIDE_IMPORT_PROGRAMME_EXCEL.md](GUIDE_IMPORT_PROGRAMME_EXCEL.md), décision D172.

- Import `.xlsx` (lecteur interne borné, sans dépendance), colonnes détectées par libellé avec correspondance manuelle, choix de feuille et de ligne d'en-tête, anomalies localisées (feuille, ligne, colonne), prévisualisation sans écriture, rapprochements à décider, séances protégées, absentes signalées, confirmation liée à l'empreinte, historique des imports. Import Markdown conservé (même moteur).
- Migration additive `20261114090000_programme_excel_import` (colonnes facultatives, `activity_categories.planned_content`, `programme_imports` en ajout seul, contrôles CHECK) ; vérifiée sur base jetable, aucune dérive Prisma.
- Création d'une année et période du programme par le responsable.
- Fiche de séance : en-tête avec date initiale / effective, onglets Programme prévu, Réalisation, Présences, Prévu / réalisé, Historique ; nouveaux champs responsable effectif, objectifs atteints, décisions et suites, contenus prévus par catégorie.
- Vérifications : lint, typecheck, build ; unitaires 231 (API) + 99 (web) ; intégration PostgreSQL 159 réussis (dont 5 nouveaux, 14 historiques du programme inchangés), 1 ignoré (recette du classeur réel sans fichier).
- Recette du classeur officiel 2026–2027 (hors dépôt, base `_test`) : 43 séances reconnues et créées, 0 erreur, 3 avertissements attendus (note de bas de page fusionnée, période non renseignée) ; comparaison indépendante (lecture XML en Python) : **516 valeurs, 0 écart** ; réimport : 43 inchangées ; 0 présence créée.
- Recette Chromium (`apps/web/test/programme-import.browser.mjs`, base isolée `tesla_excel_test`, comptes fictifs, API et web compilés) : **15/15 contrôles** (hors connexion, prévisualisation, quatre contenus, confirmation, calendrier, idempotence, fiche et comparaison, historique, présences, protection au réimport, 360 px sans défilement horizontal, droits du chef, aucune erreur JavaScript).
- Non vérifié : relais Vercel avec un corps de plusieurs centaines de ko (à recetter en production) ; API en mode production locale (clé médicale requise : recette faite en mode développement sur le même build) ; import réel en production.

## Gestion des modules V2 (2026-11-04)

Fusionnée dans `main` (58e62f1) le 2026-11-05 ; finalisation sur `fix/modules-v2-finalisation`. Décision D171, détail : [FEATURES/MODULES_MANAGEMENT_V2.md](FEATURES/MODULES_MANAGEMENT_V2.md). Aucun déploiement.

### Réalisé
- API : recherche et filtres combinables appliqués en base, tri stable, pagination serveur (`module-list-query.ts`) ; `GET /editor/module-stats` ; diagnostic et suppression individuelle d'un brouillon (`module-draft-deletion.service.ts`) ; migration `20261113090000_delete_module_drafts` (fonction `delete_module_draft`, aucune table ni colonne).
- Web : page refondue (4 indicateurs compacts, 4 contrôles, filtres avancés repliables, vues rapides, pastilles, URL), tableau / cartes, menu d'actions, confirmation de suppression, retour à la liste filtrée depuis l'éditeur, l'aperçu et la révision. Primitive `ui/dropdown-menu` (Radix déjà présent, aucune dépendance ajoutée).

### Vérifications (2026-11-04, local)
- `npm run lint`, `typecheck` (API, web), `format:check`, `build` : réussis. `npm run test` : API 213, web 99 réussis.
- Intégration (`tesla_test`) : 17 fichiers, 154 tests réussis, dont `modules-management.int-spec.ts` (10, tri français compris). `prisma migrate diff` : aucune dérive.
- Recette Chromium (`apps/web/test/modules-management.browser.mjs`, base isolée `tesla_modulesv2_test`, données fictives) : **13/13 contrôles réussis** le 2026-11-05 (liste, recherche, filtres, vues rapides, duplication et retour, Précédent, module publié non supprimable, suppression avec double clic → une requête, abandon de version, pagination corrigée, tri alphabétique français, responsive 360 / 390 / 768 / 1024 / 1440 px sans débordement de la page ni du tableau, périmètre et menu du chef). Captures : [QUALITY/modules-v2-2026-11-04/](QUALITY/modules-v2-2026-11-04/).

### Restant
- Vérifier la collation `fr-x-icu` sur le PostgreSQL de production avant déploiement.
- Mineur : à 1024 px, libellés longs des listes légèrement rognés (« Toutes les étape… »).

## Refonte UI/UX locale (2026-11-03)

Branche `feat/refonte-ui-ux-tesla` (depuis `main` 0e28d59, non commitée à la date du rapport, non poussée). Décision D169. Aucun déploiement ; aucun changement backend ni de migration.

### Réalisé
- Audit des 68 routes : [UI_UX_AUDIT.md](UI_UX_AUDIT.md). Design system : [UI_UX_DESIGN_SYSTEM.md](UI_UX_DESIGN_SYSTEM.md).
- Statistiques : 8 indicateurs, 5 graphiques Recharts avec tableau des valeurs, détail par équipe, filtres étiquetés.
- Programme annuel : synthèse (avancement, à venir, en retard, mois sans séance), calendrier mensuel, chronologie, import Markdown et correspondance repliés (logique inchangée).
- Activités, présences, détail d'activité, progression, mes compétences, mes activités : remis dans le design system (états, dates formatées, champs étiquetés, pagination partagée).
- Navigation : intertitres dans les rubriques longues (rubriques D141 inchangées).
- Sûreté : confirmation avant retrait d'une ressource ou d'un collaborateur ; alerte avant de quitter une évaluation avec une réponse non enregistrée ; `ConfirmDialog` dans « Cet appareil ».
- Composants : `StatCard`, `ChartCard`, `CategoryBarChart`, `SeriesLineChart`, `ProgressBar`, `Stepper`, `Disclosure`, `SearchInput`, `ProgrammeCalendar` ; `TableSkeleton` annoncé aux lecteurs d'écran ; titres d'onglet des pages d'administration.

- Fiche médicale (D170) : quatre sections communes au formulaire et au PDF, aides à la saisie, champs facultatifs repliés, PDF réorganisé ; aucun champ, chiffrement, permission ni route modifiés.

### Vérifications exécutées
Voir [UI_UX_TEST_REPORT.md](UI_UX_TEST_REPORT.md) : lint, typecheck, tests (API 207, web 93), format et build réussis ; captures Playwright de 360 à 1440 px sur une base locale `tesla_local` (données fictives), aucun débordement horizontal.

### Non exécuté / restant
- Écritures (statut, présences, import, passation) non rejouées dans le navigateur ; hors ligne préparé non testé visuellement.
- P2 restants et arbitrage de la règle `/administration/equipes` : [UI_UX_IMPLEMENTATION_PLAN.md](UI_UX_IMPLEMENTATION_PLAN.md).

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
- Création d'un référentiel d'âge par l'interface : disponible depuis D175.
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
- **Administrateur technique** (D142) : comptes et désignation de l'encadrement dans « Administration », sa propre fiche médicale depuis D191 (permission `medicalRecord.own`).
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

## Référentiel scout (2026-11-25, chantier parallèle)

Branche `feat/tesla-scout-reference` (worktree `../tesla-scout-reference`, depuis 58b231f, **non commitée**). Décisions D220–D222 ; documentation [FEATURES/REFERENTIEL_SCOUT.md](FEATURES/REFERENTIEL_SCOUT.md) ; suivi, tests et stratégie d'intégration avec le chantier immersif : [TESLA_SCOUT_REFERENCE_PROGRESS.md](TESLA_SCOUT_REFERENCE_PROGRESS.md). Migration additive `20261130090000_scout_reference` appliquée sur `tesla_scout` et `tesla_scout_test` seulement.
