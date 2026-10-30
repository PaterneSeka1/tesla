# Catalogue pédagogique initial — formation à la Route

Dernière mise à jour : 2026-10-30 (branche `feat/bibliotheque-route`). Proposition pédagogique de départ pour la Communauté Nikola Tesla : **aucun module n'est obligatoire, aucun n'est publié**. Le catalogue n'est pas une limite : le responsable crée et complète librement d'autres modules (§ 5).

## 1. Sources

| Source | Fichier (`docs/sources/`) | SHA-256 | Usage |
| --- | --- | --- | --- |
| Manuel « SAPF-Route » — atelier pédagogique Branche Route, Région d'Abidjan, communauté Mahatma Gandhi | `SAPF-Route (2).pdf` (11 pages) | `d9b0b69d…8244f6` | Modules 03 à 12. Pages citées = **numéros imprimés** (page PDF = numéro imprimé + 1). |
| « BASE DU SCOUTISME » — paroisse Notre-Dame du Perpétuel Secours de Treichville | `BASE DU SCOUTISME.pdf` (6 pages) | `cc40c92e…29b8d9` | Modules 01 et 02 (import antérieur) ; citations de la loi scoute dans 03 à 08. |
| Prière de la Route | Texte transmis par le responsable (mission du 2026-10-30) | empreinte du texte original | Texte fondamental `NT-TXT-PRIERE-ROUTE`. |
| Charte de la Route | **Non fournie** | — | Aucun contenu créé (§ 4). |

Le manuel est une **référence pédagogique régionale**, pas un règlement national homologué : aucun module ne déclare de source officielle (`officialSource` nul), donc aucun ne peut être marqué obligatoire (contrainte D99).

## 2. Modules

Importés en `BROUILLON` (version 1, auteur « Import système »), catégorie « Parcours d'étape », étape **recommandée** (jamais une condition d'accès ni de progression), obligation « non précisée ». **Mise en service** (§ 7) : publiés avec un questionnaire d'entraînement chacun, au nom du responsable.

| N° | Module | Code source | Étape recommandée | Leçons | Origine |
| --- | --- | --- | --- | --- | --- |
| 01 | Découvrir le scoutisme | `NT-SCOUT-M01` | Noviciat | 5 | **Réutilisé** (import du 2026-10-29) |
| 02 | Loi, principes et vertus | `NT-SCOUT-M02` | Noviciat | 4 (1 vide) | **Réutilisé** |
| 03 | Découverte de la branche Route | `NT-ROUTE-M03` | Noviciat | 6 | Nouveau ; cite la Prière de la Route |
| 04 | Comprendre sa progression à la Route | `NT-ROUTE-M04` | Noviciat | 8 | Nouveau |
| 05 | Vie en équipe et responsabilités | `NT-ROUTE-M05` | Apprentissage | 6 | Nouveau |
| 06 | Engagement routier et cérémonies | `NT-ROUTE-M06` | Apprentissage | 6 | Nouveau |
| 07 | Mini-Camp et vie communautaire | `NT-ROUTE-M07` | Apprentissage | 7 | Nouveau |
| 08 | Le Raid routier | `NT-ROUTE-M08` | Compagnonnage | 7 | Nouveau |
| 09 | L'Entreprise routière | `NT-ROUTE-M09` | Compagnonnage | 8 | Nouveau |
| 10 | Domaines d'action de l'Entreprise | `NT-ROUTE-M10` | Compagnonnage | 10 | Nouveau |
| 11 | Service et engagement personnel | `NT-ROUTE-M11` | Départ routier | 6 | Nouveau |
| 12 | Préparation au Départ routier | `NT-ROUTE-M12` | Départ routier | 6 | Nouveau |
| — | Prière de la Route (texte fondamental) | `NT-TXT-PRIERE-ROUTE` | — | 1 | Nouveau |

Total créé par ce seed : 11 brouillons, 71 leçons, aucune vide. Fichier : `apps/api/prisma/seeds/route-bibliotheque.seed.ts`.

### Contenu de chaque module
Titre, code, description, étape recommandée, 3 ou 4 objectifs, leçons ordonnées rédigées d'après les sources (citations entre guillemets, référence « Source : … p. X » en fin de leçon), activité « Pour réfléchir » quand elle est utile, conclusion « Pour conclure » dans la dernière leçon. Les notes éditoriales (visibles des rédacteurs seulement) listent les points à vérifier et à compléter.

