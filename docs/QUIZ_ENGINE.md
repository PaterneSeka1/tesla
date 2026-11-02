# Moteur de quiz

Un seul moteur pour les questions, tentatives, corrections et résultats (`packages/shared/src/grading.ts`, `apps/api/src/modules/evaluations/`). Workflow de rédaction et d'approbation : [FEATURES/EVALUATION_WORKFLOW.md](FEATURES/EVALUATION_WORKFLOW.md).

## Types de questions
| Type | Correction |
| --- | --- |
| Choix unique, vrai/faux | automatique (`gradeObjectiveAnswer`) |
| Choix multiples | automatique, tout ou rien ou crédit partiel (D60, provisoire) |
| Réponse courte | automatique si la réponse correspond à une **variante acceptée** déclarée par l'auteur, sinon humaine (D138) |
| Réponse développée | humaine |
| Association, classement | **non développés** (voir plus bas) |

### Réponse courte (D138)
- Normalisation : Unicode NFC, espaces de début et de fin retirés, espaces intérieurs réduits, minuscules. Accents et ponctuation conservés.
- Égalité avec une variante → tous les points, `autoScored = true`. Aucune correspondance, réponse vide ou aucune variante → `null` : un chef note. Jamais zéro automatique.
- Une note saisie par un correcteur n'est jamais remplacée ; une note vide envoyée par l'écran de correction n'efface pas une note automatique.
- Variantes = corrigé : visibles de l'encadrement, imprimées sur le corrigé papier, jamais transmises au routier (vues routier construites champ par champ).

## Modes de passation
| Mode | Description |
| --- | --- |
| Classique (`/evaluations/:id/passer`) | une question par écran, navigation libre |
| Jeu à paliers (`/evaluations/:id/jeu`) | même tentative, mêmes questions dans l'ordre de l'auteur, échelle de questions, palier toutes les 3 questions, 2 jokers « passer pour plus tard », écran final (D140) |
| Hors ligne, papier | inchangés ([OFFLINE_FIRST.md](OFFLINE_FIRST.md), [FEATURES/PAPER_EVALUATIONS.md](FEATURES/PAPER_EVALUATIONS.md)) |

Le mode jeu ne connaît pas le corrigé : aucun retour immédiat bonne/mauvaise réponse, aucun « 50/50 », aucun score à la fin ; le score suit la règle de communication (D61 : après examen du responsable, sans les bonnes réponses). Rendre le corrigé consultable après remise reste une décision **à valider**.

## Résultats pour l'encadrement (D139)
`GET /editor/evaluations/:id/results`, page « Résultats » depuis la liste des questionnaires : routiers concernés (actifs, étape du questionnaire), participants, non-participants, copies remises, passations en cours, moyenne des copies entièrement notées, copies par ordre alphabétique (lien vers la correction), répartition des propositions, taux de réussite complète, questions souvent manquées (< 50 %), réponses rédigées. Lecture seule, jamais conservé hors ligne.

## Garanties
- Corrigés et barèmes jamais transmis au routier ni imprimés sur sa feuille.
- Aucune IA ; correction déterministe et reproductible.
- Un score ne change jamais une étape ni un acquis (règle pédagogique 5).

## Non développé
- **Association et classement** : exigent un stockage d'appariement ou d'ordre, un affichage mélangé côté serveur et des identifiants de propositions non ordonnés (les UUID v7 révèlent l'ordre de création, donc l'ordre correct d'un classement). Conception à mener avant développement.
- Niveau de difficulté explicite par question (l'ordre de l'auteur en tient lieu dans le mode jeu).
- Consultation des bonnes réponses après remise (politique à valider).
