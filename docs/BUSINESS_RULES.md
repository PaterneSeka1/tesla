# Règles métier

> Statut : règles **documentées** ; celles des routiers, équipes, observations, de l'authentification et des modules pédagogiques sont **implémentées** (voir [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)). Source : cahier de la mission, document SAPF-Route (Atelier pédagogique Branche Route), programme annuel 2026–2027 de la Communauté Nikola Tesla.

## Périmètre
- Une communauté (Nikola Tesla), une branche (Route), année scoute 2026–2027.
- Environ 25 routiers, 4 chefs, 1 responsable pédagogique principal.

## Rôles et permissions

> **Gouvernance 2026-10-30 (D132)** : la colonne « Chef » vaut pour **tout membre de l'encadrement** (avec ou sans fonction, adjoint et assistants compris) ; la colonne « Responsable » pour le **responsable plein en fonction**, désigné par l'administrateur. Aucun mandat, aucune délégation. Rôles et permissions restent internes et ne sont jamais affichés. Matrice de référence : `packages/shared/src/permissions.ts`.

| Action | Routier | Chef | Responsable |
| --- | :---: | :---: | :---: |
| Consulter les modules publiés | ✅ | ✅ | ✅ |
| Télécharger un module pour lecture hors ligne (coffre local chiffré, D79) | ✅ | ✅ | ✅ |
| Préparer et synchroniser une évaluation hors ligne (sa propre tentative) | ✅ | — | — |
| Préparer l'appareil et consulter sans connexion son périmètre autorisé (D115) | ✅ | ✅ | ✅ |
| Saisir sans connexion présences, activités, observations (provisoire, D110) | — | ✅ | ✅ |
| Créer ou modifier une fiche, changer d'équipe sans connexion (provisoire, revérifié) | — | — | ✅ |
| Créer un module ; modifier un brouillon dont on est auteur ou collaborateur | — | ✅ | ✅ (tous les modules) |
| Inviter / retirer un chef collaborateur | — | auteur du module | ✅ |
| Soumettre un module à l'approbation | — | auteur, collaborateur | ✅ |
| Approuver, demander des corrections, refuser, publier, archiver un module | — | — | ✅ |
| Consulter la file de validation et l'historique des publications | — | — | ✅ |
| Consulter les évaluations publiées (sans corrigé) | ✅ | ✅ | ✅ |
| Passer une évaluation en ligne (étape ou déblocage) | ✅ | — | — |
| Rédiger un questionnaire, ses bonnes réponses et barèmes ; le soumettre | — | auteur, rédacteur du module évalué | ✅ (tous) |
| Approuver, demander des modifications, refuser, publier, archiver un questionnaire | — | — | ✅ |
| Corriger une copie (papier ou en ligne), consulter un corrigé | — | ✅ (toutes les copies, à confirmer) | ✅ |
| Consulter les fiches, équipes et historiques des routiers | — | ✅ | ✅ |
| Inscrire / modifier un routier (avec ou sans compte), attribuer le matricule | — | — | ✅ (à confirmer, D32) |
| Changer l'étape d'un routier (acte officiel journalisé) | — | — | ✅ |
| Activer / désactiver un profil routier | — | — | ✅ |
| Rattacher un compte à un profil routier | — | — | ✅ (à confirmer) |
| Créer / modifier / archiver une équipe | — | — | ✅ (à confirmer) |
| Affecter un routier à une équipe, changer son équipe | — | — | ✅ (à confirmer, D32) |
| Saisir une observation, modifier la sienne | — | ✅ | ✅ |
| Lire les observations « chefs et responsable » | — | ✅ | ✅ |
| Lire les observations « responsable uniquement » | — | auteur seulement | ✅ |
| Préparer une feuille papier, saisir et soumettre un résultat | — | ✅ | ✅ |
| Rechercher une tentative par code, imprimer questionnaire, corrigé, grille | — (son historique via « Mes résultats ») | ✅ | ✅ |
| Examiner un résultat soumis (accepter / demander une nouvelle correction), rouvrir | — | — | ✅ |
| Accorder / révoquer un déblocage individuel | — | — | ✅ |
| Valider officiellement un acquis | — | — | ✅ |

