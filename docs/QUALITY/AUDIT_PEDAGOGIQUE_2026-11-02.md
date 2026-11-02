# Audit pédagogique et finalisation du catalogue — 2026-11-02

Rapport produit par `npm run pedagogy:audit` (lecture seule) sur la base de développement `tesla`, avant et après la finalisation des contenus. Aucune donnée réelle de routier n'est utilisée. Sources : `docs/sources/BASE DU SCOUTISME.pdf`, `docs/sources/SAPF-Route (2).pdf`, rapport de validation précédent ; décisions D152–D157.

## 1. Indicateurs

| Indicateur | Avant | Après |
| --- | --- | --- |
| Modules totaux (base `tesla`) | 36 | 36 |
| Modules publiés | 0 | **0** — publication en attente du responsable plein (§ 4) |
| Brouillons | 36 | 36 (15 prêts pour validation, 21 brouillons vides à retirer) |
| Modules archivés | 0 | 0 |
| Leçons vides | 29 (8 dans le catalogue, 21 dans les brouillons « Découvrir la Route ») | **0 dans le catalogue publiable** ; 21 dans les brouillons vides, supprimés à la mise en service (D129) |
| Modules d'apprentissage sans questionnaire en base | 14 sur 14 | 14 sur 14 en base ; **14 questionnaires prêts** (définitions vérifiées), publiés avec le module par la mise en service |
| Notes « à vérifier / à compléter » en attente | 56 | 22 (aucune bloquante pour le contenu : décisions du responsable, § 3) |
| Questions disponibles | 0 en base ; 77 définies (4 à 7 par module, sans explication) | 0 en base avant mise en service ; **139 préparées** (8 à 11 par module, leçon de référence, niveau et explication dans le corrigé) |
| Modules à validation humaine (classe E) | 5 | **15** |
| Modules destinés aux routiers avec anomalie bloquante | 5 | **0** (`pedagogy:audit` : code de sortie 0) |

Vérification de bout en bout sur la base de test `tesla_test` (données fictives, responsable fictif) : mise en service complète, **16 modules publiés** (15 du catalogue + 1 module fictif de recette), **140 questions publiées**, aucune leçon vide ; le seul module signalé est le module fictif de la recette hors ligne (sans objectif ni catégorie), ce qui confirme que l'audit détecte une publication incomplète.

## 2. Matrice des 36 modules

Classes : A à compléter · B à consolider · C à fusionner (brouillon vide couvert ailleurs) · D à archiver · E prêt pour validation · F publiable ou publié. Leçons : total (dont vides). Catégorie et étape : après finalisation (avant : `NT-SCOUT-M01` à `M04` « à classer », « La méthode scoute » recommandée en Apprentissage).

| Code | Code source | Titre | Catégorie | Étape recommandée | Leçons avant | Leçons après | Questions | Notes en attente | Classe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOD-001 | NT-SCOUT-M01 | Découvrir le scoutisme | ETAPE | Noviciat | 5 (0) | 5 (0) | 11 | 1 | B → **E** |
| MOD-002 | NT-SCOUT-M02 | Loi, principes et vertus | ETAPE | Noviciat | 4 (1) | 4 (0) | 11 | 0 | A → **E** |
| MOD-003 | NT-SCOUT-M03 | La méthode scoute | ETAPE | Noviciat | 7 (6) | 7 (0) | 10 | 0 | A → **E** |
| MOD-004 | NT-SCOUT-M04 | Initiation au Morse | COMPLEMENTAIRE | Apprentissage | 5 (1) | 5 (0) | 11 | 0 | A → **E** |
| MOD-005 | NT-DEC-A04 | Symboles et identité scoute | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-006 | NT-DEC-A05 | Organisation du scoutisme en Côte d’Ivoire | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-007 | NT-DEC-B06 | Présentation de la branche Route | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | C → **C** |
| MOD-008 | NT-DEC-B07 | Identité et spiritualité du Routier | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-009 | NT-DEC-B08 | Vie communautaire et fraternité | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-010 | NT-DEC-B09 | Organisation d’une communauté Route | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-011 | NT-DEC-B10 | Fonctionnement des équipes | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-012 | NT-DEC-B11 | Responsabilités et esprit de service | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-013 | NT-DEC-C12 | Présentation de la communauté Nikola Tesla | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-014 | NT-DEC-C13 | Organisation et responsables de la communauté | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-015 | NT-DEC-C14 | Fonctionnement des activités et formations | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-016 | NT-DEC-C15 | Vie en équipe et participation communautaire | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-017 | NT-DEC-D16 | Présentation des étapes de progression Route | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-018 | NT-DEC-D17 | Comprendre le Noviciat | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-019 | NT-DEC-D18 | Comprendre l’Apprentissage | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-020 | NT-DEC-D19 | Comprendre le Compagnonnage | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-021 | NT-DEC-D20 | Présentation des flots | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-022 | NT-DEC-D21 | Présentation des cérémonies et engagements | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-023 | NT-DEC-D22 | Comprendre le Départ routier | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | C → **C** |
| MOD-024 | NT-DEC-D23 | Fonctionnement des évaluations pédagogiques | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-025 | NT-DEC-D24 | Comprendre le rattrapage des modules | TRANSVERSAL | — | 1 (1) | 1 (1) | — | 0 | D → **D** |
| MOD-026 | NT-TXT-PRIERE-ROUTE | Prière de la Route | TEXTE_FONDAMENTAL | — | 1 (0) | 1 (0) | — | 1 | E → **E** |
| MOD-027 | NT-ROUTE-M03 | Découverte de la branche Route | ETAPE | Noviciat | 6 (0) | 6 (0) | 10 | 2 | E → **E** |
| MOD-028 | NT-ROUTE-M04 | Comprendre sa progression à la Route | ETAPE | Noviciat | 8 (0) | 8 (0) | 11 | 3 | E → **E** |
| MOD-029 | NT-ROUTE-M05 | Vie en équipe et responsabilités | ETAPE | Apprentissage | 6 (0) | 6 (0) | 9 | 2 | E → **E** |
| MOD-030 | NT-ROUTE-M06 | Engagement routier et cérémonies | ETAPE | Apprentissage | 6 (0) | 7 (0) | 11 | 2 | B → **E** |
| MOD-031 | NT-ROUTE-M07 | Mini-Camp et vie communautaire | ETAPE | Apprentissage | 7 (0) | 7 (0) | 9 | 2 | B → **E** |
| MOD-032 | NT-ROUTE-M08 | Le Raid routier | ETAPE | Compagnonnage | 7 (0) | 7 (0) | 9 | 1 | B → **E** |
| MOD-033 | NT-ROUTE-M09 | L’Entreprise routière | ETAPE | Compagnonnage | 8 (0) | 8 (0) | 10 | 2 | B → **E** |
| MOD-034 | NT-ROUTE-M10 | Domaines d’action de l’Entreprise | ETAPE | Compagnonnage | 10 (0) | 10 (0) | 10 | 3 | E → **E** |
| MOD-035 | NT-ROUTE-M11 | Service et engagement personnel | ETAPE | Départ routier | 6 (0) | 6 (0) | 8 | 1 | B → **E** |
| MOD-036 | NT-ROUTE-M12 | Préparation au Départ routier | ETAPE | Départ routier | 6 (0) | 6 (0) | 9 | 2 | B → **E** |

