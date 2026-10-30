# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions selon SemVer.

## [Non publié]

### Modifié — gouvernance simplifiée et application unique, 2026-10-30
- Une seule application : accueil commun (`/accueil`) et menu unique affichant les seules fonctionnalités autorisées ; plus aucun espace, rôle technique ni libellé de permission affiché.
- Le responsable plein, l'adjoint et les assistants sont désignés directement par l'administrateur depuis la page « Encadrement » (`/communaute`), visible de tous ; remplacement du plein confirmé et immédiat, historique conservé.
- Anciennes adresses redirigées (`/routier`, `/encadrement`, `/chef`, `/responsable` → accueil ; `/mandats` → encadrement).
- Hors ligne : une opération préparée par une personne qui n'est plus habilitée est rejetée au retour du réseau et conservée ; la session est relue dès qu'un droit est refusé.

### Supprimé — gouvernance simplifiée, 2026-10-30
- Mandats annuels, années scoutes, reconductions et délégations (écran, API `/mandates`, `/delegations`, `/scout-years`). Les données existantes restent en base, en lecture seule ; les mandats en vigueur ont été repris comme fonctions.

### Ajouté — bibliothèque de formation à la Route, 2026-10-30
- Catalogue initial de formation à la Route en brouillon : dix modules rédigés d'après le manuel SAPF-Route (Noviciat à Départ routier, 71 leçons) et la Prière de la Route (version rédactionnelle à valider) ; modules 01–02 repris des brouillons « Bases du scoutisme ».
- Textes fondamentaux : catégorie de module, citation d'un texte par d'autres modules sans copie, rubrique dans la bibliothèque.
- Duplication d'un module depuis l'éditeur.
- Matrice de correspondance entre le manuel SAPF-Route et le référentiel d'âge (aucune règle nouvelle codée).
- Mise en service du catalogue (commande) : brouillons vides supprimés, modules et questionnaires d'entraînement publiés au nom du responsable.
- Suppression d'un brouillon vide par le responsable (motif, journal d'audit).
- Téléchargement d'un cours en PDF aux couleurs de la communauté (logo, nom, page de garde, en-tête et pied de page).

### Ajouté — préparation à la production, 2026-10-30
- Comptes : création par l'administration technique ou par décision officielle (comptes routiers, depuis la fiche), lien d'activation ou de réinitialisation à usage unique, désactivation motivée, réactivation, fermeture des sessions ; écran « Comptes ».
- « Mon compte » : nom affiché, changement de mot de passe, sessions ouvertes.
- Installation du premier administrateur en ligne de commande (`admin:create`), sans mot de passe codé.
- Exploitation (non déployée) : systemd, Nginx, scripts de déploiement, de retour arrière, de sauvegarde chiffrée, de restauration et de contrôle de santé ; documentation de production.
- CI : intégration PostgreSQL, contrôle des migrations, recettes navigateur, audit des dépendances.

### Corrigé — préparation à la production, 2026-10-30
- Appareil partagé : le coffre local d'un autre compte est verrouillé avant toute lecture.
- Une délégation cesse avec le mandat de son titulaire.
- Boucle de redirection après expiration de session.
- La première visite ne recharge plus la page (saisie conservée).
- « Prêt pour une utilisation sans connexion » n'est plus affiché si des données manquent ; un module téléchargé n'est plus mêlé à son ancienne version.
- Une saisie hors ligne n'est plus fusionnée avec une écriture déjà envoyée (faux conflit).
- Pages de création et de modification de fiche disponibles hors ligne après préparation.
- Limitation des tentatives de connexion conservée au redémarrage.
- En-têtes de sécurité, `Cache-Control: no-store` sur l'API, journaux sans chaîne de requête, API à l'écoute locale en production.
- Date de naissance : ancienne et nouvelle valeur journalisées ; traitement quotidien refusant une date future.

### Ajouté — offline-first global, 2026-10-30
- Tesla s'ouvre et se parcourt sans Internet après une préparation en ligne (« Cet appareil ») : mêmes écrans, même navigation, données du compte chiffrées sur l'appareil.
- Saisies sans réseau, provisoires jusqu'à la synchronisation : présences, activités et comptes rendus, observations, fiches, changements d'équipe ; conflits détectés et résolus explicitement.
- Évaluations préparées passées dans leur écran habituel, avec ou sans réseau.
- Indicateur discret : hors connexion, modifications en attente, conflits, date des données, mise à jour disponible.
- API : écritures rejouables sans doublon (`x-tesla-operation-id`, table `client_operations`), versions de référence facultatives, `authorityValidUntil` dans `/auth/me`.

### Modifié — offline-first global, 2026-10-30
- Onglet « Hors ligne » supprimé ; `/telechargements` et `/synchronisation` redirigent vers `/appareil` ; `/hors-ligne` ne sert plus qu'aux pages jamais préparées.
- Coffre local ouvert à tous les rôles, un coffre par compte ; service worker `v4`.

