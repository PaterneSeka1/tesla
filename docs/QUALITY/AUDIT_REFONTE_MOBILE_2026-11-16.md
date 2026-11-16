# Audit et refonte mobile — navigation, modules et leçons (2026-11-16)

Branche `feat/refonte-mobile-lecons` (worktree `../tesla-refonte-mobile`, depuis `23b1331`), non poussée. Décision D182. Aucune migration, aucune route API ni permission modifiée, aucun déploiement.

## 1. Sécurisation (lot 0)

- `main`, `feat/refonte-ux-editeur-hors-ligne` et `feat/parcours-anterieur-progression` pointent sur `23b1331`. Le chantier D181 (parcours antérieur, « sans étape ») existe **uniquement en modifications non commitées** du répertoire principal : il n'a pas été touché.
- Refonte menée dans un worktree séparé, sur une base jetable `tesla_refonte_mobile_test`, avec API (4200) et web (3200) sur des ports distincts de ceux déjà occupés (3000, 4100).
- **Aucun fichier commun** avec les modifications D181 (vérifié par `git status` des deux arbres). Conflit attendu au rapprochement : ajouts en fin de `docs/DECISIONS.md`, en tête de `docs/IMPLEMENTATION_STATUS.md` et de `CHANGELOG.md` (texte seulement).

## 2. Diagnostic (lot 1)

Constats hiérarchisés, établis par lecture du code et rendu Chromium réel (320 → 1440 px).

| Priorité | Constat | Suite |
| --- | --- | --- |
| P1 | **Encadrement sans navigation mobile** : seul le routier avait une barre inférieure ; le chef passait par un menu hamburger pour toute action (routiers, cours). | Barre inférieure commune (lot 3). |
| P1 | **Barre routier à 5 onglets** (Accueil, Cours, Évaluations, Parcours, Profil) : Profil occupait un emplacement prioritaire ; deux systèmes de navigation concurrents sur mobile (barre + hamburger). | 3 destinations + « Plus », hamburger supprimé. |
| P1 | **Ajouter une leçon à un module publié** exigeait de comprendre « Nouvelle version » puis de trouver le champ d'ajout ; sur mobile, ce champ était caché dans le panneau repliable des leçons. | Action directe « Ajouter une leçon » (lots 6–7). |
| P2 | **Reprise de lecture perdue** après republication : une nouvelle version recrée les leçons (nouveaux identifiants) ; un ancien lien de leçon affichait l'erreur générique. | Repli par titre, message dédié (lot 8). |
| P2 | Sidebar desktop non repliable. | Repli à côté du logo, préférence par appareil. |
| P2 | Accès rapides de l'accueil sans entrée vers la gestion des cours pour le responsable ; zones tactiles à 40 px. | « Cours et leçons », 44 px. |
| P3 | En-tête mobile chargé (hamburger + logo + titre). | En-tête compact (logo + titre), zone sûre haute. |

