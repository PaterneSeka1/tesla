# Évaluations papier

Pour un routier avec ou sans compte : mêmes règles d'éligibilité, même historique, même moteur de correction qu'en ligne. Règles RM-005 à RM-012 et RM-EVAL-005 ([BUSINESS_RULES.md](../BUSINESS_RULES.md)).

## Séparation saisie / correction (D161, 2026-11-02)

| Action | Encadrement (plein, adjoint, assistants) | Responsable plein seulement |
| --- | --- | --- |
| Préparer, distribuer, imprimer, réimprimer, télécharger PDF collectif ou ZIP | ✓ | ✓ |
| Saisir les réponses (provisoire, reprise), transmettre pour correction | ✓ (copie non transmise) | ✓ |
| Consulter copies, réponses saisies, statut | ✓ (sans corrigé ni note non publiée) | ✓ |
| Corrigé, barème, bonnes réponses, corrigé et grille PDF, résultats agrégés | — | ✓ |
| Noter, apprécier, valider le score, publier, reprendre (motif), rouvrir | — | ✓ |

Appliqué par l'API (`attempt.answerKey`, `attempt.grade`, `attempt.submit`, `attempt.decide`) ; l'administrateur n'en hérite pas. Parcours : **Bibliothèque → Préparer une distribution** (`/encadrement/distribution/[module]`) ; **Fiche routier → Saisir les réponses** ; **Copies** (`/encadrement/corrections`, titrée « Copies à corriger » pour le plein).

## Distribution collective (D163)
- Documents : cours seul (un PDF commun), évaluation seule, ou les deux.
- Destinataires : éligibles, avec ou sans compte, équipe, étape, sélection manuelle ; nombre réel affiché ; éligibilité calculée par le serveur (`GET /evaluations/:id/distribution`).
- `POST /paper-batches` (60 routiers au plus) : chaque routier est traité dans sa transaction ; copie « Préparée » réutilisée, tentative ouverte jamais doublée, inéligible ignoré avec sa raison ; un double envoi ou une reprise ne crée aucun doublon.
- `GET /paper-batches/documents?codes=…&format=pdf|zip` : PDF collectif (une copie par routier, pagination propre) ou ZIP (un PDF par routier, noms ASCII). Jamais de corrigé.
- Bascule au papier (D164) : `POST /corrections/:code/switch-to-paper` sur une tentative en ligne non remise ; refusée pendant une réservation hors ligne non synchronisée.

## Parcours historique (recette navigateur 2026-10-29, avant D161)

1. `/chef/evaluations/papier` : le chef recherche le routier (nom, prénoms, matricule ; badge « Sans compte »).
2. Il choisit une évaluation publiée : l'éligibilité est calculée par le serveur pour ce routier (étape, déblocage, limite, tentative ouverte) ; les choix inéligibles sont désactivés.
3. « Créer la tentative papier » (`POST /paper-attempts`) : contrôles répétés dans la transaction, version publiée courante, code `NT-AAAA-NNNNNN` attribué par `issueAttemptCode` (compteur annuel verrouillé, jamais `count()` ni aléatoire), statut `PREPAREE`.
4. `/chef/evaluations/papier/[code]` : téléchargement des trois documents A4 ; réimprimer ne crée jamais de tentative.
5. Le routier répond sur la feuille.
6. Le chef retrouve la copie par son code (même écran, ou `/chef/corrections`), transcrit les réponses, saisit la date de passation, note les réponses libres, ajoute appréciations et observations, enregistre (brouillon) puis soumet.
7. Le responsable examine (`/administration/evaluations-a-valider`) ; le résultat apparaît dans l'historique du routier (fiche routier ; « Mes résultats » s'il obtient un compte plus tard, rattaché au même profil).

## Documents PDF (pdfkit, générés à la demande, non stockés)

| Document | Contenu | Accès |
| --- | --- | --- |
| Questionnaire du routier | Logo et communauté, code encadré, titre du module et de l'évaluation, version, date de préparation, nom et prénoms, matricule, équipe à la date de préparation, date prévue, consignes, questions avec cases à cocher ou lignes de réponse ; pied de page paginé | Chefs, responsable ; tentative `PREPAREE` uniquement. Construit à partir de données **expurgées** (aucun barème, bonne réponse, critère ni réponse attendue) |
| Corrigé | Questions, bonnes réponses cochées, barèmes, politique de notation, réponses attendues, critères, version | Responsable plein (autres : `403`, D161) |
| Grille de correction | Identité, tableau des questions (type, barème, points obtenus, appréciation), total, appréciation générale, observations, correcteur, date, signature, rappel « une note n'est pas une validation » | Responsable plein (D161) |

Vérifié : contenu textuel des PDF contrôlé en test d'intégration (le questionnaire ne contient ni « bonne réponse », ni critère, ni réponse attendue ; le corrigé les contient) ; rendu visuel des trois documents contrôlé (A4, une page pour un questionnaire court).

## Protections
- Doublons : une tentative ouverte par routier et par évaluation (index unique partiel) ; nouvelle préparation refusée (`409 ATTEMPT_ALREADY_OPEN`).
- Substitution d'identité : la copie est liée au profil à la création ; `scout_profile_id`, version, code et mode sont immuables (trigger).
- Erreurs de version : réponses validées contre la version exacte de la tentative (service et trigger) ; si une nouvelle version a été publiée, l'écran le signale et la correction suit la version de la copie.
- Corrections concurrentes : révision `correctionRevision` ; reprise d'une copie soumise motivée et historisée.
- Le code n'est pas un secret : toute lecture exige une session et la permission adéquate.

## Partiel ou non vérifié
- Caractères hors Windows-1252 (ex. émojis, certains symboles) remplacés par « ? » dans les PDF (polices standard).
- Questionnaires longs : pagination automatique vérifiée par construction (sauts de page), non recettée sur un questionnaire de plusieurs pages.

## Prévu
- Téléversement de la copie numérisée (`evidence_file_key` existe, stockage non développé).
- Support de cours en PDF serveur (aujourd'hui : impression navigateur).
