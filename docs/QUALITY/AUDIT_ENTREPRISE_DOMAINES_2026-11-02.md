# Audit final — Entreprise routière, domaines d'action et préparation à la publication (2026-11-02)

Branche `feat/finalisation-entreprise-domaines` (depuis `main` f11240a). Décisions D158–D160. Base de développement `tesla` (sauvegarde `pg_dump` préalable) ; tests sur `tesla_test` uniquement, comptes fictifs. Aucune donnée réelle de routier.

Sources : `docs/sources/` — manuel SAPF-Route, Guide de l'Entreprise Nikola Tesla 2026–2027, fiche technique n° 7 « Méthodologie Entreprise », Ossature de rédaction, TDR du CAFDR (exemple externe, hors Git), Base du scoutisme. Empreintes : [SEEDS_PEDAGOGIQUES.md](../SEEDS_PEDAGOGIQUES.md).

## 1. Indicateurs avant / après

Recomptés par `npm run pedagogy:audit` sur `tesla` (avant : début de session ; après : révisions appliquées).

| Indicateur | Avant | Après |
| --- | --- | --- |
| Modules totaux | 36 | 36 |
| Modules publiés | 0 | **0** — aucun responsable plein désigné (§ 6) |
| Modules prêts à publier (classe E, 0 anomalie bloquante) | 15 | 15 |
| Brouillons | 36 | 36 (15 rédigés + 21 brouillons vides `NT-DEC-*`) |
| Brouillons archivés ou supprimés | 0 | 0 — suppression préparée, exécutée par le plein à la mise en service (§ 5) |
| Leçons vides | 21 (toutes dans les brouillons `NT-DEC-*`) | 21 (idem) ; **0 dans le catalogue destiné aux routiers** |
| Questionnaires préparés | 14 | 14 (un par module d'apprentissage) |
| Questions préparées | 139 | **143** (M09 : 10 → 12 ; M10 : 10 → 12) |
| Questions publiées en base | 0 | 0 |
| Notes pédagogiques non résolues | 22 | **25** (M09 : 2 → 4 ; M10 : 3 → 4 ; voir § 7) |
| Ressources téléchargeables | 0 ressource attachée en base ; support de cours PDF généré pour chaque module **publié** (aucun à ce jour) | 0 ressource attachée ; supports PDF + **9 fiches pratiques** PDF, servis dès la publication de M09 |
| Leçons de M09 / M10 | 8 / 10 | **13 / 10** |
| Modules destinés aux routiers avec anomalie bloquante | 0 | 0 |

Simulation complète sur `tesla_test` (test d'intégration `entreprise-domaines.int-spec.ts`, responsable fictif) : 15 modules publiés, 14 questionnaires, **143 questions publiées**, brouillon vide supprimé, audit : 0 anomalie bloquante, 0 leçon vide, tous les modules en classe F ; seconde exécution sans aucune écriture.

## 2. `NT-ROUTE-M09` — L'Entreprise routière

Module conservé (même code, même slug, même étape recommandée), réécrit de 8 à 13 leçons selon la progression découverte → bilan. Révision tracée n° 4 de la source (`module_source_revisions`), appliquée au brouillon resté intact.

| # | Leçon | Section | Sources principales |
| --- | --- | --- | --- |
| 1 | Comprendre l'Entreprise | A | Définitions SAPF p. 6, Forestier (fiche 7 p. 2), Guide p. 2 ; « pas une collecte de fonds » (Guide p. 9) ; durées en repères |
| 2 | Dimensions éducatives et responsabilités | A | Sept dimensions (Guide p. 2, fiche 7 p. 2), fonctions de projet (Guide p. 6), coordinateur (SAPF p. 2 et 6) |
| 3 | Observer un besoin réel | B | Diagnostic avec les bénéficiaires, impression ≠ diagnostic (Guide p. 4–5) |
| 4 | Choisir l'Entreprise ensemble | B | Idées, présentation, comparaison, grille 6 × 5 = 30, délibération, vote, procès-verbal, domaine principal |
| 5 | Préparer : objectifs, faisabilité et équipes | C | Objectifs mesurables (général / spécifique / activité / indicateur), faisabilité, équipes, partenaires, autorisations |
| 6 | Préparer : ressources, sécurité et calendrier | C | Ressources humaines et matérielles, plan de prévention, chronogramme, checklist (annexe C) |
| 7 | Rédiger le dossier : de la page de garde aux bénéficiaires | D | Parties 1 à 8 expliquées (ce qu'il faut écrire) |
| 8 | Rédiger le dossier : de l'organisation à la conclusion | D | Parties 9 à 15, pièces à conserver, conseils |
| 9 | Budget et financement | E | Investissement / fonctionnement, quantité × prix unitaire, justificatifs, confirmé / recherché, nature, tiers historique, prévu / réel |
| 10 | Réaliser l'Entreprise | F | Coordination, exécution, sécurité, matériel, bénéficiaires, finances, calendrier, imprévus |
| 11 | Évaluer, relire et transmettre | G | Résultats, bilan financier, bénéficiaires, difficultés, compétences, relecture, pérennité, transmission ; pas de label automatique |
| 12 | Étude de cas : des termes de référence (exemple externe) | — | TDR du CAFDR : structure seulement, sans coordonnées, tarif ni calendrier |
| 13 | Boîte à outils : les fiches pratiques | — | Neuf fiches (§ 4), conclusion du module |

Exemples construits signalés « Exemple (illustratif) », montants annoncés fictifs. Questionnaire : 12 questions dont 7 mises en situation (besoin, choix collectif, domaine, objectif mesurable, bénéficiaires, calcul de budget, prévu / réel, tiers historique, évaluation).

## 3. `NT-ROUTE-M10` — Domaines d'action de l'Entreprise

Un seul module, **exactement dix leçons**, titres identiques à `ACTION_DOMAINS` et dans l'ordre du référentiel (D158). Chaque leçon : Définition (SAPF) et pistes du Guide · Objectif éducatif · Intérêt pour la société · Exemples d'Entreprise (proposition pédagogique, « aucun n'est un projet déjà réalisé ») · Compétences développées · À distinguer des domaines proches · Précautions particulières · Programmes OMMS cités par le manuel (à vérifier) · Pour réfléchir. Les correspondances historiques sont expliquées dans les leçons concernées (« Santé » + « Sport », « Engagement chrétien »). Aucun module, étape, menu ou workflow par domaine.

Questionnaire transversal unique, 12 questions : identifier les dix domaines (nombre, appartenance), association idée → domaine (déchets, informatique, pastorale), distinction de domaines proches (potager, rencontre interquartiers, soutien scolaire), domaine principal et complémentaire justifié (spectacle de contes), précaution (éducation sexuelle), absence de label automatique.

Contrôles : test unitaire (titres exacts, rubriques présentes, aucun autre module ou leçon portant le nom d'un domaine), `pedagogy:audit` (anomalie bloquante `DOMAINES_ACTION` si le module ne contient pas exactement les dix domaines ; `DOMAINE_EN_DOUBLE` pour un autre module), recette navigateur.

## 4. Fiches pratiques

Neuf modèles vierges imprimables (PDF A4, logo et couleurs de la communauté, source en pied de page) : grille de comparaison, procès-verbal de choix, fiche résumé, chronogramme, budget, financement, suivi d'exécution, bilan, checklist avant lancement. Définis dans `packages/shared/src/entreprise.ts`, rendus par `apps/api/src/modules/pedagogy/practical-sheet-pdf.ts`, servis par `GET /modules/:slug/sheets/:key/pdf` pour le seul module publié `NT-ROUTE-M09`, listés dans la carte « Fiches pratiques » de la page du module. Pas de ressource R2 (D159). Rendu visuel contrôlé (budget, procès-verbal, bilan) ; deux défauts de mise en page corrigés (en-tête de tableau sur deux lignes, titre isolé en bas de page).

## 5. Autres modules et anciens brouillons

**Parcours** (contrôle de couverture, aucun contenu modifié) :
- Noviciat : Découvrir le scoutisme, Loi principes et vertus, La méthode scoute, Découverte de la branche Route, Comprendre sa progression ; Prière de la Route (texte fondamental). Charte de la Route **absente des sources** : non inventée.
- Apprentissage : Vie en équipe et responsabilités, Engagement routier et cérémonies (accueil, engagement, flots), Mini-Camp ; complémentaire : Initiation au Morse.
- Compagnonnage : Raid, Entreprise, Domaines d'action ; responsabilité et service traités dans M05, M09 et M11.
- Départ routier : Service et engagement personnel, Préparation au Départ routier (relecture, cérémonie de départ).
- Aucun doublon : chaque code source est unique ; le seul rapprochement de titre concerne des brouillons vides.

**21 brouillons `NT-DEC-*`** (catalogue « Découvrir la Route », import système du 2026-10-29, une leçon « À rédiger » vide chacun) : vérifié en base — 1 version chacun, jamais publiée, aucun auteur humain, aucune écriture humaine, aucun questionnaire, collaborateur, ressource, fichier, compétence, étude, activité ni rattrapage. Sujets couverts par M03–M12 et NT-SCOUT-M01–M03, ou sans source (C12–C14 communauté, A05 organisation nationale, D23 plateforme). Ils sont invisibles des routiers (brouillons). Leur suppression passe par la procédure métier existante (`purgeEmptyDraft`, journal d'audit) exécutée par `pedagogy:release` **au nom du responsable plein** : non exécutée faute de plein. La création de brouillons par les chefs est inchangée.

**Progression** : écarts texte / tableau synoptique détaillés dans [REFERENTIEL_PEDAGOGIQUE.md § 5](../REFERENTIEL_PEDAGOGIQUE.md) ; rien n'est codé (D124, D160). Le moteur distingue étape théorique (âge), étape officielle (décision humaine), modules étudiés, rattrapages et décisions ; sortie le jour du 21e anniversaire ; aucun score ne change une étape.

## 6. Tests et vérifications exécutés

| Vérification | Résultat |
| --- | --- |
| `npm run format:check` | réussi |
| `npm run lint` | réussi, 0 problème |
| `npm run typecheck` | réussi |
| `npm run test` | API **204 tests** (24 fichiers), web **76 tests** (7 fichiers) — réussis |
| `npm run build` | réussi (sans `NODE_ENV` exporté) |
| `npm run test:int -w @tesla/api` (`tesla_test`) | **134 tests (15 fichiers) réussis**, dont `entreprise-domaines.int-spec.ts` : mise en service complète, refus du chef et de l'absence de plein, prévisualisation sans écriture, 143 questions publiées, audit en classe F, idempotence (publication et import), version publiée préservée face à une source révisée, fiches (200 / 404 / 401), copie hors ligne de M10, aucun corrigé transmis |
| `npm run db:seed:pedagogy -- --mettre-a-jour` (`tesla`) | M09 et M10 révisés, 13 autres modules inchangés ; seconde exécution : aucune écriture |
| `npm run pedagogy:audit` (`tesla`) | 0 anomalie bloquante, 15 modules E, 21 brouillons C/D |
| `npm run pedagogy:release -- --dry-run` (`tesla`) | refus : « Aucun responsable plein en fonction » (attendu, aucune identité simulée) |
| Recette navigateur catalogue (Chromium headless, 390 px, API et web de production sur `tesla_test`) | **8 contrôles réussis** dont M10 (un module, dix leçons, encadrés), fiches M09 (9 liens, PDF), lecture hors ligne d'une leçon de domaine |
| Recette navigateur offline-first | **28 contrôles réussis** |

Ajouts de tests : dix domaines exacts et uniques, un seul module de référence, une leçon par domaine, rubriques obligatoires, aucune leçon vide, aucun doublon, M09 sections A–G, CAFDR sans données personnelles, correction automatique de chacune des 143 questions (bonne réponse au maximum, mauvaise à zéro), questionnaire M10 unique et court, contrôle d'audit des domaines, fiches pratiques (clés, grille sur 30, tiers historique, PDF), encadrés web.

Non exécuté : publication réelle sur `tesla` (aucun plein) ; appareils mobiles réels (émulation 390 px seulement) ; balayage `ui-sweep` ; contrôle réseau des liens (`--liens`, aucun lien externe) ; CI GitHub.

## 7. Points restant à valider humainement

| Source | Problème | Options | Décision nécessaire | Impact sur la publication |
| --- | --- | --- | --- | --- |
| Fiche n° 7 p. 6, ossature ; Guide p. 7 | Apport personnel ≥ 1/3 du budget : règle historique | a) repère seulement (actuel) ; b) règle de la communauté ; c) supprimer la mention | Responsable / encadrement compétent | Aucun blocage ; note à acquitter |
| SAPF p. 4–5 ; fiche n° 7 p. 2 | Durées de l'Entreprise (8 / 5 / 3 mois ; « deuxième année ») | a) repères (actuel) ; b) calendrier par âge d'entrée (évolution du moteur, D124) | Sens des colonnes du tableau | Aucun blocage |
| M09 leçons 4, 6, 8, 9 | Ajouts pédagogiques (contenu conseillé du PV, méthode des risques, conseils de rédaction, exemples fictifs) | valider / reformuler / retirer | Relecture du responsable | Note à acquitter |
| TDR du CAFDR | Citation d'un document d'une autre communauté | a) garder l'étude de cas ; b) la retirer (leçon 12) | Accord de la communauté organisatrice | Note à acquitter |
| Guide p. 8 ; SAPF tableau | Label de domaine d'action : noms et conditions non fixés | confirmer auprès des instances de la branche | Instances de la branche Route | Aucun blocage (aucune attribution automatique) |
| SAPF p. 6–8 | Programmes OMMS cités : disponibilité actuelle | vérifier / retirer certains noms | Responsable | Note à acquitter |
| M10, toutes leçons | Exemples, compétences, domaines proches, précautions : recommandations pédagogiques | valider / remplacer par des exemples de la communauté | Responsable ; règles de protection de l'association | Note à acquitter |
| Rapport du 2026-11-02 (§ 3) | 17 points antérieurs des autres modules (Charte absente, Prière, flots, sécurité du Raid et du Mini-Camp, leadership partagé, préparation spirituelle…) | inchangés | Responsable | Notes à acquitter |
| — | Aucun responsable plein désigné sur `tesla` | — | Administrateur : désigner le plein | **Bloque toute publication** |

Procédure de publication (par le responsable, jamais par l'agent) : désignation du plein → relecture (« Modules à valider ») → `npm run pedagogy:audit` → `npm run pedagogy:release -- --dry-run` → `npm run pedagogy:release -- --notes-verifiees` (suppression tracée des 21 brouillons vides, 15 modules et 14 questionnaires publiés) → `npm run pedagogy:audit` (classe F). Validation groupée disponible : c'est cette commande, après acquittement des notes.

## 8. Exploitation

- **PWA / hors ligne** : recette offline-first 28/28 ; modules lisibles hors ligne après préparation de l'appareil (M10 vérifié) ; les fiches PDF, comme le support de cours PDF, demandent le réseau (aucun fichier en cache hors ligne, règle D143–D144).
- **Stockage R2** : inchangé ; jamais testé contre un compte R2 réel ; les fiches pratiques n'en dépendent pas.
- **OVH** : préparation inchangée (installation reproductible, sauvegardes, alertes) ; aucun VPS réel installé ni testé.

## 9. Décision

**GO technique pour la préproduction** : catalogue complet, 0 anomalie bloquante, tests et recettes verts.
**NO-GO pour une publication aux routiers à ce jour** : aucun module n'est publié ; la publication exige la désignation d'un responsable plein et l'acquittement par lui des 25 notes (§ 7). **NO-GO production** tant que le VPS OVH et R2 réels n'ont pas été installés et vérifiés.
