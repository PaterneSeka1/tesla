# Règles métier

> Statut : règles **documentées** ; celles des routiers, équipes, observations, de l'authentification et des modules pédagogiques sont **implémentées** (voir [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)). Source : cahier de la mission, document SAPF-Route (Atelier pédagogique Branche Route), programme annuel 2026–2027 de la Communauté Nikola Tesla.

## Périmètre
- Une communauté (Nikola Tesla), une branche (Route), année scoute 2026–2027.
- Environ 25 routiers, 4 chefs, 1 responsable pédagogique principal.

## Rôles et permissions

| Action | Routier | Chef | Responsable |
| --- | :---: | :---: | :---: |
| Consulter les modules publiés | ✅ | ✅ | ✅ |
| Télécharger un module pour lecture hors ligne | ✅ | ✅ | ✅ |
| Créer un module ; modifier un brouillon dont on est auteur ou collaborateur | — | ✅ | ✅ (tous les modules) |
| Inviter / retirer un chef collaborateur | — | auteur du module | ✅ |
| Soumettre un module à l'approbation | — | auteur, collaborateur | ✅ |
| Approuver, demander des corrections, refuser, publier, archiver un module | — | — | ✅ |
| Consulter la file de validation et l'historique des publications | — | — | ✅ |
| Passer une évaluation accessible | ✅ | — | — |
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
| Rechercher une tentative par code | sa propre tentative | ✅ | ✅ |
| Décider d'un résultat soumis (`VALIDEE` / `REFUSEE`), rouvrir une décision | — | — | ✅ |
| Accorder / révoquer un déblocage individuel | — | — | ✅ |
| Valider officiellement un acquis | — | — | ✅ |
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

> Statut : RM-001 à RM-004 et RM-012 (profils, équipes) **implémentés de bout en bout** (routes, écrans, tests) ; RM-005 à RM-011 (tentatives) : services testés, **sans route ni écran** (voir [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)).

| ID | Règle | Énoncé | Garantie |
| --- | --- | --- | --- |
| RM-001 | Routier sans compte | Le profil routier est la référence métier. Il existe sans compte ; un compte (facultatif, unique) peut y être rattaché plus tard, sans perte de données ni second profil. Toute évaluation, dérogation ou validation référence le profil. | `scout_profiles.user_id` nullable + unique ; rattachement conditionnel `user_id IS NULL` |
| RM-002 | Matricule facultatif et unique | Chaîne de caractères au format officiel **7 chiffres suivis d'une lettre** (ex. `0000001A`, zéros initiaux conservés), facultative, unique si renseignée, normalisée (espaces supprimés, majuscules), jamais générée. Ce n'est ni un identifiant technique ni un code de tentative. | Index unique + CHECK de forme normalisée |
| RM-003 | Affectation à une équipe | Un routier appartient à au plus une équipe à un instant donné ; il peut être temporairement sans équipe. Pas de multi-paroisse ni multi-district. | Index unique partiel (affectation ouverte) |
| RM-004 | Historisation des équipes | Un changement d'équipe clôt l'affectation précédente (date de fin, auteur) et en ouvre une nouvelle. Les évaluations restent liées au profil ; l'équipe à une date passée se déduit de l'historique. | Contrainte d'exclusion (périodes sans chevauchement) |
| RM-005 | Impression des modules | Trois documents : support de cours, questionnaire nominatif, corrigé chef. Le corrigé n'est accessible qu'aux chefs et au responsable. Génération sans service d'IA. | **Documenté** (générateur PDF non développé) |
| RM-006 | Questionnaire papier nominatif | Un chef ou le responsable prépare une tentative papier (routier, évaluation, version publiée) → statut `PREPAREE`. La feuille affiche communauté, évaluation, code, identité, matricule, équipe à la date de préparation, date prévue, questions et espaces de réponse ; jamais le corrigé. Réimprimer ne crée pas de tentative ; repasser l'évaluation exige une nouvelle préparation explicite. | Service `preparePaper` / `getPaperSheet` (lecture seule) |
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

### Cycle de vie d'une tentative
`PREPAREE → (EN_COURS) → A_CORRIGER → SOUMISE → VALIDEE | REFUSEE` ; `ANNULEE` possible avant décision. Corrections : `SOUMISE → A_CORRIGER` (motif) ; `VALIDEE | REFUSEE → A_CORRIGER` (réouverture par le responsable, motif). Aucune transition ne déclenche de changement d'étape.

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
- Conditions d'accès précises aux évaluations par étape et seuils de réussite.
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
