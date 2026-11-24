# Expérience immersive (D194–D200)

Cahier des charges : [../prompts/TESLA_IMMERSIVE_LEARNING.md](../prompts/TESLA_IMMERSIVE_LEARNING.md). Décisions : [../DECISIONS.md](../DECISIONS.md#expérience-immersive-2026-11-24). Suivi des lots : [../TESLA_IMMERSIVE_PROGRESS.md](../TESLA_IMMERSIVE_PROGRESS.md).

## Trois piliers, une application
Apprendre (lecteur), jouer (défis), vivre (activités de la communauté, existantes). Aucun espace ni navigation séparés : menu et barre découlent des permissions (D132).

## Contenu : bloc « Activité » (D194)
- Schéma : `packages/shared/src/practice.ts` (`practiceActivitySchema`, 7 types, `gradePractice`, `practicePrintLines`). Nœud de leçon `{ type: 'practice', attrs: { activity } }` (`lesson-content.ts`).
- Éditeur : menu « Bloc pédagogique » → « Activité d'entraînement » ; formulaire simple par type (`components/practice/practice-form.tsx`), aperçu dans le rendu apprenant sans enregistrement ; nœud Tiptap atomique modifiable (`practice-node.tsx`). L'activité n'est insérée qu'une fois valide.
- Rendu apprenant : repliée dans la lecture intégrale, en séquence propre en mode Découverte (démarrage direct). Impression et PDF : exercice sans réponse.
- Banque dérivée : `packages/shared/src/practice-bank.ts` (listes numérotées, citations, « À retenir »), clés stables par empreinte du texte.

## Moteur de jeux (D198)
- Lecteurs par type : registre `PLAYERS` (`components/practice/activity-runner.tsx`), un composant par type, sans glisser-déposer obligatoire (boutons, clavier).
- Modes : registre `GAME_MODES` (`apps/web/src/lib/games.ts`) ; moteurs `sequence`, `ascension`, `memory` (`components/games/`). Ajouter un mode = une entrée du registre.
- Écran de fin : ce qui est fait, ce qui est à revoir (au plus 4 lignes), récompense réellement obtenue, « Continuer » / « Recommencer ».

## Récompenses et révisions (D196, D197)
- API : `apps/api/src/modules/pedagogy/practice.service.ts` — `GET /practice/bank`, `POST /me/practice/results`, `POST /me/lessons/read`, `GET /me/journal`.
- Le serveur recorrige, attribue les XP une fois par référence (`learning_events`, ajout seul), met à jour la boîte de révision (`practice_progress`). Badges calculés (`computeBadges`).
- Carnet : `/carnet` (XP discret, badges avec détail à la demande, notions à revoir).

## Lecteur (D195)
- Mode concentration (`isImmersivePath`) : leçon, partie, passation ; bouton « Quitter », progression compacte.
- « Découverte » : séquences par intertitre (`lesson-sections.ts`, contenu intégral = assemblage exact) ; « Lecture intégrale » : la leçon complète ; position mémorisée par leçon (`reader-state.ts`).
- Fin de halte : enregistrement serveur de la lecture (une fois), halte suivante, sommaire, halte précédente.

## Accueil et navigation (D199, D200)
- Accueil apprenant : `components/home/learner-home.tsx`, règles `lib/home.ts` (testées).
- Barre inférieure apprenant : Accueil, Cours, Défis, Parcours (ou Évaluations pour l'adulte), Plus.
- Carte d'aventure : `components/modules/adventure-trail.tsx`.

## Hors ligne
- Banque et carnet passent par `apiFetch` (copie chiffrée) et sont préparés avec l'appareil (`preparation.ts`), pages `/defis/*` comprises.
- Résultats et lectures : opérations `practice.result` et `lesson.read` (`OPERATION_TYPES`), rejouées avec un identifiant d'opération ; sans appareil activé, l'écran dit que le résultat n'est pas enregistré.
- Préférences et positions : `localStorage` (aucune donnée personnelle).

## Permissions et sécurité
| Action | Permission | Qui |
| --- | --- | --- |
| Lire la banque, jouer | `practice.play` | routier, adulte, encadrement (aperçu) |
| Enregistrer, carnet | `practice.own` | routier, adulte (titulaire seul, routes `/me`) |
| Rédiger une activité | `module.write` | encadrement (circuit du module) |
| Publier | `module.review` | responsable plein |

Risques traités : score falsifié (recorrection), XP dupliqués (index unique, test de rejeu), contenu non publié (banque issue des seules versions publiées, test), corrigé officiel (jamais lu), XSS (texte seul, schéma en liste blanche), événement d'un autre compte (identité de session uniquement).

## Tests
- Unitaires : `apps/web/src/lib/practice.test.ts`, `home.test.ts`, `components/modules/lesson-sections.test.ts`, `navigation.test.ts`.
- Intégration (PostgreSQL) : `apps/api/test/practice.int-spec.ts`.
- Navigateur : `apps/web/test/immersive.browser.mjs` (fixture `apps/api/test/immersive-browser-fixture.mts`) ; `accessibilite.browser.mjs` étendu aux défis et au carnet.

## Limites et décisions attendues
- Jeu collectif animé par un chef, missions individuelles et d'équipe, avatar, notes et favoris : non implémentés (voir le suivi).
- Barème XP et intervalles de révision : valeurs ludiques par défaut, à confirmer à l'usage.
- Les activités dérivées n'existent que si le contenu publié s'y prête ; les activités rédigées passent par l'approbation du plein.