Le responsable plein détient toutes les permissions de l'encadrement (matrice `packages/shared/src/permissions.ts`) : il rédige, prépare le papier et corrige avec son unique compte, dans l'espace unique `/encadrement` (D105). Navigation : [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md).
| Consulter sa propre progression | ✅ | — | — |
| Consulter la progression des routiers | — | ✅ | ✅ |
| Gérer les comptes | — | — | ✅ (à confirmer) |

Toutes les permissions sont vérifiées côté serveur.

## Règles

1. **Publication** : un module n'est visible des routiers qu'une fois **approuvé puis publié** par le responsable. Cycle implémenté : `BROUILLON → SOUMIS → APPROUVE → PUBLIE → ARCHIVE`, avec `SOUMIS → A_CORRIGER | REFUSE` (motif) et `A_CORRIGER → BROUILLON`. Toute modification d'un module publié crée une nouvelle version soumise à approbation (voir [FEATURES/WORKFLOW_PUBLICATION.md](FEATURES/WORKFLOW_PUBLICATION.md)).
2. **Consultation libre** des modules publiés, sans condition de progression.
3. **Évaluations contrôlées** : accessibles selon l'étape de progression du routier.
4. **Déblocage individuel** : exception nominative accordée par le responsable, motivée, tracée, révocable.
5. **Validation des acquis** : exclusivement humaine, par le responsable. Un résultat d'évaluation est une information, jamais une décision automatique.
6. **Audit** : approbations, déblocages, validations et changements d'étape sont journalisés (`AuditLog`).

## Règles identifiées (phase 1 bis — routiers, équipes, évaluations papier)

> Statut : RM-001 à RM-004 et RM-012 (profils, équipes) **implémentés de bout en bout** (routes, écrans, tests) ; RM-005 à RM-011 (tentatives) : **exposées par des routes et des écrans en phase 3** (voir [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)).