Les 21 brouillons `NT-DEC-*` (une leçon « À rédiger » vide chacun, sans auteur humain, sans questionnaire ni résultat) ne sont pas complétés : leurs sujets sont couverts par les modules rédigés (`NT-ROUTE-M03` à `M12`, `NT-SCOUT-M01` à `M03`) ou n'ont aucune source (C12 à C14 : communauté Nikola Tesla ; A05 : organisation nationale ; D23 : fonctionnement de la plateforme). Ils restent invisibles des routiers et sont supprimés, avec trace au journal, par `pedagogy:release` (décision du responsable D129).

## 3. Validations humaines restantes

Ces points ne bloquent pas le contenu ; ils demandent une décision du responsable, déclarée à l'approbation (case « points traités ») ou par `--notes-verifiees`.

| Module | Passage | Action demandée |
| --- | --- | --- |
| Découvrir le scoutisme | Leçon 5, entrée 1937 | Confirmer l'orthographe du prêtre : « Paul Rey » (document de la paroisse) ou « Paul Ray » (Vatican News, juillet 2022). Date et paroisse confirmées. |
| Prière de la Route | Texte intégral | Valider la version rédactionnelle (original conservé en provenance). |
| Découverte de la branche Route | Module ; leçon 6 | Charte non fournie (aucune leçon inventée) ; publier la Prière avec ce module. |
| Comprendre sa progression | Leçons 1, 6, 8 | Sens des colonnes 18/19/20 ans du tableau synoptique ; couleur du flot de compagnonnage ; relire la leçon « rattrapage » (règles de la communauté). |
| Vie en équipe et responsabilités | Leçons 1, 5 | Organisation des équipes de la communauté ; définition du leadership partagé (absente du manuel). |
| Engagement routier et cérémonies | Leçons 5, 7 | Déroulement et formule d'engagement ; sens de chaque flot et étoile (non inventés). |
| Mini-Camp | Leçons 5, 7 | Règles de sécurité, d'hygiène et d'intendance de la communauté ; relecture du Mini-Camp. |
| Le Raid routier | Leçon 6 | Règles de sécurité du Raid (encadrement, autorisations, matériel). |
| L'Entreprise routière | Leçons 4, 5 | Outils de planification ; budget et financement (aucune source fiable). |
| Domaines d'action | Module | Valider les exemples de projets (signalés « proposition éditoriale ») ; confirmer les programmes OMMS cités par le manuel avant de les présenter comme actifs ; critères du label. |
| Service et engagement personnel | Leçon 4 | Forme du projet personnel de service (jamais présenté comme obligatoire). |
| Préparation au Départ routier | Leçons 4, 5 | Contenu de la préparation spirituelle ; rôle du parrain, sens de la boussole et de la bougie. |

## 4. Publication : ce qui reste à faire

La base `tesla` ne compte **aucun responsable plein en fonction** (`leadership_assignments` vide). L'agent n'a ni désigné de responsable ni produit d'approbation à son nom. Procédure :

1. L'administrateur désigne le responsable plein (« Encadrement »).
2. Le responsable relit les modules (« Modules à valider ») et les points du § 3.
3. `npm run pedagogy:audit` — doit répondre « 0 anomalie bloquante ».
4. `npm run pedagogy:release -- --dry-run`, puis `npm run pedagogy:release -- --notes-verifiees` : brouillons vides supprimés, 15 modules soumis, approuvés et publiés, 14 questionnaires publiés, au nom du responsable.
5. `npm run pedagogy:audit` : tous les modules du catalogue en classe F.

Production : ne rien appliquer sans sauvegarde, prévisualisation (`db:seed:pedagogy -- --dry-run --mettre-a-jour`, `pedagogy:release -- --dry-run`) et validation explicite.
