# Audit et refonte mobile — navigation, modules et leçons (2026-11-16)

Branche `feat/refonte-mobile-lecons` (worktree `../tesla-refonte-mobile`), non poussée. Décision D182. Aucune migration, aucune route API ni permission modifiée par la refonte, aucun déploiement.

## 1. Sécurisation et réconciliation (lot 0)

- Au départ, `main`, `feat/refonte-ux-editeur-hors-ligne` et `feat/parcours-anterieur-progression` pointaient sur `23b1331` ; le chantier D181 (parcours antérieur, « sans étape ») n'existait qu'en modifications non commitées du répertoire principal. Il n'a jamais été modifié.
- Refonte menée dans un worktree séparé, sur une base jetable `tesla_refonte_mobile_test`, avec API (4200) et web (3200) sur des ports libres.
- Réconciliation : une fois D181 stabilisé, ses modifications ont été importées dans le worktree (patch du répertoire principal, sauvegardes conservées), puis D182 réappliqué par fusion à trois voies. Seuls `CHANGELOG.md`, `docs/DECISIONS.md` et `docs/IMPLEMENTATION_STATUS.md` étaient en conflit (texte) : les deux contenus sont conservés (D181 puis D182).
- L'état combiné a ensuite été commité hors de cette session (`15131d2`). `main` a reçu D181 séparément (`774ff0c`). Les deux arbres ne diffèrent que par les fichiers D182 : le contenu D181 est identique.

## 2. Diagnostic (lot 1)

Constats hiérarchisés, établis par lecture du code et rendu réel (Chromium et WebKit, 320 → 1440 px).

