# Évaluations — questionnaires, passation et résultats

Phase 3 (2026-10-29). Routes : [API.md](../API.md#évaluations-phase-3). Workflow d'approbation et cycle des tentatives : [EVALUATION_WORKFLOW.md](EVALUATION_WORKFLOW.md). Circuit papier : [PAPER_EVALUATIONS.md](PAPER_EVALUATIONS.md). Règles : RM-EVAL-001 à 012 dans [BUSINESS_RULES.md](../BUSINESS_RULES.md).

Les évaluations complètent les modules et les activités de terrain : elles ne classent pas les routiers et ne valident jamais seules une étape.

## Ce qui fonctionne réellement

| Fonction | Où | Vérification |
| --- | --- | --- |
| Questionnaire versionné : titre, consignes, étape, module évalué (facultatif), durée indicative, tentatives maximum | `/chef/evaluations/nouvelle`, `/chef/evaluations/[id]/modifier` | Intégration HTTP ; recette navigateur |
| Cinq types de questions : choix unique, choix multiples, vrai/faux, réponse courte, réponse développée ; barème par question (au centième) ; critères de correction et réponse attendue | `QuestionForm` (règles partagées `questionFormSchema`) | Tests unitaires (formes) ; recette |
| Ajout, modification, suppression, réordonnancement des questions (brouillon uniquement, révision optimiste) | Éditeur | Intégration ; triggers |
| Aperçu tel que vu par le routier, ou avec corrigé | `/chef/evaluations/[id]/apercu` | Recette (écran) |
| Soumission, approbation, demande de modifications, refus, publication atomique, archivage, nouvelle version | Éditeur, `/administration/evaluations`, `/administration/evaluations/[id]` | Intégration ; recette |
| Liste des évaluations publiées avec éligibilité du routier ; présentation (consignes, nombre de questions, tentatives) | `/evaluations`, `/evaluations/[id]` | Intégration ; recette (mobile 390 px) |
| Passation en ligne : une question par écran, progression, navigation directe, sauvegarde à chaque changement de question, confirmation avant remise, protection contre la double remise | `/evaluations/[id]/passer` | Intégration (remises concurrentes : 200 + 409) ; recette mobile |
| Correction objective déterministe (`gradeObjectiveAnswer`, partagé) ; réponses libres notées par un chef (note, appréciation, observation) | `/chef/corrections`, `/chef/corrections/[code]` | Tests unitaires ; intégration ; recette |
| Examen par le responsable : accepter (commentaire facultatif) ou demander une nouvelle correction (motif) | `/administration/evaluations-a-valider` | Intégration ; recette |
| Historique du routier (en ligne et papier), résultat détaillé après acceptation, sans corrigé | `/mes-resultats` | Intégration ; recette |
| Déblocages individuels (accorder, révoquer, expiration, nombre de tentatives liées) | `/administration/deblocages` | Intégration (dérogation active / révoquée) |
| Tableau de bord du responsable : compteurs réels (modules, questionnaires, résultats à examiner) | `/responsable` | Build ; écran non recetté spécifiquement |

## Confidentialité du corrigé
- Le routier reçoit `publicQuestionSchema` : identifiants, énoncé, libellés des propositions. Jamais `isCorrect`, `points`, `guidance`, `expectedAnswer` (vérifié par tests).
- Même après acceptation, le routier voit ses points par question et les appréciations, pas les bonnes réponses (D61, provisoire).
- Corrigé et copies (`/corrections/*`, PDF corrigé et grille) : chefs et responsable ; routier `403`.

## Moteur de correction
| Type | Règle |
| --- | --- |
| Choix unique, vrai/faux | Tous les points si la seule proposition choisie est la bonne ; sinon 0 |
| Choix multiples — tout ou rien | Tous les points si l'ensemble choisi est exactement l'ensemble correct |
| Choix multiples — crédit partiel | (bonnes cochées − mauvaises cochées) ÷ nombre de bonnes, borné à 0, × barème (D60, à confirmer) |
| Réponse courte, développée | Note saisie par un chef (≤ barème), jamais automatique ; aucune IA |

Aucun seuil de réussite n'est appliqué (D66) : le score est affiché tel quel.

## Partiel ou non vérifié
- Lecteurs d'écran : libellés, `aria-*` et navigation clavier en place, non audités avec un lecteur d'écran.
- Navigateurs réels (Safari iOS, Android) : non testés (Chromium headless seulement).
- `REFUSEE` (« résultat non retenu ») existe dans le modèle et la réouverture d'un résultat examiné est exposée par l'API, sans bouton dédié dans les écrans.
- Passation hors ligne (`HORS_LIGNE`, phase 5) : préparation en ligne obligatoire, réservation de 24 h, réception idempotente et correction serveur. Voir [OFFLINE_FIRST.md](../OFFLINE_FIRST.md).
- Pas de sauvegarde automatique périodique pendant la saisie d'un texte : l'enregistrement se fait au changement de question ou par le bouton « Enregistrer ».

## Prévu
- Validation officielle des acquis (phase 4) : modèle distinct, acte du responsable, jamais déduit d'un score.
- Arbitrages en attente : éligibilité (étapes antérieures, reprises), crédit partiel, communication des résultats, périmètre de correction des chefs.
