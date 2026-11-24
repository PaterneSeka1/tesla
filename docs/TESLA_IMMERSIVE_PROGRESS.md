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