| Priorité | Constat | Suite |
| --- | --- | --- |
| P1 | **Encadrement sans navigation mobile** : seul le routier avait une barre inférieure ; le chef passait par un menu hamburger pour toute action. | Barre inférieure commune (lot 3). |
| P1 | **Barre routier à 5 onglets** (dont Profil) et deux systèmes de navigation concurrents sur mobile (barre + hamburger). | 3 destinations + « Plus », hamburger supprimé. |
| P1 | **Ajouter une leçon à un module publié** exigeait de comprendre « Nouvelle version » ; sur mobile, le champ d'ajout était caché dans le panneau repliable des leçons. | Action directe « Ajouter une leçon » (lots 6–7). |
| P1 | **Liste des routiers sur téléphone** : cinq filtres empilés avant le premier routier ; équipe et étape (dont « À régulariser ») masquées ; seule la zone du nom était cliquable. | Filtres repliables, lignes tactiles (lot 5). |
| P2 | **Reprise de lecture perdue** après republication (nouveaux identifiants de leçons) ; ancien lien de leçon = erreur générique. | Repli par titre, message dédié (lot 8). |
| P2 | Fiche routier : trois actions empilées, informations sur une colonne. | Actions compactes, deux colonnes. |
| P2 | Module en ligne : message doublé ; note technique de création (« D'après la version 1 ») présentée comme une décision du responsable. | Encart court, note filtrée. |
| P2 | Sidebar desktop non repliable. | Repli à côté du logo. |
| P3 | Accueil : pas d'accès à la gestion des cours pour le responsable ; zones tactiles à 40 px ; en-tête mobile chargé. | « Cours et leçons », 44 px, en-tête compact. |

**Déjà conforme, conservé** (aucune réécriture) :
- Modèle **module → plusieurs leçons** : `ModuleVersion` → `ModuleLesson` (position contiguë, révision optimiste) ; ajout, modification, réorganisation et suppression sur une version `BROUILLON` seulement (triggers) ; nouvelle version de travail copiant la version publiée (`createVersion`) ; publication atomique par le plein. **Aucun modèle supplémentaire n'est nécessaire.**
- Éditeur : enregistrement automatique avec confirmation serveur, brouillon local, conflits explicites, réorganisation par boutons ↑/↓ et Alt + flèches, aperçu.
- Lecture : précédente / suivante, reprise (coffre chiffré), téléchargement hors ligne, « Mettre à jour » quand une version publiée plus récente existe (le contenu téléchargé n'est jamais effacé silencieusement).
- Formulaire de création d'un routier (D181) : champs essentiels, étape calculée, déjà simple.
- Progression : études (`ModuleStudy`) et évaluations rattachées au **module**, jamais à une leçon. Ajouter, déplacer ou modifier une leçon ne change ni étude, ni résultat, ni acquis, ni étape, ni éligibilité ; aucun pourcentage d'avancement par leçon n'existe.

## 3. Navigation (lots 2–3, D182)

| Profil (permissions effectives) | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Parcours personnel (`progression.readOwn`) | Accueil | Cours (`/modules`) | Parcours (`/progression`) | Plus |
| Encadrement (`scout.read` + `module.write`) | Accueil | Routiers | Cours (`/encadrement/modules`) | Plus |
| Administrateur | Accueil | Routiers (fiches, D173) | Comptes | Plus |

- Une seule barre (`BottomNav`, `bottomTabsFor`), jamais de rôle affiché ; onglet actif = rubrique de la page (`activeBottomTab`), liens profonds et sous-pages compris ; « Plus » actif sinon.
- « Plus » : feuille basse (dialogue, Échap, piège de focus), toutes les autres pages autorisées par rubrique sans doublon (`moreNavigationFor`), appareil, identité, déconnexion.
- Évaluations n'est pas un onglet (largeur à 320 px, usage non quotidien) : accès par l'accueil, le parcours et « Plus ». **À confirmer à l'usage.**
- Barre masquée : ordinateur (≥ 1024 px), impression, passation d'évaluation (lien de retour conservé), pendant la saisie (clavier virtuel), avec retour différé de 400 ms pour ne pas intercepter l'appui sur « Enregistrer » (régression détectée par la recette du mot de passe, corrigée).
- Pages publiques : aucune navigation. Zones tactiles ≥ 48 px ; `env(safe-area-inset-bottom)` ; espace réservé sous le contenu.
- Sidebar repliable (bouton à côté du logo, icônes libellées, préférence par appareil).

## 4. Modules, leçons, lecture et routiers (lots 4–8)

- **Ajouter une leçon** : bouton visible en permanence sur mobile, focus direct sur le titre (après rendu, tous moteurs) ; entrée dans le menu de chaque module de la liste ; module parent jamais redemandé.
- **Module en ligne** : « Ajouter une leçon » ouvre explicitement une version de travail puis le champ d'ajout ; la version en ligne reste seule visible des routiers jusqu'à l'approbation et la publication par le plein. « Nouvelle version » devient « Modifier le contenu » ; l'étape figure dans l'en-tête.
- **Lecture** : reprise retrouvée par titre (`resumeLesson`) ; ancien lien → « Cette leçon n'est plus disponible » et retour au module.
- **Routiers** : sur téléphone, recherche + « Filtres (n) » repliable, une ligne tactile par routier (étape ou « À régulariser », équipe, matricule, statut) ; tableau conservé dès 768 px. Fiche : informations sur deux colonnes, actions compactes.
- **Accueils** : déjà alignés sur les priorités (étape, reprise, cours ; tâches de l'encadrement) ; ajout de « Cours et leçons ».
- **Hors ligne (lot 9)** : vérifié sans modification fonctionnelle ; `offline-first` 28/28, y compris la mise à jour du service worker.

## 5. Vérifications (lot 10)

Exécutées le 2026-11-16 sur l'état combiné D181 + D182 (Node 24, base jetable, `NODE_ENV=test` pour l'intégration) :

| Vérification | Résultat |
| --- | --- |
| `npm run lint`, `npm run typecheck` | réussis |
| `npm run test` | API **297**, web **128** réussis |
| Intégration PostgreSQL | **188** réussis, 1 ignoré (classeur réel absent) |
| `nest build`, `next build` | réussis |
| `npm run format:check` | 3 avertissements sur des fichiers **non modifiés**, déjà présents à `23b1331` (`lesson-content.ts`, deux recettes) |
| Recette `refonte-mobile` (nouvelle) | **20/20** Chromium ; **20/20** WebKit (image Playwright 1.64.1, trois passages) |
| Recette `accessibilite` (nouvelle, axe-core 4.13, WCAG 2.0–2.2 A/AA) | **33 écrans**, aucune violation |
| `ui-sweep` (4 profils × 7 largeurs) | **378–385 affichages**, aucun problème |
| Non-régression | éditeur 15/15, gestion des modules 13/13, catalogue 8/8, offline-first 28/28, mot de passe unique 17/17, papier 7/7, parcours antérieur 15/15, rattrapages 4/4, exception de progression 8/8, profil 10/10, référentiel d'âge 7/7, comptes 11/11 |

Scénario obligatoire couvert : module « Prières et textes de la Route » ; Prière scoute, Prière route, Charte des routiers ajoutées à 375 px ; saisie au clavier (barre masquée) ; coupure réseau puis enregistrement ; réorganisation ; aperçu ; 403 / 404 pour le routier (rédaction, brouillon par URL) ; publication refusée au chef ; soumission, approbation, publication par le plein ; lecture des trois leçons ; 4e leçon ajoutée au module en ligne : même module, version de travail distincte, invisible du routier avant publication, puis quatre leçons dans l'ordre, anciennes conservées ; rechargement.

**Recettes mises à jour** (règles en vigueur, sans changement de code applicatif) :
- `offline-first` : menu « Plus » au lieu du menu hamburger.
- `referentiel-age` : obsolète depuis D176 (référentiel réservé au plein) et D177 (champ « Délai par étape… » capté par le sélecteur « Étape ») ; l'assistant est désormais vérifié sans accès (403).
- `profil-progression` : depuis D181, une correction rendant l'étape indéterminable est refusée (422) ; la recette attendait l'ancien enregistrement « étape non déterminée ».

**Non exécuté** : `programme-import` (exige le classeur réel, hors dépôt et jamais versionné).

## 6. Captures avant / après

`docs/QUALITY/refonte-mobile-2026-11-16/` : mêmes écrans sur `23b1331` (avant) et la branche (après), données fictives — accueil, cours et module (routier, 390 px), accueil, routiers, module en ligne et menu (chef, 390 px), module en ligne (1280 px).

## 7. Limites et suites

- Glisser-déposer des leçons non ajouté : facultatif dans la demande ; les boutons ↑/↓ et Alt + flèches couvrent le besoin de façon accessible.
- WebKit testé en conteneur (moteur de Safari), pas sur un iPhone réel : clavier virtuel iOS, zones sûres réelles et orientation paysage restent à vérifier sur appareil.
- La reprise de lecture suppose un appareil préparé hors ligne (coffre chiffré, D180) : reprise par titre testée en unitaire.
- WebKit signale les requêtes annulées par une navigation (« access control checks ») et le repli `Response.error()` du service worker comme erreurs de page ; la recette les distingue (aucun effet fonctionnel constaté).
- Contrôle d'accessibilité automatique : ne remplace pas une revue au lecteur d'écran.

## 8. Avant déploiement

1. Fusionner `feat/refonte-mobile-lecons` dans `main` (le contenu D181 est identique ; seuls les fichiers D182 diffèrent).
2. Appliquer la migration D181 `20261119090000_prior_stage_recognitions` (aucune migration D182) après sauvegarde.
3. Recette sur iPhone et Android réels : barre inférieure, clavier dans l'éditeur, feuille « Plus ».
4. Valider l'absence d'onglet Évaluations pour le routier.