**Ajouts éditoriaux** (à valider, signalés dans les notes) : rubriques « Pour réfléchir » et « Pour conclure », titres intermédiaires, reformulations de liaison, et **exemples de projets** du module 10, explicitement présentés comme « proposition éditoriale ».

### Écarts avec la liste de leçons demandée
- **Module 01** : `NT-SCOUT-M01` couvre définition, objectifs, Baden-Powell, emblème et OMMS, grandes dates (dont 1937, arrivée en Côte d'Ivoire). La méthode scoute et ses huit éléments sont dans `NT-SCOUT-M03` (Apprentissage). Le responsable peut y ajouter une leçon depuis l'éditeur.
- **Module 02** : la leçon « La promesse scoute » n'est pas créée (texte validé absent) ; « Vivre les valeurs scoutes au quotidien » correspond à la leçon vide « Comprendre et appliquer la loi dans la vie quotidienne », à rédiger.
- **Module 03** : pas de leçon « Charte de la Route » (texte absent : aucune leçon vide ni faux contenu).
- **Doublons potentiels** : les brouillons **vides** du catalogue « Découvrir la Route » (`NT-DEC-B06`, `B08`, `B10`, `B11`, `C15`, `D16` à `D22`, `D24`) couvrent des sujets désormais rédigés dans 03 à 12. Ils ont été **supprimés** à la mise en service (§ 7) et retirés du seed ; les notes « rapprochement » des nouveaux modules sont donc caduques.

## 3. Contenus à produire ou à valider

| Module | À compléter (absent des sources) | À vérifier |
| --- | --- | --- |
| 03 | Leçon sur la Charte (après publication de la Charte) | Publier la Prière avant ou avec le module |
| 04 | — | Sens des colonnes 18/19/20 ans du tableau synoptique ; leçon « rattrapage » fondée sur les règles de la communauté, pas sur le manuel ; couleur du flot de compagnonnage (p. 5) |
| 05 | Organisation concrète des équipes de la communauté ; définition du leadership partagé | — |
| 06 | Déroulement et formule de la cérémonie d'engagement ; signification de chaque flot et étoile | — |
| 07 | Règles de sécurité, d'hygiène et d'intendance | Relecture du Mini-Camp (déduite de l'exigence générale) |
| 08 | Règles de sécurité du Raid | — |
| 09 | Mobilisation des ressources, outils de planification | — |
| 10 | Critères de choix et attribution du « label de domaine d'action » | Exemples de projets ; noms des programmes OMMS |
| 11 | Forme du projet personnel de service | — |
| 12 | Préparation spirituelle ; rôle du parrain, sens de la boussole et de la bougie | Distinction Départ routier / sortie à 21 ans |
| Prière | — | Version rédactionnelle proposée (original conservé dans la provenance) |
| Tous | Questionnaire d'entraînement (aucun créé) | Étape recommandée, objectifs |

## 4. Textes fondamentaux

Un texte fondamental est un **module de catégorie « Texte fondamental »** : il bénéficie du workflow existant (brouillon, soumission, approbation et publication par le responsable, versions et historique conservés, impression, téléchargement hors ligne). Les autres modules le **citent** (table `module_text_links`, liens par version) : le texte n'existe qu'une fois. La bibliothèque n'affiche un texte cité qu'une fois publié, et la rubrique « Textes fondamentaux » est le filtre de catégorie de la bibliothèque.

- **Prière de la Route** : version rédactionnelle proposée en leçon unique ; texte original transmis conservé tel quel dans la provenance (note « Information ») et dans l'empreinte de la source. À valider avant publication.
- **Charte de la Route** : rien n'est créé. Elle s'ajoutera depuis l'administration (§ 5.4) sans modification du code.
- **Loi scoute** : déjà rédigée dans `NT-SCOUT-M02` ; non dupliquée en texte fondamental. Si le responsable le souhaite, il peut créer un texte « Loi scoute » et le citer.
- **Promesse scoute** : en attente d'une source validée.

## 5. Procédures (sans intervention technique)

Écrans : « Mes modules » (`/encadrement/modules`), éditeur (`/encadrement/modules/<id>/modifier`), « Modules à valider » et « Tous les modules » (administration).

### 5.1 Ajouter un module
« Nouveau module » → titre, description, étape recommandée, catégorie, objectifs → le module est créé en brouillon. Pour partir d'un module existant : bouton **Dupliquer** dans l'éditeur (nouveau brouillon, l'original est inchangé ; l'obligation n'est pas reprise).

### 5.2 Ajouter ou réorganiser une leçon
Dans l'éditeur, carte « Leçons » : « Ajouter une leçon », rédiger (titres, listes, citations, liens, images https), enregistrer ; flèches pour réordonner. Une leçon vide bloque la soumission.

### 5.3 Modifier un texte fondamental
Ouvrir le texte dans l'éditeur. Publié : « Nouvelle version » (la version en ligne reste visible), modifier, soumettre ; le responsable approuve et publie. L'historique conserve chaque version et chaque décision.

### 5.4 Ajouter la Charte
1. « Nouveau module », titre « Charte de la Route », catégorie **Texte fondamental**, sans étape.
2. Une leçon par section de la Charte, en recopiant le texte source **sans le modifier** ; les commentaires pédagogiques vont dans une leçon distincte ou sous un titre « Commentaire », jamais mêlés au texte (convention éditoriale).
3. Indiquer la référence du document (édition, date) dans « Source officielle » si elle est homologuée.
4. Soumettre, approuver, publier.
5. Dans le module 03 : « Nouvelle version », carte « Textes fondamentaux cités » → citer la Charte ; ajouter si souhaité une leçon de découverte ; soumettre et publier.

Limite : le dépôt du PDF original, l'extraction automatique du texte et sa prévisualisation ne sont **pas développés** (aucun stockage de fichiers, D51). Le PDF original peut être référencé comme ressource (lien https) et versé dans `docs/sources/`.

### 5.5 Créer un questionnaire
« Évaluations » → nouveau questionnaire rattaché au module publié ; workflow d'approbation des évaluations (corrigé jamais transmis au routier).

### 5.6 Soumettre, publier
Soumettre (rédacteur) → approuver puis publier (responsable plein ou délégation). Un refus ou une demande de correction est motivé.

### 5.7 Mettre à jour un module déjà utilisé
« Nouvelle version » : la version publiée reste en ligne jusqu'à la publication de la suivante. Les études déclarées, résultats et tentatives restent attachés à la version utilisée ; un routier ayant téléchargé le module se voit proposer la mise à jour.

## 6. Réimporter le catalogue
`npm run db:seed:pedagogy -- --dry-run` (prévisualisation), puis `npm run db:seed:pedagogy`. Réexécution sans écriture ; écarts entre la source et l'import signalés, jamais appliqués (voir [SEEDS_PEDAGOGIQUES.md](SEEDS_PEDAGOGIQUES.md)).

## 7. Mise en service (2026-10-30, D129–D131)

À la demande du responsable : « si c'est vide, retirer complètement ; sinon, prêt à être utilisé ».

```bash
npm run pedagogy:release -- --dry-run              # prévisualisation, aucune écriture
npm run pedagogy:release                           # au nom du responsable plein en exercice
npm run pedagogy:release -- --acteur <e-mail>      # au nom d'un autre compte habilité (délégation)
```

| Situation d'un module importé | Effet |
| --- | --- |
| Brouillon vide (les 21 « Découvrir la Route ») | Supprimé définitivement ; suppression journalisée |
| Brouillon avec contenu (NT-SCOUT-M01 à M04, Prière, NT-ROUTE-M03 à M12) | Leçons vides retirées (M02 : 1, M03 : 6, M04 : 1), puis soumis, approuvé et publié |
| Déjà publié | Inchangé |
| Nouvelle version en cours de rédaction, ou corrections demandées | Ignoré (laissé à l'encadrement) |

Questionnaires : un par module publié (14 ; aucun pour la Prière, texte sans étape), 4 à 7 questions objectives tirées du module, correction automatique, rattachés à l'étape recommandée du module ; créés, approuvés et publiés au nom du responsable. Ce sont des **entraînements** : aucun résultat ne change l'étape officielle ni ne valide un acquis. Définitions : `apps/api/prisma/seeds/route-questionnaires.ts`.

Conséquence : les points « À vérifier » et « À compléter » du § 3 (coquilles de « Base du scoutisme », version rédactionnelle de la Prière, exemples de projets…) sont désormais **publiés en l'état** ; ils se corrigent par « Nouvelle version » dans l'éditeur.

Chaque module publié se télécharge en PDF (« Télécharger le cours (PDF) ») : page de garde au logo et au nom de la communauté, sommaire, une leçon par page, en-tête et pied de page sur chaque page.