**Déjà conforme, conservé tel quel** (aucune réécriture) :
- Modèle **module → plusieurs leçons** : `ModuleVersion` → `ModuleLesson` (position contiguë, révision optimiste), ajout / modification / réorganisation / suppression sur une version `BROUILLON` seulement (triggers), nouvelle version de travail copiant la version publiée (`createVersion`, `basedOnVersionId`), publication atomique par le plein. **Aucun modèle supplémentaire n'est nécessaire.**
- Éditeur : enregistrement automatique avec confirmation serveur, brouillon local, conflits explicites, réorganisation par boutons ↑/↓ et Alt + flèches, aperçu.
- Lecture : précédente / suivante, compteur, reprise (coffre chiffré), téléchargement hors ligne, « Mettre à jour » sur « Cet appareil » quand une version publiée plus récente existe (le contenu téléchargé n'est jamais effacé silencieusement).
- Progression : les études (`ModuleStudy`) et évaluations référencent le **module** (et la version étudiée), jamais une leçon. Ajouter, déplacer ou modifier une leçon ne change ni étude, ni résultat, ni acquis, ni étape, ni éligibilité aux évaluations ; aucun pourcentage d'avancement par leçon n'existe.

## 3. Choix de navigation (lots 2–3, D182)

| Profil (permissions effectives) | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| Parcours personnel (`progression.readOwn`) | Accueil | Cours (`/modules`) | Parcours (`/progression`) | Plus |
| Encadrement (`scout.read` + `module.write`) | Accueil | Routiers | Cours (`/encadrement/modules`) | Plus |
| Administrateur | Accueil | Routiers (fiches, D173) | Comptes | Plus |

- Une seule barre (`BottomNav`), construite par `bottomTabsFor` ; jamais de rôle affiché. Onglet actif = rubrique de la page (`activeBottomTab`), y compris liens profonds et sous-pages ; « Plus » actif sinon.
- « Plus » : feuille basse (dialogue accessible, Échap, piège de focus) listant toutes les autres pages autorisées par rubrique, sans doublon avec les onglets (`moreNavigationFor`), puis « Cet appareil », identité et déconnexion.
- Évaluations n'est pas un onglet : pour le routier, l'accès passe par l'accueil, le parcours et « Plus » ; pour l'encadrement, la saisie papier reste dans les accès rapides de l'accueil. Une 5e destination n'a pas été retenue (largeur à 320 px, usage non quotidien).
- Barre masquée : ordinateur (≥ 1024 px, sidebar), impression, passation d'évaluation (`/evaluations/:id/passer|jeu`, lien de retour explicite conservé), **pendant la saisie** (clavier virtuel), avec retour différé de 400 ms pour ne pas intercepter un appui sur « Enregistrer ».
- Pages publiques (accueil public, connexion, activation, mot de passe) : hors du cadre connecté, aucune navigation.
- Zones tactiles ≥ 48 × 56 px, `env(safe-area-inset-bottom)`, espace réservé sous le contenu.
- Sidebar : bouton de repli à côté du logo, mode icônes avec libellés accessibles, préférence conservée sur l'appareil (`localStorage`, sans donnée personnelle, lecture protégée).

## 4. Modules et leçons (lots 6–8)

- **Ajouter une leçon** : bouton visible en permanence sur mobile (à côté du sélecteur de leçon), focus direct sur le titre ; entrée « Ajouter une leçon » dans le menu de chaque module de la liste ; le module parent n'est jamais redemandé.
- **Module en ligne** : encart « Ce module est en ligne… » avec « Ajouter une leçon » : ouvre une version de travail (copie de la version publiée) puis le champ d'ajout. La version en ligne reste seule visible des routiers jusqu'à l'approbation et la publication par le plein. Aucune création implicite au chargement de la page.
- « Nouvelle version » renommé « Modifier le contenu » ; l'étape du module apparaît dans l'en-tête de l'éditeur.
- Lecture : reprise retrouvée par titre après republication (`resumeLesson`) ; ancien lien → « Cette leçon n'est plus disponible » et retour au module.

## 5. Vérifications (lot 10)

Exécutées le 2026-11-16 dans le worktree (Node 24, Chromium 1248, base jetable) :

| Vérification | Résultat |
| --- | --- |
| `eslint` web, `tsc --noEmit` web | réussis |
| Vitest web | **128** réussis (dont navigation 55, reprise de lecture 3) |
| `next build`, `nest build` | réussis |
| Recette `refonte-mobile.browser.mjs` (nouvelle) | **19/19** |
| Non-régression : éditeur 15/15, gestion des modules 13/13, catalogue 8/8, offline-first 25/25 (sans `SW_FILE`), mot de passe unique 17/17 | voir § état |

Scénario obligatoire couvert par la recette : module « Prières et textes de la Route » ; Prière scoute, Prière route, Charte des routiers ajoutées à 375 px ; contenu saisi au clavier (barre masquée) ; coupure réseau puis enregistrement ; réorganisation (Charte en 2e) ; aperçu ; 403 / 404 pour le routier (rédaction, brouillon par URL) ; publication refusée au chef ; soumission, approbation, publication par le plein ; lecture des trois leçons (précédente / suivante) ; ajout d'une 4e leçon au module en ligne : même identifiant de module, version de travail distincte, 4e leçon invisible du routier avant publication puis quatre leçons dans l'ordre, anciennes conservées ; rechargement.

Captures (non versionnées) : dossier `shots/` du scratchpad de session (accueil routier 390 px, menu « Plus », sidebar repliée, routiers 375 px, rédaction, lecture, ajout de la 4e leçon).

## 6. Non réalisé ou limité

- **Lot 5 (fiches routiers, création, parcours antérieur)** : non modifié, les fichiers sont en cours de modification par le chantier D181. À reprendre après sa fusion.
- Aucun contrôle API n'a été modifié : les contrôles serveur existants ont été vérifiés par la recette (403, 404), pas réaudités ligne à ligne.
- Glisser-déposer des leçons non ajouté (boutons ↑/↓ et Alt + flèches existants, accessibles).
- La reprise de lecture suppose un appareil préparé hors ligne (coffre chiffré, D180) : la reprise par titre est testée en unitaire, pas en navigateur.
- Safari iOS, clavier virtuel réel et orientation paysage non testés (Chromium émulé seulement) ; contraste WCAG non mesuré par outil.
- Captures « avant » non produites (seulement « après »).
- Balayage `ui-sweep.browser.mjs` (343 affichages) non rejoué.
