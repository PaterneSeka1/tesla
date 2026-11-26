# Chantier « Référentiel scout » — suivi

Chantier parallèle à « Tesla Immersive Excellence ». Documentation fonctionnelle : [FEATURES/REFERENTIEL_SCOUT.md](FEATURES/REFERENTIEL_SCOUT.md). Décisions D220–D222 (plage choisie pour éviter D204–D211, utilisées par le chantier immersif).

## Isolation

| Élément | Valeur |
| --- | --- |
| Branche | `feat/tesla-scout-reference` (aucun commit, aucun push à ce jour) |
| Commit de référence | `58b231f` (= `origin/feat/tesla-immersive-audit`, contient `origin/main` 3a80bea) : dernier commit stable, point de départ commun avec `feat/tesla-immersive-excellence` (qui n'a que des modifications non commitées) |
| Worktree | `../tesla-scout-reference` (le répertoire `../tesla` de l'autre session n'a jamais changé de branche ; aucune modification, aucun stash, aucun reset) |
| Bases | `tesla_scout` (développement) et `tesla_scout_test` (intégration), dans le conteneur `tesla-postgres` existant (pas de second conteneur : mémoire WSL limitée). Bases `tesla`, `tesla_test`, `tesla_local` intouchées |
| `.env` du worktree (ignoré par Git) | `DATABASE_URL` → `tesla_scout`, `TEST_DATABASE_URL` → `tesla_scout_test`, `API_PORT=4100`, `CORS_ORIGINS=http://localhost:3100`, `NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1` (web à lancer avec `--port 3100`) |
| Node | 22.23.4 (`nvm use 22`), `node_modules` propre au worktree |

## Réalisé

- **Lot 0** : audit Git (branches, worktree, commits), isolation, lecture du PDF (9 pages, chiffré AES-256, copie du texte interdite, impression et accessibilité autorisées) par **rendu visuel des pages** dans le dossier temporaire de session, sans extraction de texte ni retrait de protection. Inventaire : Prière de la Route = module `priere-de-la-route` (texte fondamental), loi scoute = leçon « Les dix articles de la loi scoute » du module M02.
- **Lot 1** : modèle `reference_categories` / `reference_entries`, permission `reference.manage` (plein), API `/reference`, pages `/referentiel`, `/referentiel/:id`, `/encadrement/referentiel`, navigation (rubrique Cours), `robots.txt`.
- **Lot 2** : Cérémonial de la Route, 9 fiches, brouillon importé (`NT-TXT-CEREMONIAL-ROUTE`) ; lecture, lecture intégrale, Mon rôle, préparation, mode cérémonie, impression existante. Divergence p. 8 conservée et signalée (note « À vérifier »).
- **Lot 3** : Prière scoute (brouillon `NT-TXT-PRIERE-SCOUTE`, texte mot pour mot), Prière de la Route et loi scoute rangées sans copie ; mémorisation facultative.
- **Lots 4–5** : formats audio (liste blanche, signature réelle, CHECK SQL), bloc `audio`, lecteur, paroles synchronisées, chant collectif, Media Session, atelier de synchronisation, import LRC/WebVTT/SRT, droits obligatoires avant soumission, repères liés à l'enregistrement exact.
- **Lot 6** : architecture prête pour Charte, chants, Légende du feu (« Nouvelle ressource » dans une rubrique) ; aucun contenu inventé, aucune rubrique vide créée.
- **Lot 7** : référentiel dans « Préparer l'appareil », copies audio hors ligne (D222).
- **Lot 8** : tests (ci-dessous). **Lot 9** : stratégie d'intégration (ci-dessous).

Seed : `npm run db:seed:reference [-- --dry-run]` (idempotent, brouillons seulement, publication par le plein depuis l'application). Exécuté sur `tesla_scout` uniquement.

## Fichiers

Nouveaux : `packages/shared/src/{reference,lyrics,ceremony}.ts` ; `apps/api/src/modules/reference/*` ; `apps/api/prisma/migrations/20261130090000_scout_reference/` ; `apps/api/prisma/seeds/{referentiel-scout.seed,referentiel-scout.spec,reference-catalog,reference}.ts` ; `apps/api/test/reference.int-spec.ts` ; `apps/web/src/components/reference/*` ; `apps/web/src/app/(espaces)/referentiel/*` ; `apps/web/src/app/(espaces)/encadrement/referentiel/*` ; `apps/web/src/lib/{reference-media,wake-lock,reference.test}.ts`, `apps/web/src/lib/api/reference.ts` ; `docs/FEATURES/REFERENTIEL_SCOUT.md` ; ce fichier ; `docs/sources/Ceremonial_de_la_Route_Nikola_Tesla_protege.pdf` (même fichier que celui déposé, non suivi, dans `../tesla`).

Modifiés (changements minimaux) : `packages/shared/src/{lesson-content,files,modules,permissions,index}.ts` ; `apps/api/prisma/schema.prisma` ; `apps/api/src/app.module.ts` ; `apps/api/src/modules/pedagogy/{module-editor.service,module-pdf}.ts` ; `apps/api/src/storage/{file-signature,stored-files.service,storage.spec}.ts` ; `apps/api/package.json`, `package.json` (script `db:seed:reference`) ; `apps/web/src/components/modules/{lesson-content,lesson-editor}.tsx` ; `apps/web/src/lib/{navigation,navigation.test,site}.ts` ; `apps/web/src/lib/offline/preparation.ts` ; `apps/web/src/app/(espaces)/modules/catalog.tsx` ; `docs/DECISIONS.md` ; `CHANGELOG.md`.

Non modifiés volontairement : service et banque d'entraînement, coffre, synchronisation, service worker, cadre authentifié, `globals.css`, `TESLA_IMMERSIVE_PROGRESS.md` ; `IMPLEMENTATION_STATUS.md` ne reçoit qu'un renvoi ajouté en fin de fichier (en-tête laissé à l'autre chantier).

## Migration

`20261130090000_scout_reference` (additive) : enum `ReferenceAmbiance`, tables `reference_categories`, `reference_entries`, index uniques (dont partiel « module entier »), CHECK ; élargissement du CHECK `stored_files_mime_allowed` aux 4 types audio. Appliquée sur `tesla_scout` et `tesla_scout_test` seulement. `prisma migrate diff` (base → schéma) : vide. Jamais en production.

## Tests exécutés (Node 22.23.4, 2026-11-25)

| Vérification | Résultat |
| --- | --- |
| `npm run lint` | réussi (tous les espaces) |
| `npm run typecheck` | réussi |
| `npm run test` | API 320/320 (dont `referentiel-scout.spec.ts`, signatures audio), web 194/194 (dont `reference.test.ts` 16, navigation et `robots.txt` mis à jour) |
| `npm run build` | réussi (API, web Next.js 16.4.6) |
| `npm run test:int -w @tesla/api` sur `tesla_scout_test` (`NODE_ENV=test`) | 215 réussis, 1 ignoré (classeur réel absent, préexistant) ; dont `reference.int-spec.ts` 4/4 (visibilité, recherche, leçon seule, permissions, audit, fichier audio du module, droits avant soumission) |
| `prisma validate`, `prisma migrate diff` (base → schéma) | valide, aucune dérive |
| `npm run format:check` | 3 fichiers signalés, **préexistants et non modifiés** (`module-publication.ts`, `editeur-pedagogique.browser.mjs`, `offline-auth.browser.mjs`) ; fichiers du chantier conformes |
| `npm run audit:prod` | **non exécuté** : registre npm injoignable depuis le poste (délai de connexion) ; aucune dépendance ajoutée |
| Recette navigateur `apps/web/test/referentiel.browser.mjs` (Chromium 1.64.1 hors dépôt, build de production, base `tesla_scout`, routier de démonstration) | **32/32** : rubriques non vides seules, 9 fiches, recherche, intervenants, indications, Mon rôle, préparation conservée, mode cérémonie (navigation, reprise), lecture intégrale, prière exacte, remise en ordre sans score, lecture audio, phrase active après déplacement, sélection d'une phrase, vitesse, pause, refrain, chant collectif, 320/360/430/768/1280 px sans défilement horizontal, préparation de l'appareil, référentiel, fiche et prière sans réseau, écoute hors ligne depuis la copie locale, aucune erreur JavaScript |

Données de recette (base `tesla_scout` seulement) : Cérémonial et Prière scoute publiés par le compte plein de démonstration ; module « Enregistrement de test (non officiel) » (tonalités synthétiques) et rubriques « Recette — enregistrements de test », « Rubrique vide de recette ». Le stockage objet n'étant pas configuré en développement, le fichier audio est servi par interception avec requêtes partielles (comme R2).

Non vérifié : téléphones réels Android et iOS (lecture écran verrouillé, Media Session, Wake Lock), R2 réel (CORS `GET`), fermeture complète du navigateur puis réouverture hors ligne (les navigations hors ligne testées repartent du service worker), revue lecteur d'écran, mesure mémoire.

## Points d'intégration avec le chantier immersif

1. **Banque d'entraînement et XP de lecture** : les modules publiés du référentiel sont, comme tout module, source d'activités dérivées et donnent `LECON_LUE` lus depuis la bibliothèque. Décider (D220) : exclure les modules rangés au référentiel (ou les ambiances Cérémonie/Prière) dans `practice.service.ts` ; le drapeau `noPractice` (D208) de l'autre chantier peut aussi marquer les citations des cérémonies. Le lecteur du référentiel n'émet aucun événement.
2. **Favoris et carnet** : aucun système parallèle créé. À l'intégration : favori = identifiant de rangement (`reference_entries.id`) ou slug de module ; bouton à placer dans l'en-tête du lecteur.
3. **Coffre** : effacer la base `tesla-referentiel-media` à la réinitialisation ou à la révocation du coffre (`resetVault`, `vaultEvicted`) ; adaptateur limité dans `lib/reference-media.ts`.
4. **Direction artistique** : composants sobres sur les jetons existants (bordeaux, rouge, or, sable) ; à aligner sur la direction artistique de l'autre chantier après fusion.
5. **`lesson-content.ts`** : les deux chantiers modifient le schéma des blocs (mon bloc `audio`, leur `noPractice`). Zones distinctes ; à vérifier : `isLessonDocumentEmpty`, `blockPlainText` (référence) et le rendu PDF doivent connaître les deux.

## Conflits prévisibles à la fusion

| Fichier | Nature | Résolution |
| --- | --- | --- |
| `schema.prisma` | ajouts en fin de fichier et relations de `User` | garder les deux blocs |
| migrations | `20261127090000_learner_notebook` (immersif) et `20261130090000_scout_reference` | indépendantes, ordre conservé ; régénérer le client |
| `lesson-content.ts`, `lesson-editor.tsx`, `index.ts`, `preparation.ts` | hunks distincts | fusion automatique probable, relire |
| `DECISIONS.md`, `CHANGELOG.md` | ajouts | garder les deux |
| `navigation.ts` | une entrée « Référentiel scout » + une de gestion | relire si l'autre chantier change la rubrique Cours |

## Stratégie de réconciliation (à exécuter seulement sur autorisation)

1. L'autre chantier commite sa branche `feat/tesla-immersive-excellence`.
2. Commits atomiques de ce chantier (Conventional Commits) sur `feat/tesla-scout-reference`.
3. Fusion de `feat/tesla-scout-reference` dans `feat/tesla-immersive-excellence` (ou les deux dans une branche d'intégration), résolution selon le tableau ci-dessus.
4. `npm ci`, `db:generate`, migrations sur une base `_test` neuve, `prisma migrate diff`, puis `lint`, `typecheck`, `test`, `build`, `test:int`, recettes navigateur des deux chantiers.
5. Traiter les points d'intégration 1 à 3.

## Décisions attendues

- Rubriques réservées au plein (proposition) ou ouvertes à l'encadrement.
- Exclusion des textes du référentiel de l'entraînement et de l'XP de lecture.
- Divergence p. 8 (apprentissage / compagnonnage) et formulations conservées du document.
- Publication des brouillons Cérémonial et Prière scoute (par le plein, dans l'application).
- CORS `GET` du compartiment R2 (lecture et téléchargement audio).

## Contenus attendus (jamais inventés)

Charte des routiers, Chant de la Promesse, L'Appel de la Route, La Légende du feu, autres chants, enregistrements audio et leurs droits.
