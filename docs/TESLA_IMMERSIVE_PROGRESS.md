# Suivi — Tesla immersive (cahier des charges `docs/prompts/TESLA_IMMERSIVE_LEARNING.md`)

Fichier de reprise : lire ce fichier, puis la section du cahier des charges du lot en cours.
Branche : `feat/tesla-immersive-learning` (non poussée). Aucun déploiement, aucune migration hors `tesla_test`.

## Lot 0 — Audit et consolidation (2026-11-24) — TERMINÉ

### Branches (revérifiées après `git fetch --all --prune`)
| Branche | Tête | État |
|---|---|---|
| `origin/main` | `3a80bea` | 1 commit de docs (`IMPLEMENTATION_STATUS.md`) absent de `fix/progression-audit` |
| `main` (locale) | `c752164` | 1 commit de retard sur `origin/main`, rien en avance |
| `fix/progression-audit` | `3be47a7` | = `origin/fix/progression-audit` ; 7 commits en avance (D192, D193, référentiel 2026.3, correctif CSS), 1 de retard |
| `feat/sortie-adulte-fiche-medicale` | `97c74ea` | entièrement contenue dans `main` (fusionnée), conservée |

Consolidation : `feat/tesla-immersive-learning` créée depuis `fix/progression-audit`, puis fusion de `origin/main` (docs seulement, sans conflit). Aucune branche supprimée, aucun reset, aucun push.
Migrations de `fix/progression-audit` (`catch_up_reminders`, `stage_transition_notifications`) : additives, appliquées sur `tesla_test` seulement.

### Constat d'audit (code réel)
- Moteur de « jeu » existant (D140) = **présentation à paliers d'une évaluation officielle** (`palier-game.tsx`) : aucune banque d'entraînement, aucun corrigé côté client. Conservé tel quel.
- Lecteur : une leçon à la fois (`lesson-reader.tsx`), position de lecture locale chiffrée (`useReadingPosition`), encadrés pédagogiques déduits des titres (`lesson-structure.ts`).
- Éditeur Tiptap 3 (`lesson-editor.tsx`), document JSON en liste blanche (`lessonDocumentSchema`) ; PDF serveur (`module-pdf.ts`).
- Animations CSS existantes : rise, fade, halo, drift, shake, pop, grow, `.stagger` ; `prefers-reduced-motion` respecté globalement.
- Navigation : barre inférieure à 3 onglets + « Plus » (D182), menu unique par permissions.

### Problèmes UX principaux (avant)
1. Accueil routier = tableau de bord : bandeau d'étape, 2 compteurs, aperçu du parcours, « À étudier », résultats, activités — aucune action principale unique.
2. Aucune activité d'entraînement libre : seul « jouer » possible = évaluation officielle.
3. Lecture : leçon entière en un bloc, cadre complet (menu, barre inférieure) visible pendant la lecture.
4. Aucun retour de réussite hors évaluations ; aucune trace de progression ludique.
5. Pas de révision : rien ne propose de revenir sur une notion.
6. Préférences d'animation, de son et de vibration inexistantes.
7. Adulte : carte d'accueil à 3 boutons de même niveau et paragraphe explicatif.

### Décisions d'architecture (voir `docs/DECISIONS.md`, D194+)
- **Banque d'entraînement = blocs « Activité » des leçons** (nouveau nœud `practice` du document de leçon, schéma Zod en liste blanche). Elle suit donc le circuit existant (rédaction → approbation → publication, versions figées), sans second circuit et sans jamais lire un questionnaire officiel.
- **Adaptateurs déterministes** sur le contenu publié existant, sans rien inventer ni modifier : liste numérotée → remise en ordre ; citation (texte, prière) → texte à compléter (mémorisation, jamais notée) ; encadré « À retenir » → carte de rappel.
- **Jeux = registre de modes** côté web, exécutés sur l'appareil à partir des contenus publiés déjà mis en cache (fonctionnent hors ligne). Aucun corrigé officiel exposé.
- **Récompenses** : attribuées par le serveur, qui recorrige l'activité à partir de la version publiée ; clé d'idempotence unique ; jamais de lien avec l'étape, les acquis ou les résultats officiels.