| ID | Règle | Énoncé | Garantie |
| --- | --- | --- | --- |
| RM-001 | Routier sans compte | Le profil routier est la référence métier. Il existe sans compte ; un compte (facultatif, unique) peut y être rattaché plus tard, sans perte de données ni second profil. Toute évaluation, dérogation ou validation référence le profil. | `scout_profiles.user_id` nullable + unique ; rattachement conditionnel `user_id IS NULL` |
| RM-002 | Matricule facultatif et unique | Chaîne de caractères au format officiel **7 chiffres suivis d'une lettre** (ex. `0000001A`, zéros initiaux conservés), facultative, unique si renseignée, normalisée (espaces supprimés, majuscules), jamais générée. Ce n'est ni un identifiant technique ni un code de tentative. | Index unique + CHECK de forme normalisée |
| RM-003 | Affectation à une équipe | Un routier appartient à au plus une équipe à un instant donné ; il peut être temporairement sans équipe. Pas de multi-paroisse ni multi-district. | Index unique partiel (affectation ouverte) |
| RM-004 | Historisation des équipes | Un changement d'équipe clôt l'affectation précédente (date de fin, auteur) et en ouvre une nouvelle. Les évaluations restent liées au profil ; l'équipe à une date passée se déduit de l'historique. | Contrainte d'exclusion (périodes sans chevauchement) |
| RM-005 | Impression des modules | Documents : support de cours, questionnaire nominatif, corrigé chef, grille de correction. Le corrigé n'est accessible qu'aux chefs et au responsable. Génération sans service d'IA. | Questionnaire, corrigé et grille : PDF serveur (pdfkit) ; support de cours : impression navigateur |
| RM-006 | Questionnaire papier nominatif | Un chef ou le responsable prépare une tentative papier (routier, évaluation, version publiée) → statut `PREPAREE`. La feuille affiche communauté, évaluation, code, identité, matricule, équipe à la date de préparation, date prévue, questions et espaces de réponse ; jamais le corrigé. Réimprimer ne crée pas de tentative ; repasser l'évaluation exige une nouvelle préparation explicite. | `POST /paper-attempts`, `GET /paper-attempts/:code/pdf` (lecture seule) |
| RM-007 | Code unique de tentative | `NT-AAAA-NNNNNN` (NT = Nikola Tesla, année civile UTC d'émission, rang dans l'année). Généré par le backend, unique, immuable, jamais réutilisé (une tentative annulée garde son code). Identifiant de recherche, **pas un secret** : la recherche par code est soumise aux permissions. | Compteur transactionnel annuel ; unique ; CHECK de format ; trigger d'immutabilité |
| RM-008 | Saisie de résultat papier | Le chef retrouve la tentative par son code, saisit date de réalisation, réponses, score facultatif, observations, référence de la copie numérisée, puis soumet au responsable. Toute saisie est historisée ; une correction après soumission exige un motif. | Historique `evaluation_attempt_events` en ajout seul |
| RM-009 | Contrôle de l'éligibilité | Avant toute préparation (avec ou sans compte) : routier existant, version publiée, évaluation de l'étape courante du routier **ou** dérogation active (non révoquée, non expirée) accordée par le responsable avec motif, date, expiration éventuelle, révocation tracée. | Service + `AuditLog` des dérogations |
| RM-010 | Validation humaine | Un chef saisit, corrige et soumet ; seul le responsable décide (`VALIDEE` / `REFUSEE`). Cette décision porte sur le résultat, pas sur l'étape : aucun statut ne modifie automatiquement la progression. La validation officielle d'un acquis ou d'une étape est un acte distinct du responsable. | Permissions serveur ; aucun accès à `current_stage_id` dans le service |
| RM-011 | Conservation des résultats | Résultats papier et numériques dans la même table (historique unifié). Une tentative n'est jamais supprimée (annulation = statut `ANNULEE`) ; une tentative décidée n'est modifiable qu'après réouverture motivée par le responsable. | Trigger anti-suppression ; transitions contrôlées |
| RM-012 | Prévention des doublons | Au plus une tentative non clôturée (`PREPAREE`, `EN_COURS`, `A_CORRIGER`, `SOUMISE`) par routier et par évaluation ; un seul profil par compte ; un matricule par routier. | Index uniques (dont partiel) |

### Règles de la phase 1 (authentification, fiches, observations)

| ID | Règle | Énoncé | Garantie |
| --- | --- | --- | --- |
| RM-013 | Inscription sans compte | Créer une fiche ne demande ni e-mail ni mot de passe et ne crée jamais de compte. Un homonyme exact exige une confirmation explicite. | Contrat `createScoutProfileInputSchema` ; `POSSIBLE_DUPLICATE` |
| RM-014 | Désactivation | Un profil désactivé reste consultable avec tout son historique ; son affectation ouverte est clôturée ; il ne peut plus être affecté. Réactivation possible. | Service + `AuditLog` |
| RM-015 | Archivage d'équipe | Archiver clôt les affectations ouvertes (date, auteur) ; l'équipe et l'historique sont conservés ; une équipe archivée ne reçoit plus de membres et n'est plus modifiable. | Transaction + `AuditLog` |
| RM-016 | Observations | Information d'accompagnement d'un chef ou du responsable, référencée sur le profil. Ne vaut jamais validation d'acquis ni changement d'étape. Jamais visible des routiers ; niveau `RESPONSABLE` lisible par le responsable et l'auteur seulement. Modifiable par son auteur seul ; chaque version précédente est conservée ; jamais supprimée. | Permissions serveur ; triggers SQL |
| RM-017 | Changement d'étape | Exclusivement le responsable ; journalisé avec l'étape précédente, la nouvelle et l'auteur ; visible dans l'historique pédagogique. Aucune autre action (observation, tentative) ne modifie l'étape. | `scout.setStage` ; `AuditLog` `scout_profile.stage_changed` |
| RM-018 | Accès | Toute donnée exige une session valide ; le masquage d'un bouton n'est jamais la seule protection. L'e-mail d'un compte rattaché n'est communiqué qu'au responsable. | Garde globale + `assertCan` |

