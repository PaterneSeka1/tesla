# Workflow d'approbation et de publication des modules

Phase 2 (2026-10-29). Comportement **réellement implémenté** ; garanti par le service (`ModuleEditorService`, `ModuleReviewService`) **et** par des triggers PostgreSQL.

## États d'une version

```
            soumettre (chef)           approuver (resp.)          publier (resp.)
BROUILLON ───────────────────► SOUMIS ───────────────► APPROUVE ───────────────► PUBLIE ──► ARCHIVE
    ▲                            │  │                     │                                   ▲
    │ reprendre (chef)           │  │ refuser (resp.)     │ demander des corrections          │ remplacée par une
    │                            │  ▼                     │ (resp., motif)                    │ nouvelle publication,
A_CORRIGER ◄─────────────────────┘ REFUSE                 ▼                                   │ ou archivage (resp., motif)
             demander des corrections            A_CORRIGER
             (resp., motif)
```

| Transition | Qui | Motif | Effet |
| --- | --- | --- | --- |
| `BROUILLON → SOUMIS` | auteur, collaborateur, responsable | note facultative | Version figée ; exige ≥ 1 leçon et aucune leçon vide (`422 MODULE_INCOMPLETE`) ; révision attendue |
| `SOUMIS → APPROUVE` | responsable | commentaire facultatif | Version figée jusqu'à sa publication |
| `SOUMIS → A_CORRIGER` | responsable | **obligatoire** | Retour à l'équipe de rédaction |
| `APPROUVE → A_CORRIGER` | responsable | **obligatoire** | Retrait d'une approbation non encore publiée (D46) |
| `SOUMIS → REFUSE` | responsable | **obligatoire** | Version close ; une nouvelle version peut être créée |
| `A_CORRIGER → BROUILLON` | auteur, collaborateur, responsable | — | Reprise explicite de la rédaction |
| `APPROUVE → PUBLIE` | responsable | — | Publication atomique (ci-dessous) |
| `PUBLIE → ARCHIVE` | responsable | **obligatoire** (archivage) | Module retiré de la bibliothèque ; ou automatique lors du remplacement par une nouvelle version |

Toute autre transition est refusée : `409 INVALID_TRANSITION` par le service, exception SQL par le trigger `module_versions_guard`. Un chef qui appelle une route de décision reçoit `403 FORBIDDEN`. Publier une version non approuvée : `409 VERSION_NOT_APPROVED`.

## Publication atomique

Dans **une seule transaction**, module verrouillé (`FOR UPDATE`) :
1. vérification que la version visée est `APPROUVE` ;
2. si une version est déjà publiée : pointeur du module remis à `null`, ancienne version → `ARCHIVE` (`archivedAt`), événement `REMPLACEE` ;
3. nouvelle version → `PUBLIE` (`publishedAt`, `publishedById`) ;
4. pointeur `published_version_id` du module → nouvelle version ; événement `PUBLIEE` ; `AuditLog module.published` (avec la version remplacée).

Garanties en base : index unique partiel `module_versions_one_published_per_module` (au plus une version `PUBLIE` par module), `published_version_id` unique, trigger `pedagogical_modules_published_guard` (le pointeur désigne une version `PUBLIE` du même module).

## Modifier un module publié

1. « Nouvelle version » (`POST /editor/modules/:id/versions`) : copie de la version publiée (informations, leçons, ressources) en `BROUILLON`, numéro suivant, `basedOnVersion` renseigné.
2. La version publiée reste servie **inchangée** à la bibliothèque pendant toute la rédaction et la validation.
3. Soumission → décision → publication : la nouvelle version remplace l'ancienne, archivée et toujours consultable par les rédacteurs (aperçu `?version=`).

Une seule version de travail (`BROUILLON`, `SOUMIS`, `A_CORRIGER`, `APPROUVE`) par module : index unique partiel `module_versions_one_working_per_module` (`409 WORKING_VERSION_EXISTS`).

Aucune modification silencieuse : le trigger `module_versions_guard` refuse toute modification du contenu d'une version hors `BROUILLON`, et `module_draft_content_guard` toute écriture de leçon ou de ressource d'une version hors `BROUILLON` — même par un script SQL direct.

## Concurrence

| Cas | Mécanisme | Résultat |
| --- | --- | --- |
| Deux enregistrements des informations du module | `revision` de la version (lue par le client, vérifiée sous verrou `FOR UPDATE`) | Le second reçoit `409 EDIT_CONFLICT` ; l'écran recharge les données |
| Deux enregistrements d'une même leçon | `revision` de la leçon (`UPDATE … WHERE revision = attendue`) | Le second reçoit `409 EDIT_CONFLICT` ; l'éditeur propose de charger la version enregistrée sans écraser |
| Ajouts simultanés de leçons | Verrou exclusif de la version | Rangs distincts et contigus |
| Réordonnancement sur une liste périmée | Comparaison avec l'ensemble exact des leçons | `409 EDIT_CONFLICT` |
| Soumission pendant une édition de leçon | Verrou exclusif (soumission) contre verrou partagé (édition) | Sérialisées ; aucune écriture après le gel |
| Deux créations de nouvelle version | Index unique partiel | Une seule réussit |
| Deux publications | Verrou du module | Sérialisées ; jamais deux versions publiées |

L'auteur et la date de chaque modification de leçon (`updatedBy`, `updatedAt`) et des informations (`updatedById`) sont conservés.

## Traçabilité

- `module_version_events` (ajout seul, trigger) : `CREEE`, `SOUMISE`, `REPRISE`, `CORRECTIONS_DEMANDEES`, `REFUSEE`, `APPROUVEE`, `PUBLIEE`, `REMPLACEE`, `ARCHIVEE`, avec auteur, états, motif, date.
- `audit_logs` dans la même transaction : `module.created`, `module.submitted`, `module.approved`, `module.changes_requested`, `module.rejected`, `module.published`, `module.archived`, `module.collaborator_added`, `module.collaborator_removed`.
- Écrans : historique dans l'édition et la révision ; `/administration/historique-publications` (décisions du responsable, paginé).

## Écrans du responsable

| Écran | Contenu |
| --- | --- |
| `/administration/modules-a-valider` | File « À examiner » (`SOUMIS`, la plus ancienne d'abord) et « Approuvés, à publier » : auteur, collaborateurs, version, étape, leçons, date et note de soumission, remplacement d'une version en ligne |
| `/administration/modules/[id]/revision` | Contenu exact de la version (leçons, ressources), actions selon l'état (approuver, demander des corrections, refuser, publier, archiver la version en ligne), version en ligne pour comparaison, historique et versions antérieures |
| `/administration/modules` | Tous les modules (publiés ou en cours) |
| `/administration/historique-publications` | Décisions de publication |

Les deux files de validation du projet restent **distinctes** : cette file concerne les modules ; la file des évaluations à valider sera développée en phase 4.