## État des lots (mis à jour le 2026-11-24)
| Lot | Contenu | État | Fichiers principaux |
|---|---|---|---|
| 0 | Audit, consolidation, tests de référence | **terminé** | ce fichier |
| 1 | Fondations : jetons d'animation (micro, transition, accomplissement), préférences d'appareil, retour sensoriel, mode concentration | **terminé** | `globals.css`, `lib/preferences.ts`, `lib/feedback.ts`, `dashboard-shell.tsx`, `app-nav.tsx` |
| 2 | Accueil apprenant (une aventure, une suggestion), présentation de première visite, barre inférieure à 4 + Plus | **terminé** | `components/home/learner-home.tsx`, `lib/home.ts`, `lib/onboarding.ts`, `lib/navigation.ts` |
| 3 | Carte d'aventure (sentier des haltes, vue liste), page module simplifiée | **terminé** | `components/modules/adventure-trail.tsx`, `module-detail.tsx` |
| 4 | Lecteur : concentration, Découverte / intégrale, reprise de séquence, activités intégrées, fin de halte, impression | **terminé** | `lesson-reader.tsx`, `lesson-sections.ts`, `reader-state.ts`, `practice-block.tsx` |
| 5 | Éditeur : bloc Activité (7 types), formulaire simple, aperçu, PDF | **terminé** | `practice-form.tsx`, `practice-node.tsx`, `lesson-editor.tsx`, `module-pdf.ts` |
| 6 | Moteur de jeux : registre des lecteurs et des modes, 10 modes dont L'Ascension et la mémoire | **terminé** | `components/practice/*`, `components/games/*`, `lib/games.ts` |
| 7 | XP et badges serveur idempotents, carnet | **terminé** (notes personnelles et favoris : non faits) | `practice.service.ts`, `learning.ts`, `components/journal/*` |
| 8 | Révisions espacées (Leitner), « Retour sur les traces », défi express | **terminé** | `nextReview`, mode `revisions` |
| 9 | Missions et jeu collectif | **non réalisé** — décision métier attendue (voir plus bas) | — |
| 10 | Personnalisation : préférences (animations, sons, vibrations), revoir la présentation | **partiel** (avatar non fait) | `comfort-settings.tsx` |
| 11 | Hors ligne : banque, carnet et pages de défis préparés ; résultats en file rejouable ; message si appareil non activé | **terminé** | `preparation.ts`, `operations.ts`, `activity-runner.tsx` |
| 12 | Sécurité (recorrection, idempotence, permissions, confidentialité) ; indicateur agrégé pour l'encadrement | **terminé** ; mesures de performance : voir ci-dessous | `practice.int-spec.ts` |
| 13 | Recette finale, audit de simplicité, documentation | **terminé** (voir le rapport) | `immersive.browser.mjs`, docs |

