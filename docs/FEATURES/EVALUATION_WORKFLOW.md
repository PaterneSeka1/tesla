# Workflow des évaluations

Deux cycles distincts : celui du **questionnaire** (rédaction → publication) et celui de la **tentative** (passation → correction → examen). Aucun des deux ne modifie l'étape d'un routier.

## 1. Questionnaire (mêmes états que les modules)

```
BROUILLON ──soumettre (chef)──► SOUMIS ──approuver──► APPROUVE ──publier──► PUBLIE ──archiver (motif)──► ARCHIVE
    ▲                             │  └─refuser (motif)─► REFUSE        │                 │
    └──reprendre── A_CORRIGER ◄───┴──demander des modifications (motif)┘                 └─ remplacée par une nouvelle publication ─► ARCHIVE
```

| Règle | Garantie |
| --- | --- |
| Seule une version `BROUILLON` est modifiable (informations, questions, propositions) | Service + triggers `evaluation_versions_guard`, `evaluation_questions_draft_guard`, `evaluation_answer_options_draft_guard` |
| Soumission : au moins une question, révision à jour | `422 EVALUATION_EMPTY`, `409 EDIT_CONFLICT` |
| Approuver, demander des modifications, refuser, publier, archiver : responsable seul ; historique + `AuditLog` | `evaluation.review` ; `evaluation_version_events` en ajout seul |
| Une version de travail et une version publiée au plus | Index uniques partiels |
| Publication atomique : la version publiée précédente est archivée dans la même transaction | Verrou de l'évaluation ; trigger du pointeur |
| Module évalué publié avant l'évaluation ; version du module enregistrée | `409 MODULE_NOT_PUBLISHED` ; `module_version_id` |
| Modifier un questionnaire publié = nouvelle version (copie) soumise à approbation | `POST /editor/evaluations/:id/versions` |
| Étape et module figés après la première publication | `409 EVALUATION_SETTINGS_LOCKED` (D58) |

La file des questionnaires (`/administration/evaluations`) est distincte de celle des modules et de celle des résultats.

## 2. Tentative

```
En ligne : (démarrage) EN_COURS ──remise du routier──► A_CORRIGER
Papier   : (préparation) PREPAREE ──première saisie du chef──► A_CORRIGER
                                    A_CORRIGER ──soumettre (chef, réponses libres notées)──► SOUMISE
                                    SOUMISE ──accepter (responsable)──► VALIDEE (« résultat accepté »)
                                    SOUMISE ──nouvelle correction (responsable, motif)──► A_CORRIGER
                                    SOUMISE ──reprise par un chef (motif)──► A_CORRIGER
                       PREPAREE | EN_COURS | A_CORRIGER | SOUMISE ──annuler (motif)──► ANNULEE
                                    VALIDEE | REFUSEE ──rouvrir (responsable, motif)──► A_CORRIGER
```

| Niveau | Acteur | Effet |
| --- | --- | --- |
| 1. Correction du questionnaire | Moteur déterministe + chef (réponses libres) | Points par question, score |
| 2. Examen du résultat | Responsable | `VALIDEE` (accepté) ou nouvelle correction |
| 3. Validation officielle d'un acquis | Responsable (phase 4, non développé) | Acte distinct, jamais déduit d'un score |
| 4. Changement d'étape | Responsable (`PATCH /scouts/:id`) | Acte distinct, journalisé |

Protections : une tentative ouverte au plus par routier et par évaluation (index partiel) ; démarrage en ligne idempotent ; remise et corrections sérialisées par verrou de ligne ; révision optimiste `correctionRevision` (`409 ATTEMPT_STATE_CHANGED`) ; chaque saisie historisée avec un instantané ; réponses non modifiables hors `PREPAREE`/`EN_COURS`/`A_CORRIGER` (trigger `attempt_answers_guard`) ; tentative jamais supprimée, code jamais réutilisé ; version exacte immuable (trigger `evaluation_attempts_guard`).

## Écrans
| Rôle | Écrans |
| --- | --- |
| Chef | `/chef/evaluations`, `nouvelle`, `[id]/modifier`, `[id]/apercu`, `papier`, `papier/[code]`, `/chef/corrections`, `/chef/corrections/[code]` |
| Routier | `/evaluations`, `/evaluations/[id]`, `/evaluations/[id]/passer`, `/mes-resultats` |
| Responsable | `/administration/evaluations`, `/administration/evaluations/[id]`, `/administration/evaluations-a-valider` (+ `[id]`), `/administration/deblocages` ; accès aussi à la rédaction et aux corrections |