### Règles de la phase 2 (modules pédagogiques)

| ID | Règle | Énoncé | Garantie |
| --- | --- | --- | --- |
| RM-019 | Rédaction | Un chef crée un module et rédige les modules dont il est auteur ou collaborateur ; il ne voit pas les brouillons des autres. Le responsable intervient sur tous. | `editableModulesWhere`, `resolveAccess` (404 hors périmètre) |
| RM-020 | Publication réservée | Seul le responsable approuve, demande des corrections (motif), refuse (motif), publie et archive (motif). | `module.review` + `AuditLog` |
| RM-021 | Version figée | Une version soumise, approuvée, publiée, refusée ou archivée n'est plus modifiable ; seule une version `BROUILLON` l'est. | Service + trigger `module_versions_guard` / `module_draft_content_guard` |
| RM-022 | Publication atomique | Publier exige une version approuvée ; la version précédente est archivée dans la même transaction ; jamais deux versions publiées. | Verrou du module, index unique partiel, trigger du pointeur |
| RM-023 | Nouvelle version | Modifier un module publié crée une version de travail (copie) ; la version publiée reste visible et inchangée jusqu'à la publication de la suivante. Une seule version de travail par module. | Index unique partiel |
| RM-024 | Concurrence | Toute modification repose sur la révision lue ; une révision périmée est refusée, jamais écrasée. | `revision` (version, leçon) |
| RM-025 | Consultation libre | Tout utilisateur connecté lit tous les modules publiés, quelle que soit son étape ; l'étape n'est qu'une recommandation. Aucun brouillon n'est exposé. | `module.read` ; catalogue limité à la version publiée |
| RM-026 | Contenu sûr | Contenu structuré par liste blanche ; aucun HTML exécutable ; liens http(s)/mailto, images https ; ressources par URL externe, vidéos sur hébergeurs autorisés. | `lessonDocumentSchema`, `createResourceInputSchema`, CHECK SQL |
| RM-027 | Traçabilité | Création, soumission, reprise et décisions historisées (ajout seul) ; décisions et collaborations journalisées. | `module_version_events`, `audit_logs` |
| RM-028 | Textes fondamentaux | Prière, charte… sont des modules « Texte fondamental » soumis au même workflow ; les autres modules les citent sans copie ; un texte cité n'est visible des routiers qu'une fois publié ; la Charte n'est jamais inventée. | `module_text_links` (trigger brouillon, pas d'auto-citation) |
| RM-030 | Suppression d'un brouillon vide | Seul un module jamais soumis ni publié, sans texte, ressource, collaborateur ni usage peut être supprimé, par le responsable, avec motif ; tout autre module s'archive. Le journal d'audit conserve l'import et la suppression. | `purge_empty_module_draft` (seul point d'entrée), audit `module.purged` |
| RM-029 | Duplication | Dupliquer crée un nouveau brouillon sans modifier l'original ; le caractère obligatoire n'est jamais repris. | `POST /editor/modules/:id/duplicate`, audit `module.duplicated` |

### Règles de la phase 3 (évaluations)

> Statut : **implémentées de bout en bout** (API, écrans, tests d'intégration, recette navigateur). Détails : [FEATURES/EVALUATIONS.md](FEATURES/EVALUATIONS.md), [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md). RM-005 (impression) et RM-006 à RM-011 sont désormais exposées par des routes et des écrans.

| N° | Règle | Énoncé | Garantie |
| --- | --- | --- | --- |
| RM-EVAL-001 | Consultation libre | Tout routier connecté consulte les modules publiés et la liste des évaluations publiées ; consulter n'ouvre pas le droit de passer. | `evaluation.read` ; passation soumise à l'éligibilité |
| RM-EVAL-002 | Éligibilité contrôlée | Passer (en ligne) ou préparer (papier) exige : profil actif, évaluation publiée, étape courante = étape de l'évaluation **ou** déblocage actif, limite de tentatives non atteinte. Règle provisoire (D59) ; aucune correspondance programme annuel ↔ étapes codée. | `computeEligibility` dans la transaction de création |
| RM-EVAL-003 | Déblocage exceptionnel | Responsable seul ; routier, évaluation, motif, auteur, date, expiration facultative, révocation motivée ; journalisé. Lève la condition d'étape, pas la limite de tentatives. | `waiver.manage` ; `AuditLog` |
| RM-EVAL-004 | Validation humaine | Correction (chef) → examen du résultat (responsable : accepté ou nouvelle correction) → validation officielle d'un acquis (phase 4, acte distinct) → changement d'étape (acte distinct). Un score, même parfait, ne change rien d'autre. | Aucune écriture de `current_stage_id` dans le module ; tests |
| RM-EVAL-005 | Identité indépendante du compte | Toute tentative référence le profil ; un routier sans compte passe sur papier avec le même historique. | `scout_profile_id` obligatoire |
| RM-EVAL-006 | Questionnaire versionné | Un chef rédige et soumet ; seul le responsable approuve et publie ; seule une version brouillon est modifiable ; toute modification d'un questionnaire publié passe par une nouvelle version approuvée. Étape et module figés après la première publication. | Triggers `evaluation_versions_guard`, `evaluation_questions_draft_guard` |
| RM-EVAL-007 | Cohérence avec le module | Un questionnaire rattaché à un module n'est publié que si le module est publié ; la version du module en vigueur est enregistrée. | `MODULE_NOT_PUBLISHED` ; `module_version_id` |
| RM-EVAL-008 | Confidentialité du corrigé | Bonnes réponses, barèmes, critères ne sont transmis ni au routier (avant et après examen) ni imprimés sur sa feuille. | `publicQuestionSchema` ; données du questionnaire PDF expurgées |
| RM-EVAL-009 | Correction déterministe | Choix unique, vrai/faux : tout ou rien ; choix multiples : tout ou rien ou crédit partiel (configurable par question) ; réponses libres : note, appréciation et observation humaines. Aucune IA, aucun seuil de réussite. | `gradeObjectiveAnswer` (partagé) |
| RM-EVAL-010 | Remise unique | Une copie en ligne remise n'est plus modifiable ; double remise refusée ; démarrage idempotent. | Verrou de ligne + statut ; trigger `attempt_answers_guard` |
| RM-EVAL-011 | Correction traçable | Chaque enregistrement de correction est historisé (instantané) ; révision optimiste contre les corrections concurrentes ; reprise d'une copie soumise motivée. | `correctionRevision` ; `evaluation_attempt_events` |
| RM-EVAL-012 | Pas de compétition | Aucun classement entre routiers ; listes chronologiques. | Interfaces |

### Cycle de vie d'une tentative
En ligne : `EN_COURS → A_CORRIGER` (remise, correction objective). Papier : `PREPAREE → A_CORRIGER` (première saisie). Puis `A_CORRIGER → SOUMISE` (chef, toutes les réponses libres notées) → `VALIDEE` (« résultat accepté » = examinée) ou retour `A_CORRIGER` (nouvelle correction demandée, motif). `REFUSEE` (« résultat non retenu ») reste disponible dans le modèle, sans écran. `ANNULEE` possible avant examen. Réouverture `VALIDEE | REFUSEE → A_CORRIGER` par le responsable (motif). Aucune transition ne déclenche de changement d'étape.

## Référentiel de progression (SAPF-Route)

| Étape | Libellé du programme | Signe de fin d'étape |
| --- | --- | --- |
| Noviciat | Novices Routiers | Flot gris |
| Apprentissage | Aspirants Routiers | Flot marron |
| Compagnonnage | Compagnons Routiers | Flot routier |
| Départ routier | Routiers Confirmés | Étoile or |

Ces étapes sont chargées par le seed (`progression_stages`) depuis `@tesla/shared`.

## Points en attente d'arbitrage (ne pas coder de valeur définitive)
- **Durées d'étape** : le document SAPF donne des durées narratives (1, 6, 10 mois, une année) et un tableau synoptique qui les module selon l'âge (18/19/20 ans). Lequel fait foi ?
- Conditions d'accès précises aux évaluations par étape et seuils de réussite (aucun seuil appliqué : score affiché seul).
- **Crédit partiel** des choix multiples : formule provisoire (bonnes − mauvaises) ÷ bonnes, bornée à 0 (D60).
- **Résultat communiqué au routier** : score et appréciations après acceptation, sans les bonnes réponses (D61).
- **Correction** : tous les chefs peuvent corriger toutes les copies (D65) ; faut-il restreindre par équipe ?
- Rôle des chefs dans la consultation des résultats individuels.
- Qui gère les comptes (responsable ou administrateur technique distinct).
- Durée de conservation des données et des résultats.
- **Éligibilité aux évaluations** : la règle provisoire « évaluation de l'étape courante uniquement » est-elle la bonne (et les étapes antérieures, les reprises) ?
- **Version appliquée** : toute version publiée peut-elle être imprimée, ou seulement la plus récente ?
- **Dérogation** : valable pour une seule tentative ou jusqu'à expiration/révocation (choix provisoire : jusqu'à expiration/révocation) ?
- **Inscription des routiers et gestion des équipes** : chefs et/ou responsable (choix provisoires dans la matrice ci-dessus).
- **Accès des chefs aux résultats individuels** : nécessaire pour la saisie papier ; périmètre exact à confirmer.
- **Observations** : liste de catégories souhaitée (aujourd'hui libellé libre) ; tous les chefs sont-ils habilités pour tous les routiers, ou seulement ceux de certaines équipes ?
- **Répartition chefs / responsable** pour l'inscription et l'affectation (aujourd'hui : responsable seul, D32).
- **Modules** (choix provisoires, D46, D50, D51, D55) : le responsable peut-il approuver un module dont il est l'auteur ? Un collaborateur peut-il inviter d'autres chefs ? Liste officielle de thèmes ? Hébergeurs de vidéos autorisés ? Retrait d'une approbation non publiée (`APPROUVE → A_CORRIGER`) ?

## Phase 4 — progression et suivi

Les décisions officielles restent exclusivement humaines. Les étapes et validations sont historisées ; aucun score, module étudié ou présence ne provoque de promotion. Les catégories du programme ont une correspondance configurable, non confirmée par défaut. Détails : [progression](FEATURES/PROGRESSION.md), [compétences](FEATURES/COMPETENCES.md), [programme annuel](FEATURES/PROGRAMME_ANNUEL.md), [activités](FEATURES/SUIVI_ACTIVITES.md), [tableaux de bord](FEATURES/DASHBOARDS.md).

## Phase 5 — hors ligne

- Tout routier connecté peut télécharger **tout module publié**, quelle que soit son étape ; une lecture locale n'est jamais un acquis.
- Une évaluation n'est disponible hors ligne qu'après **préparation en ligne** : le serveur vérifie identité, profil, publication, éligibilité (étape ou dérogation active), limite de tentatives et absence d'autre tentative ouverte, puis réserve une tentative `HORS_LIGNE` pour **24 heures** (D78, provisoire).
- Les droits sont revérifiés à la réception. La copie doit **parvenir au serveur** avant l'expiration ; l'heure de l'appareil est enregistrée mais ne décide de rien. Expiration, dérogation révoquée, éligibilité perdue → rejet motivé, tentative `ANNULEE` non comptée dans la limite ; la copie locale est conservée.
- Correction objective uniquement côté serveur ; réponses libres notées par un humain ; aucun score navigateur accepté ; aucune validation d'acquis ni changement d'étape à la synchronisation.
- **À arbitrer** : durée de réservation (24 h), rejet ou mise en attente en cas de révocation, conservation serveur d'une copie rejetée pour examen par un chef, ouverture du mode hors ligne aux chefs et au responsable.

Détails : [OFFLINE_FIRST.md](OFFLINE_FIRST.md).

## Modules importés d'une source documentaire

- Un module importé par le seed est créé **en brouillon par le système** : aucun chef ni responsable n'en est déclaré auteur, aucune approbation ni publication n'est simulée. Il ne devient visible des routiers qu'après soumission, approbation et publication par des personnes.
- Le responsable le consulte et le modifie comme tout module ; un chef n'y accède qu'après invitation comme collaborateur.
- Les textes sont repris tels quels de la source ; les erreurs présumées sont signalées en notes éditoriales, jamais corrigées silencieusement. Une leçon sans contenu source reste vide et bloque la soumission.
- L'étape associée est une recommandation de lecture, jamais une condition de progression ou d'éligibilité. Aucun questionnaire n'est créé sans questions dans la source.
- Une réexécution n'écrase jamais un module importé : elle signale les écarts.

Détails : [SEEDS_PEDAGOGIQUES.md](SEEDS_PEDAGOGIQUES.md).

## Refonte 2026-10-29 — âge, rattrapages, encadrement
- **Étape théorique** : déterminée par l'âge (date de naissance) et le référentiel d'âge en vigueur, jamais par la date d'entrée ; distincte de l'étape officielle, de la progression pédagogique et du rattrapage. Voir [FEATURES/PROGRESSION_PAR_AGE.md](FEATURES/PROGRESSION_PAR_AGE.md).
- **Noviciat** : du 18e anniversaire à un mois calendaire plus tard (règle fournie, à rapprocher du manuel). L'échéance ne valide rien.
- **Sortie** : le jour du 21e anniversaire, le routier n'est plus membre actif ; historique intégralement conservé ; aucune étape attribuée.
- **Rattrapage** : modules obligatoires (source officielle exigée) d'étapes dont la période est échue ; acquis seulement par décision humaine. Voir [FEATURES/RATTRAPAGE.md](FEATURES/RATTRAPAGE.md).
- **Encadrement** (D132, remplace les mandats) : responsable plein, adjoint, assistants désignés directement par l'administrateur, sans lien avec l'année scoute ; un seul plein en fonction ; remplacement confirmé, immédiat et historisé ; décisions officielles réservées au plein en fonction ; l'adjoint et les assistants accompagnent (droits de l'encadrement). Voir [FEATURES/ENCADREMENT.md](FEATURES/ENCADREMENT.md).
- **Application unique** (D134) : aucun espace, aucun choix d'espace, aucun rôle technique affiché ; ce que voit chacun découle de ses permissions. Voir [FEATURES/NAVIGATION_ET_PERMISSIONS.md](FEATURES/NAVIGATION_ET_PERMISSIONS.md).
- Règles non confirmées et sources manquantes : [REFERENTIEL_PEDAGOGIQUE.md](REFERENTIEL_PEDAGOGIQUE.md) et décisions D93–D107.

## Offline-first (2026-10-30)

Référence : [OFFLINE_FIRST.md](OFFLINE_FIRST.md), décisions D109–D117.

- Tout ce qui est fait sans réseau est **provisoire** : affiché comme « Enregistré sur cet appareil », jamais comme une décision. L'effet officiel naît de la réception par le serveur, qui revérifie session, permissions du jour et règles métier.
- **Jamais différables** : changement d'étape, validation ou refus d'acquis, décisions de rattrapage, publications et approbations, désignations et fins de fonction d'encadrement, déblocages, corrections et examens de résultats.
- **Différables** (avec version de référence) : présences, création et compte rendu d'activité, observation, création et modification de fiche, changement d'équipe. Une donnée modifiée entre-temps sur le serveur produit un **conflit** à résoudre, jamais un écrasement.
- Aucun matricule, identifiant officiel ou code de tentative n'est créé localement : une création porte un identifiant provisoire remplacé par celui du serveur.
- Une identité locale n'accorde aucun droit : usage sans réseau seulement, 14 jours au plus après la dernière vérification (**A_VALIDER**) ; au retour du réseau, chaque opération est revérifiée par le serveur et celle que la personne n'est plus habilitée à faire est rejetée et conservée (D133).
- Les saisies non synchronisées ne sont jamais supprimées automatiquement ; seul un abandon confirmé les retire.
- Évaluations : préparation en ligne obligatoire, réservation de 24 h inchangée (**A_VALIDER**, D78).