## Migrations
- `20261125090000_learning_events_practice` (additive : 2 tables, CHECK, trigger d'ajout seul).
- 2026-11-24, sur demande : base locale **`tesla`** sauvegardée (`../tesla-backups/tesla-avant-migrations-2026-11-24.dump`, hors dépôt), puis `db:deploy` des 4 migrations en attente (`learner_kind_adults`, `catch_up_reminders`, `stage_transition_notifications`, `learning_events_practice`) ; `migrate diff` : aucune dérive. **Production non touchée.**
- Seed de démonstration appliqué sur `tesla` (`prisma/seeds/demo-community.ts`) : 21 comptes, 16 fiches, catalogue publié au nom du plein, module « S’entraîner : repères de la progression » soumis par un assistant (à approuver par le plein). Limite : aucun module publié n'est obligatoire avec source officielle, donc aucun rattrapage n'apparaît (règle D177, non contournée).

## Tests exécutés
- Référence (avant travaux) : lint, typecheck, API 312/312, web 146/146.
- Après travaux : lint et typecheck OK ; API 312/312 ; web 161/161 (15 nouveaux tests : `practice`, `home`, `lesson-sections`, navigation adaptée) ; intégration PostgreSQL `tesla_test` : 26 fichiers réussis + `practice.int-spec.ts` 5/5 (1 test ignoré préexistant : classeur réel absent).
- `format:check` : 3 écarts **préexistants** sur des fichiers non modifiés (`module-publication.ts`, `editeur-pedagogique.browser.mjs`, `offline-auth.browser.mjs`), laissés tels quels.
- `audit:prod` : **non exécuté** (délai réseau dépassé).
- Navigateur (build de production, base `tesla_test`) : `immersive.browser.mjs` 18/18, `refonte-mobile.browser.mjs` 20/20 (attentes adaptées : onglet Défis, évaluations dans « Parcours »), `catalogue-lecture.browser.mjs` 8/8 (passage en lecture intégrale), `accessibilite.browser.mjs` 39 écrans, 0 violation.

## Mesures de performance (laboratoire)
Build de production local, Chromium, 390 px, CPU ×4, réseau « 4G lente » émulé (1,6 Mbit/s, 150 ms), session ouverte, cache du navigateur actif (`apps/web/test/immersive-perf.browser.mjs`). Indicatif : ne garantit pas le comportement sur tous les téléphones. Aucune mesure « avant » comparable n'a été prise.

| Écran | LCP | CLS | Interaction | JS transféré |
|---|---|---|---|---|
| Accueil (premier chargement) | 700 ms | 0 | — | 261 ko |
| Module (sentier) | 600 ms | 0 | — | 157 ko |
| Défis | 560 ms | 0 | — | 150 ko |
| Vrai ou faux (réponse) | — | 0 | 48 ms | 70 ko |
| Carnet | 600 ms | 0 | — | 69 ko |

Aucune dépendance ajoutée (animations en CSS, sons synthétisés, nœud Tiptap natif). Les jeux sont chargés par route.

## Audit final de simplicité
| Écran | Action principale | Retiré ou déplacé |
|---|---|---|
| Accueil apprenant | Continuer / Commencer | bandeau d'étape (devenu pastille), 2 compteurs, aperçu du parcours, « À étudier », résultats récents, liste d'activités (1 ligne) ; titre « Accueil » répété |
| Accueil adulte | Explorer les cours | paragraphe explicatif, 3 boutons de même niveau |
| Module | Commencer / Reprendre | 3 boutons secondaires → « Plus » ; « Version · publiée le » en pied ; « Rendre disponible hors ligne » discret ; bouton « Cet appareil » retiré (lien seulement si nécessaire) |
| Leçon | Continuer | menu, en-tête et barre masqués ; « Leçon x sur y » remplacé par une barre de progression compacte |
| Activité dans une leçon | celle de l'activité | « Continuer » du lecteur devenu « Passer » discret ; « Commencer » en style secondaire en lecture intégrale |
| Défis | choisir un jeu | cartes → lignes compactes ; durées retirées ; règles seulement à la première partie ou sur demande |
| Fin d'activité | Continuer | statistiques limitées à « x sur y », 4 points à revoir au plus, récompense seulement si obtenue |
| Carnet | consulter un badge | détail d'un badge seulement à la sélection |

## Anomalies corrigées pendant la recette
- Deux boutons principaux concurrents dans une séquence d'activité → l'activité démarre seule, « Passer » discret.
- Titre de la leçon masqué en lecture intégrale d'une leçon courte → corrigé.
- Lien vers la leçon précédente disparu → « Halte précédente » rétabli.
- « Plus » renvoyé à la ligne dans la barre à 4 onglets → colonne corrigée.
- Révision récompensée par répétition immédiate → une réussite avant l'échéance ne fait plus monter la boîte.
- Résultat hors ligne perdu sans message quand l'appareil n'est pas activé → message explicite.
- Salle des défis trop chargée → lignes compactes groupées, sans durée affichée.

## Décisions métier attendues
1. **Missions** (individuelles, d'équipe, liées au programme annuel) : qui les propose, faut-il un suivi de réalisation, lien avec les présences ? Rien n'a été créé pour ne pas inventer de règle.
2. **Jeu collectif animé par un chef** (code temporaire, temps réel) : à confirmer avant d'introduire une infrastructure temps réel.
3. **Barème XP** et **intervalles de révision** : valeurs ludiques par défaut (`XP_RULES`, `REVIEW_INTERVALS_DAYS`), à valider à l'usage.
4. **Avatar** : liste d'emblèmes à valider (aucune boutique, facultatif).
5. **Notes personnelles et favoris** : confidentialité confirmée (titulaire seul) ; à prioriser.
6. Terminologie « halte » pour une leçon côté routier (« leçon » conservé côté encadrement).

## Reprise
1. `git switch feat/tesla-immersive-learning` ; rien n'est commité ni poussé (règle du dépôt : commit sur demande).
2. Fixture de recette : `cd apps/api && TEST_DATABASE_URL=…/tesla_test npx tsx test/immersive-browser-fixture.mts`.
3. API (`DATABASE_URL` vers `tesla_test`, `npx nest start`), web de production (`next build && next start`), puis `node apps/web/test/immersive.browser.mjs` avec `PLAYWRIGHT_MODULE` et `CHROMIUM_PATH`.

---

# Chantier 2 — audit et perfectionnement (2026-11-24)

Cahier des charges : prompt « Audit post-implémentation » (non versionné). Branche **`feat/tesla-immersive-audit`** créée depuis `feat/tesla-immersive-learning` (8362a4f = `origin/feat/tesla-immersive-learning`, 0 retard sur `origin/main` 3a80bea). Rien n'est commité ni poussé.

## Constats vérifiés dans le code (lot A)
| # | Constat | Fichier | Gravité |
|---|---|---|---|
| 1 | Aucune idempotence métier : un second envoi (nouvel identifiant d'opération, deux appareils, relance) incrémente `attempts`, déplace la boîte | `practice.service.ts` | P0 |
| 2 | Aucune notion de version : un résultat hors ligne est recorrigé contre le contenu actuel | `practice.service.ts` | P0 |
| 3 | Erreur serveur avalée (`saved = 'none'`, aucun message) ; réponse tardive d'une manche abandonnée écrasait la nouvelle | `activity-runner.tsx` | P0 |
| 4 | Parties en `localStorage` non isolées par compte (`tesla.games.position`, `tesla.games.ascension`) ; Ascension perdue au changement de jour (signature datée) ; mémoire non sauvegardée | `sequence-game.tsx`, `ascension-game.tsx`, `memory-game.tsx` | P0 |
| 5 | Badges recalculés, jamais enregistrés ; « Retour sur les traces » exige la boîte **actuelle** ≥ 4 (perdu après une erreur) ; « Persévérance » accordée après 3 réussites sans difficulté | `learning.ts` | P0 |
| 6 | Révisions d'activités retirées comptées et proposées | `journal()` | P1 |
| 7 | Leçon identifiée par l'empreinte de son titre : un renommage efface la lecture | `lessonReadRef` | P1 |
| 8 | L'Ascension affichée avec une seule question (« Il faut au moins quatre questions ») ; défi express suggéré sans activité compatible | `game-room.tsx`, `home.ts` | P1 |
| 9 | Indice du quiz utilisé sans effet sur la maîtrise ; Ascension et mémoire sans aucun lien avec le suivi | `quiz-player.tsx` | P1 |

Non reproduit en navigateur pendant ce chantier (constats établis par lecture du code et par tests).

## Réalisé
- **Lot B/C (D201)** : `practice_attempts` (ajout seul, rejeu à l'identique, `PERIMEE`), verrou par compte, `fingerprint` dans la banque, modes `activity` / `ascension` / `memory`, réponses assistées, `learning_badges` (ajout seul), `failures_before_mastery`, `module_lessons.lesson_key` (reprise par module et titre), révisions réconciliées, `readLessonIds` et `mastered` dans le carnet. Web : `lib/game-session.ts` (coffre chiffré ou onglet, par compte, 14 jours, écritures en série, purge des anciennes clés), `lib/practice-results.ts` (9 états nommés, « Réessayer », renvoi au retour du réseau avec le même identifiant).
- **Lot D** : `isPlayable` / `playableModes` / `dueInBank` ; sélection (priorité, récence locale, variété des leçons, difficulté) fixée à l'ouverture ; difficulté éditoriale facultative dans le schéma.
- **Lot E (partiel)** : L'Ascension (`ascension-landscape.tsx`) ; dos de carte du jeu de mémoire.
- **Lot F (partiel)** : salle des défis (deux jeux illustrés, tuiles) ; accueil et module utilisent `isPlayable`.

## Non réalisé (à reprendre dans cet ordre)
1. Recette navigateur de ce chantier (captures, `immersive.browser.mjs` à adapter : salle des défis en tuiles, libellés « Monter », « Changer »), mesures avant/après.
2. Persistance des réponses **à l'intérieur** d'une activité (question en cours d'un quiz) : seule la position dans la partie et l'activité terminée sont reprises.
3. Lot E restant : frise, associations, mises en situation, flashcards.
4. Lot F : carte d'aventure illustrée (vue liste à conserver).
5. Lot G : expéditions ; désactivation par l'encadrement d'un exercice dérivé (une liste numérotée n'est pas toujours une séquence).
6. Lot H : saisie de la difficulté dans `practice-form.tsx`, aperçu des exercices dérivés.
7. Lots I et J : missions, jeu collectif, carnet personnalisé — décisions métier toujours attendues (voir plus haut).
8. Lot K : `audit:prod`, recette téléphones réels.

## Migration
`20261126090000_practice_attempts_badges` (additive) : 2 tables en ajout seul (triggers), 2 colonnes, CHECK. La reprise de `lesson_key` suspend `module_lessons_draft_guard` le temps d'une instruction (seule la nouvelle colonne technique est écrite). Appliquée sur **`tesla_test` seulement** ; `migrate diff` : aucune dérive. Ni `tesla` ni la production.

## Tests (2026-11-24)
- Référence avant travaux : typecheck OK, API 312/312, web 161/161.
- Après : lint OK, typecheck OK, API 312/312, web **179/179** (18 nouveaux : `games.test.ts`, `game-session.test.ts`, `practice-results.test.ts`, badges et empreinte dans `practice.test.ts`), intégration `practice.int-spec.ts` **10/10** (5 nouveaux : rejeu simultané, version périmée, réponses assistées et Ascension, badges acquis, leçon renommée).
- Non exécutés : `npm run build`, suite d'intégration complète, recettes navigateur, `audit:prod`.


---

# Chantier 3 — Excellence immersive (2026-11-25)

Cahier des charges : `docs/prompts/TESLA_IMMERSIVE_EXCELLENCE.md` (127 sections, lots 0–15). **Après une compaction : relire ce bloc, puis la section du cahier correspondant au lot en cours.**
Branche **`feat/tesla-immersive-excellence`**, créée depuis `feat/tesla-immersive-audit` (58b231f). Rien n'est commité ni poussé (règle du dépôt : commit sur demande). Aucun déploiement.

## Lot 0 — Audit Git et référence — TERMINÉ
| Branche | vs `origin/main` (3a80bea) | Contenue dans la base ? |
|---|---|---|
| `main` locale (c752164) | 0 / −1 | oui |
| `feat/sortie-adulte-fiche-medicale` (97c74ea, 1 commit local non poussé) | 0 / −7 | oui |
| `fix/progression-audit` (3be47a7) | +7 / −1 | oui |
| `feat/tesla-immersive-learning` (8362a4f) | +20 / 0 | oui |
| `feat/tesla-immersive-audit` (58b231f = origin) | +28 / 0 | **base** |
Aucune fusion nécessaire (toutes les branches sont des ancêtres de la base). Aucun stash, aucun worktree, aucune suppression. Écart doc : la section « Chantier 2 » disait « rien n'est commité ni poussé » ; en réalité 58b231f est poussé sur `origin/feat/tesla-immersive-audit`.

Référence (avant travaux, 2026-11-25) : `format:check` 3 écarts préexistants (mêmes fichiers) ; lint OK ; typecheck OK ; API 312/312 ; web 179/179. `build` : exécuté pendant les premières modifications, donc **non représentatif** (à refaire sur un arbre propre de 58b231f pour les mesures avant/après).

## Lot 1 — Sauvegardes et isolation — TERMINÉ (code + unitaires ; recette navigateur au lot 15)
Écarts reproduits (lecture du code) : rejeu serveur ne comparant que module + activité ; état interne des activités (question en cours, saisies, indices) non sauvegardé ; écriture de coffre échouée → copie d'onglet jamais relue si le coffre est ouvert ; effets de bord (sauvegarde) dans un `setState(updater)` (doublés en Strict Mode) ; même expiration (14 j) pour toutes les données.
Réalisé :
- Contrat commun `useSaved(props, champ, initial)` (`components/practice/kit.tsx`) adopté par les 6 lecteurs (quiz/vrai-faux, texte à compléter, flashcards, associations, remise en ordre, mise en situation).
- `ActivityRunner` : partie enregistrée par compte (`activity:<module>:<clé>`), identifiant de partie = identifiant de tentative, écritures regroupées (300 ms, immédiate à `pagehide`), contenu modifié → « Cette activité a été mise à jour. » + « Commencer ».
- `game-session.ts` : révision `rev`, format `v`, `validSession`, `newest` (coffre vs onglet), suppression de la copie d'onglet après écriture réussie dans le coffre, écritures hors des fonctions de mise à jour React, `durable` exposé. Conservation : partie abandonnée 14 j, souvenir de variété 60 j, résultats : aucune expiration.
- L'Ascension : identifiant de tentative de la réponse stocké dans la partie (`answerId`), renvoyé à la reprise (idempotent).

## Lot 2 — Résultats et synchronisation — TERMINÉ (code + tests)
- `practice-results.ts` réécrit : un enregistrement par tentative (`result:<id>` dans le coffre, sinon `tesla.result:<compte>:<id>`), **écrit avant l'envoi**, aucune limite, aucune liste partagée en lecture-modification-écriture, essais comptés + dernière erreur + attente croissante (10 s → 15 min), une seule requête par tentative (double clic), état `unsaved` si aucun stockage possible. Hors ligne avec coffre : la file d'opérations existante (D110) prend le relais, l'enregistrement local est retiré (pas de doublon).
- `PracticeSync` (monté sous `SessionGate`) : ouverture, retour réseau, premier plan, déverrouillage, nouveau résultat, échéance ; réponse d'un ancien compte ignorée.
- API : `sameAttempt` — un rejeu n'est accepté que si module, activité, empreinte, mode, question, assistance et réponses sont identiques ; sinon 409 `PRACTICE_ATTEMPT_REUSED` (D204). Anciens clients sans `attemptId` : inchangés (identifiant serveur).
Tests : web 186/186 (+7), API 312/312, `practice.int-spec.ts` 10/10 sur `tesla_test` (cas « requête modifiée » ajoutés).

## Lot 3 — Intégrité pédagogique — TERMINÉ
Écarts reproduits (code + test) : un texte respectueux dérivé (prière, loi) était noté par le serveur, pouvait être « maîtrisé », faire monter Leitner, rapporter l'XP de maîtrise et compter des « difficultés » (Persévérance) ; une mise en situation ouverte était « maîtrisée » dès qu'un choix était fait.
Correctif (D204) : activité **non notée** = `reverent` ou `scenario` → `correct 0 / total 0`, jamais maîtrisée, aucune difficulté comptée, XP de participation seulement ; la répétition espacée avance quand l'activité est refaite à l'échéance (mémorisation douce). `isMastered` partagé : sans élément noté → `false`.
Déjà en place et revérifié : badges persistés jamais retirés (`learning_badges`), Persévérance sur vraies difficultés, révisions réconciliées avec les versions publiées, `lesson_key`, `isPlayable` (accueil, module, défis), sélection (échéances, récence, variété des leçons, difficulté), Ascension triée par difficulté éditoriale sans prétendre à une progression (« de plus en plus loin » = distance). Fuseau : échéances en UTC = heure d'Abidjan (UTC+0), à revoir si l'application sort de cette zone.
Tests : `practice.int-spec.ts` 11/11 (+ prière dérivée), web 186/186, API 312/312.

## ⚠ Incident (2026-11-25 16:30)
`npx prisma migrate deploy` lancé avec `TEST_DATABASE_URL` seulement : Prisma lit `DATABASE_URL` du `.env` racine → la migration additive `20261126090000_practice_attempts_badges` a été appliquée à la base **locale `tesla`** (non autorisé ; production non concernée). Pas de retour arrière manuel tenté (migration additive, retour plus risqué). À arbitrer par l'utilisateur. Règle : toujours préfixer `DATABASE_URL=<…tesla_test…>` pour toute commande Prisma.

## Lots 4 à 7 — Direction artistique, jeux, carte, expéditions — TERMINÉS (recette navigateur faite, voir lot 15)
- **Lot 4 (D205)** : bibliothèque graphique `components/illustrations/scenery.tsx` (baobab, acacia, tente, feu, rose des vents, fanion, herbes ; SVG originaux, couleurs du thème, décoratifs `aria-hidden`), 3 compositions (`savane`, `camp`, `piste`) choisies de façon stable par module ; animation `animate-draw` (tracé du chemin parcouru, neutralisée par la réduction des animations).
- **Lot 5 (D206)** : nouveau type **Enquête** (`investigation` : mission, 2–6 indices vérifiés révélés un à un, énigme, solution expliquée ; première proposition notée, indices jamais pénalisés), mode de jeu `enquetes`, formulaire de l'éditeur ; **frise** : une remise en ordre dont toutes les étapes portent un repère temporel (année, mois, siècle) devient une frise, repères révélés à la vérification ; **mémoire** : grille à 2 colonnes pour les textes longs (rien de coupé à 320 px), paire trouvée réaffichée en clair, plus de décompte d'essais à la fin ; difficulté facultative dans le formulaire (volet « Paramètres »).
- **Lot 6** : **carte d'aventure illustrée** (lacets, relief, décor, départ, tronçon parcouru doré, défis, arrivée ; haltes = vraie liste de liens ; « Halte en cours » au-delà de 5 haltes ; vue liste conservée, libellé « Carte ») ; **salle des défis** : un seul jeu mis en avant, les autres en tuiles compactes ; débordement horizontal **préexistant** à 320 px corrigé (grille implicite + `truncate`).
- **Lot 7 (D207)** : **expéditions** `/modules/[slug]/expedition` (mode concentration) : haltes lues dans le lecteur existant (retour « Continuer l'expédition »), exercices dérivés de chaque halte joués sur place (notions à revoir d'abord, étape facultative si tout est maîtrisé), L'Ascension du module si jouable (retour automatique), synthèse (objectifs publiés), fin. Sauvegarde par compte (`expedition:<slug>`), préparée hors ligne. Action principale du module « Partir en expédition » quand il y a de quoi s'entraîner (« Lire » en secondaire). Expédition de référence : module de recette `recette-entrainement` ; dans le catalogue réel, toute expédition dépend des exercices publiés (aucun contenu ajouté).
Tests : web 190/190 (+ `expedition.test.ts`, enquête dans `practice.test.ts`) ; recette `excellence.browser.mjs` 5/5 à 390 px (reprise d'une réponse après actualisation, carte, enquête, expédition avec reprise).
Limites : la carte place les libellés à côté des haltes ; au-delà d'une quinzaine de haltes la carte reste longue (vue liste disponible). Le jeu de mémoire ne sauvegarde pas une carte retournée isolée (se referme en < 1 s).

## Lot 8 — Contenus et éditeur — TERMINÉ (partiel assumé)
- **Exercices dérivés (D208)** : attribut `noPractice` sur liste numérotée, citation, titre « À retenir » (Tiptap `NoPracticeAttribute`, schéma en liste blanche) ; panneau « Exercices tirés du texte (n/m) » sous l'éditeur : aperçu dans le rendu apprenant (rien d'enregistré) et case « proposé ». La décision vit dans la leçon → versionnée, soumise à approbation ; le texte n'est jamais modifié. `buildPracticeBank(…, { includeDisabled })` pour l'éditeur seulement.
- Difficulté facultative (lot 5), type Enquête dans l'éditeur, frise via repères temporels.
- Non réalisé : modèles réutilisables (§58), indicateur de couverture pédagogique (§59 — le panneau donne déjà le nombre d'exercices par leçon), aperçu mobile/desktop côte à côte (§57 ; l'aperçu actuel est le rendu apprenant).

## Lot 9 — Carnet et personnalisation — TERMINÉ (favoris, notes) ; avatar et compagnon non faits
- **D209** : tables `learner_bookmarks`, `learner_notes` (migration additive `20261127090000_learner_notebook`, CHECK longueur 1–4000 et révision ≥ 1) appliquée sur **`tesla_test` seulement**. API `GET /me/notebook`, `PUT /me/bookmarks` (idempotent), `PUT /me/notes` (révision attendue → 409 `NOTE_CONFLICT`, texte vide = suppression), `DELETE /me/bookmarks/:id` et `/me/notes/:id` (titulaire seul, contenu retiré compris). Permission `practice.own` (routier, adulte) ; aucune route par compte, encadrement refusé (403).
- Identité stable `lesson_key` : renommage et nouvelle version suivis ; leçon retirée → « plus disponible », jamais supprimée en silence.
- Web : icônes favori / note dans l'en-tête du lecteur ; volets « Favoris » et « Mes notes » repliés dans le carnet ; écritures différables hors ligne (`bookmark.set`, `note.save` avec révision de référence) ; préparées hors ligne (copie chiffrée).
- Tests : `practice.int-spec.ts` 12/12 (carnet : idempotence, conflit, création simultanée, isolation, 403 encadrement, renommage, retrait, suppression).
- **Non fait (décision attendue)** : avatar et emblèmes (liste à valider), compagnon « Requin de Sable » (étude seulement : dessin, ton et moments d'apparition à valider ; désactivable).

## Lots 10 et 11 — Missions et jeux collectifs — NON ACTIVÉS (décisions métier attendues, D210, D211)
Aucun code ajouté (pas de fonctionnalité factice ni de code inactif). Propositions détaillées dans `docs/DECISIONS.md` (D210 missions, D211 sessions collectives).

## Lot 12 — Encadrement — TERMINÉ (périmètre : tableau communautaire)
- Constat reproduit en navigateur : `/administration/parcours` en colonnes horizontales sur téléphone (2e colonne coupée, défilement latéral).
- Correctif : sur téléphone, les quatre compteurs sont des boutons bascule (`aria-pressed`) qui affichent **une étape à la fois** en pleine largeur (par défaut la première qui compte des routiers) ; bureau inchangé (4 colonnes). Aucun déplacement d'étape possible (étapes calculées).
- Non fait : filtre par équipe (§75), indicateur de couverture pédagogique (§59).
- Éditeur : panneau des exercices dérivés (lot 8) ; anomalie trouvée en recette (document brut de Tiptap passé à la dérivation → page en erreur) corrigée par validation préalable du document.

## Lot 15 (en cours) — Recettes exécutées le 2026-11-25 (build de production, base `tesla_test`)
- `excellence.browser.mjs` : **12/12** à 320, 390 et 1440 px ; axe-core (WCAG 2.0/2.1/2.2 A et AA) sur 14 écrans nouveaux ou modifiés : **0 violation** ; aucune erreur de page, aucun défilement horizontal.
- `immersive.browser.mjs` (non-régression chantiers 1–2) : **18/18**, après adaptation de 4 attentes devenues caduques (libellé « Carte », action « Partir en expédition »/« Lire », salle des défis en tuiles — déjà caduque depuis le chantier 2 —, palier de L'Ascension lu dans l'illustration).
- Fixture : la suite d'intégration remet `tesla_test` à zéro ; regénérer `immersive-browser-fixture.mts` avant chaque recette navigateur.

## Lots 13 à 15 — Hors ligne, sécurité et performances, recette finale — TERMINÉS (2026-11-25)

### Vérifications finales (build de production, base `tesla_test`)
| Contrôle | Résultat |
|---|---|
| `format:check` | 3 écarts **préexistants** (fichiers non modifiés : `module-publication.ts`, `editeur-pedagogique.browser.mjs`, `offline-auth.browser.mjs`) |
| `lint`, `typecheck` | OK |
| Tests unitaires | API **312/312**, web **191/191** (179 au départ) |
| `build` | OK |
| Intégration PostgreSQL complète (`test:int`) | **213/213**, 1 ignoré préexistant (classeur réel absent) |
| `audit:prod` | **non exécuté** : l'API d'audit du registre npm coupe la connexion TLS (3 essais), alors que le registre répond |
| `excellence.browser.mjs` | **20/20** à 320, 360, 390, 430, 768, 1024, 1440 px ; axe-core WCAG A/AA : 14 écrans, **0 violation** |
| `immersive.browser.mjs` (non-régression) | **18/18** |

### Hors ligne (lot 13)
Vérifié en navigateur : appareil activé → préparation complète ; sans réseau : expédition, enquête, carnet (notes) rouverts ; parties jouées, résultat conservé puis synchronisé une seule fois (non-régression 18/18). Non vérifié : infrastructure réelle OVH/Nginx/Vercel en HTTPS (préproduction à prévoir), téléphones réels.

### Sécurité (lot 14)
- Nouvelles routes : `practice.own` contrôlée côté serveur (encadrement et administrateur refusés), aucune route par compte, suppression limitée au titulaire (un identifiant d'autrui = 404), entrées validées par Zod, conflits explicites (409).
- Rejeu : identité sémantique complète (D204). Corrigés officiels : aucune nouvelle route ne lit un questionnaire officiel ; la banque reste issue des seules versions publiées.
- Données personnelles : notes sans expiration automatique (suppression par le titulaire) — politique de purge à arrêter (décision attendue) ; tables `practice_attempts`/`learning_events` toujours en ajout seul sans rétention définie (déjà signalé).

### Performances (laboratoire : Chromium, 390 px, CPU ×4, 1,6 Mbit/s / 150 ms, cache actif)
| Écran | LCP | CLS | Interaction | JS |
|---|---|---|---|---|
| Accueil | 728 ms (700 au chantier 1) | 0 | — | 262 ko (261) |
| Module (carte illustrée) | 608 ms (600) | 0 | — | 185 ko (157) |
| Défis | 576 ms (560) | 0 | — | 152 ko (150) |
| Vrai ou faux (réponse) | 960 ms | 0 | 64 ms (48) | 63 ko (70) |
| Carnet | 536 ms (600) | 0 | — | 72 ko (69) |
| Expédition | non relevé* | 0 | — | 59 ko |
| Enquête (indice) | non relevé* | 0 | 40 ms | 83 ko |
\* navigation interne sans nouvel élément LCP. Indicatif ; aucune garantie sur tous les appareils. Carte : +28 ko de JS (illustration et expédition). Pas de mesure sans cache, ni de session longue de 60–120 min (non réalisée).

### Audit final de simplicité
| Écran | Action principale | Retiré / regroupé |
|---|---|---|
| Module | Partir en expédition (« Lire » secondaire) | durée des haltes retirée de la carte |
| Carte | toucher une halte | libellés courts, décor décoratif, liste à la demande |
| Expédition | une action par étape | aucune statistique ; progression = une barre |
| Défis | un jeu mis en avant | tuiles compactes, pictogramme masqué sous 360 px |
| Enquête | répondre / indice suivant | un seul indice affiché au départ |
| Mémoire | retourner une carte | décompte d'essais supprimé |
| Lecteur | continuer | favori et note en deux icônes |
| Carnet | consulter | favoris et notes repliés |
| Parcours des routiers (mobile) | choisir une étape | colonnes horizontales supprimées |

## Restes et décisions attendues (chantier 3)
1. ⚠ Incident : migration `20261126090000_practice_attempts_badges` appliquée par erreur à la base locale `tesla` (conserver ou restaurer ?).
2. Missions (D210) et sessions collectives (D211) : règles à valider avant toute activation.
3. Avatar, emblèmes, compagnon : à valider ; non réalisés.
4. Politique de conservation des notes, tentatives et événements d'apprentissage.
5. Non réalisés : modèles réutilisables, indicateur de couverture, filtre par équipe, aperçu mobile/bureau côte à côte, recette longue 60–120 min, recette téléphones réels, `audit:prod`, préproduction HTTPS.
6. Migration `20261127090000_learner_notebook` : sur `tesla_test` seulement.
7. Rien n'est commité ni poussé ; aucun déploiement.