### Modifié — sobriété des interfaces, 2026-10-29
- Plus aucun état technique (serveur, version d'API) affiché aux utilisateurs ; supervision inchangée.
- Titres et libellés de menu raccourcis, descriptions de page limitées aux règles utiles, états vides allégés.
- Tableaux de bord épurés (sous-titres, surtitres, indications redondantes) ; centre hors ligne avec statuts lisibles.
- Messages d'erreur réseau plus courts, avec l'action suivante.

### Ajouté — refonte parcours Route et mandats, 2026-10-29
- Étape théorique selon l'âge (référentiel versionné), échéances, sortie de la branche à 21 ans sans suppression d'historique, plans de rattrapage avec décision humaine.
- Fonctions plein / adjoint / assistant par mandats annuels historisés, reconductions explicites illimitées, délégations ; permissions selon la fonction en vigueur.
- Typologie des modules (découverte, étape, complémentaire ; obligation ; source officielle) et catalogue « Découvrir la Route » en brouillons.
- Écrans : responsables et mandats, mes rattrapages, référentiel d'âge, parcours sur le tableau de bord du routier et la fiche, indicateurs de parcours.
- API : `/age-rules`, `/scouts/:id/pathway`, `/me/pathway`, `/statistics/pathways`, `/catch-ups/:id/decision`, `/membership/apply-exits`, `/leadership`, `/mandates`, `/scout-years`, `/delegations` ; `GET /auth/me` expose `leaderFunction` et `permissions`.

### Modifié — refonte, 2026-10-29
- Rôles `CHEF` et `RESPONSABLE` remplacés par le rôle `ENCADREMENT` (ancien rôle conservé) ; aucun mandat attribué d'office.
- Espaces `/chef` et `/responsable` fusionnés dans `/encadrement` (redirections).
- Seed : comptes fictifs renommés, compte d'administration technique, référentiel d'âge `2026.1`.

### Modifié — accueil, connexion et animations, 2026-10-29
- Accueil : bandeau animé (halos, logo auréolé, apparition en cascade), section « Un espace pour chacun » par rôle, principes de la plateforme, pied de page.
- Connexion : panneau de marque et formulaire côte à côte sur desktop ; sur mobile, bandeau de marque et carte qui remonte. Affichage du mot de passe, indicateur de chargement, secousse de l'alerte en cas d'échec.
- Animations sur tous les écrans : entrée en cascade de chaque page, blocs des tableaux de bord, titre d'en-tête en fondu, menu latéral animé à l'ouverture et à la fermeture, groupes repliables qui se déplient en douceur, pastille et rebond de l'onglet actif du routier, lignes de tableau, alertes et états vides en fondu, retour visuel au toucher sur les boutons. Aucune dépendance ajoutée ; « réduire les animations » est respecté (délais compris).
- Composant `PasswordInput` (bouton afficher/masquer, `aria-pressed`) pour le mot de passe de connexion et la phrase locale du coffre hors ligne.

### Modifié — parcours du responsable et des chefs, 2026-10-29
- Tableaux de bord de l'encadrement recentrés sur l'action : bandeau d'accueil, actions rapides, file « À faire maintenant » d'éléments réels (titre, auteur ou routier, ancienneté, lien direct), frise de l'année construite à partir du programme ; indicateurs déplacés en bas de page.
- API : `GET /dashboard/responsable` et `GET /dashboard/chef` renvoient en plus `tasks`, `taskTotal` et `year` (ajout compatible, contrat `@tesla/shared`).
- Menu de l'encadrement allégé : groupes secondaires repliables, programme annuel dans le pilotage du chef, publications regroupées dans les référentiels du responsable.

### Modifié — navigation par rôle et stabilisation, 2026-10-29
- Plus d'écran de choix d'espace : chaque rôle arrive sur son tableau de bord après connexion, sur `/`, sur `/connexion` déjà connecté et après une session restaurée ; `?suivant=` n'est suivi que vers une page interne autorisée au rôle.
- Menu unique groupé par rôle (`lib/navigation.ts`) dans un cadre commun : sidebar desktop, menu latéral mobile, barre d'accès rapides du routier ; le responsable accède aux fonctions des chefs sans changer de menu.
- Route non autorisée : notification et retour au tableau de bord ; session expirée en cours d'usage : retour à la connexion avec la page demandée.
- Tableaux de bord refondus (KPI, files d'actions séparées contenus / personnes, répartitions par équipe et par étape, chronologie) ; titres de page en `h1`.
- Service worker `v3` (coquille hors ligne mise à jour).

### Supprimé
- `lib/spaces.ts`, `SpaceNav` et quatre composants inutilisés ; entrées « Téléchargements » et « Synchronisation » fusionnées en « Hors ligne » (URL conservées).

### Corrigé
- Erreur ESLint `no-unused-vars` dans `apps/api/prisma/seed.ts` (voir docs/QUALITY/ESLINT_AUDIT.md).

### Ajouté — modules « Bases du scoutisme », 2026-10-29
- Seed pédagogique idempotent : quatre modules `NT-SCOUT-M01` à `M04` (21 leçons) importés en brouillon depuis « BASE DU SCOUTISME », sans approbation ni publication ; prévisualisation `npm run db:seed:pedagogy -- --dry-run` ; rapport d'écarts sans écrasement.
- Migration additive `20261102090000_module_source_imports` : auteur facultatif (création système) sur modules, versions, leçons et événements de création ; provenance en ajout seul avec notes éditoriales.
- Éditeur et révision : encart de provenance et notes éditoriales (rédacteurs uniquement) ; auteur affiché « Import système ».

### Ajouté — phase 5 (PWA hors ligne), 2026-10-29
- Coffre local IndexedDB chiffré (AES-GCM, phrase locale), téléchargement versionné et vérifié des modules publiés, lecture hors ligne avec position, suppression locale et mises à jour proposées.
- Évaluations hors ligne : réservation serveur de 24 h après contrôle d'éligibilité, saisie et reprise locales, file de synchronisation bornée, réception transactionnelle et idempotente avec revérification des droits, correction serveur, conflits et rejets motivés.
- API : `GET /modules/:slug/offline-package`, `POST /offline/evaluations/:id/prepare`, `GET /offline/attempts/:id/status`, `POST /offline/attempts/:id/sync`, `GET /me/offline-sync/status` ; migration additive `20261101090000_offline_reservations`.
- Web : `/hors-ligne` (alias `/telechargements`, `/synchronisation`), `/evaluations/[id]/preparer`, service worker `v2` ; recette Chromium et fixture fictive.

### Corrigé — phase 5
- Une page ouverte sans réseau relance désormais ses requêtes en erreur au retour de la connexion (session et menu de compte retrouvés).

### Ajouté — phase 4, 2026-10-29
- Progression et historique structuré des étapes, compétences et preuves, propositions et décisions officielles du responsable, révocation tracée ; suivi des modules étudiés, y compris papier et sans compte.
- Programme annuel : import Markdown prévisualisé et idempotent, correspondances catégories/étapes à confirmer ; activités, comptes rendus, présences groupées et historique.
- Dossier pédagogique complet, espaces personnels et tableaux de bord par rôle, statistiques réelles filtrables ; navigation et contrats partagés.
- Migration additive `20261031090000_progression_programme_activities` et tests unitaires/intégration PostgreSQL. Aucun contenu pédagogique officiel généré.


### Ajouté — phase 3 (évaluations, papier, résultats), 2026-10-29
- Modèle : questionnaires versionnés (états et triggers identiques aux modules), questions, propositions, réponses et corrections, historique des questionnaires ; colonnes de passation et révision de correction sur les tentatives (migration additive `20261030090000_evaluation_engine`, reprise des versions historiques).
- Moteur de correction déterministe partagé (`gradeObjectiveAnswer`) : choix unique, vrai/faux, choix multiples tout ou rien ou crédit partiel ; réponses libres notées par un chef.
- API : rédaction `/editor/evaluations/*`, approbation `/admin/evaluations/*`, évaluations publiées et éligibilité `/evaluations`, passation `/evaluations/:id/attempts`, `/attempts/:id/{answers,submit}`, historique `/me/attempts`, papier `/paper-attempts` (+ PDF questionnaire, corrigé, grille via pdfkit), correction `/corrections/*`, examen `/admin/attempts/*`, déblocages `/admin/waivers/*` ; Swagger.
- Web : espace chef (questionnaires, éditeur de questions, aperçu, évaluation papier en un écran, corrections), espace routier (évaluations, passation mobile, mes résultats), espace responsable (questionnaires à approuver, résultats à examiner, déblocages), compteurs du tableau de bord.
- Tests : 27 tests unitaires (contrats, moteur de correction, éligibilité), 5 tests d'intégration HTTP couvrant les deux parcours, recette navigateur (23 contrôles).

### Modifié — phase 3, 2026-10-29
- `EvaluationAttemptsService` : saisie relationnelle des réponses (remplace `recordPaperResult`/`decide`), examen par `acceptReview`/`requestCorrection` ; tests d'intégration papier de la phase 1 bis adaptés.
- Libellés : `VALIDEE` → « Résultat accepté », `REFUSEE` → « Résultat non retenu » (jamais une validation d'acquis).
- `ModuleHistory` affiche aussi les versions de questionnaires ; énumérations des tentatives isolées dans `evaluation-enums.ts` (évite un cycle d'import).
- Dépendance API : `pdfkit` 0.20.2 (+ `@types/pdfkit`).

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
