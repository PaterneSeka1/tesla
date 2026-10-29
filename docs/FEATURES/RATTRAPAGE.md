# Rattrapage des modules obligatoires

Décisions : D98, D99. Le rattrapage n'est pas une catégorie de module : c'est une **obligation non acquise** venant d'une étape antérieure.

## Origine d'une obligation
`expectedCatchUps` (calcul pur, `pathway.service.ts`) : modules dont la **version publiée** est `category = ETAPE`, `obligation = OBLIGATOIRE` (ce qui exige une source officielle, contrainte `module_versions_mandatory_source_check`), rattachés à une étape dont la **période théorique est échue** à la date du jour selon le référentiel d'âge. Les modules de l'étape en cours sont « à étudier », pas à rattraper. Une étape sans période validée ne produit aucune obligation : rien n'est présumé.

Tant que le manuel n'est pas fourni, aucun module n'est marqué obligatoire : aucune obligation n'est créée (architecture prête, voir la matrice).

## Plan individuel (`CatchUpPlanService` → `PathwayService`)
- Création **idempotente** (`createMany … skipDuplicates`, unicité routier/module) à la lecture du parcours (`GET /scouts/:id/pathway`, `GET /me/pathway`) et par le traitement quotidien. Une obligation existante n'est jamais réécrite ni supprimée (trigger) ; si le module cesse d'être obligatoire, elle reste tracée (`stillRequired = false`).
- Chaque obligation porte : routier, module, étape d'origine, version du référentiel, motif, date de création, échéance, décision, auteur et motif de décision.
- Échéance : `catchUpDueOn` = création + délai validé, plafonnée au dernier jour dans la branche ; **nulle** tant qu'aucun délai n'est validé (affichée « non déterminée », arbitrage signalé).
- Après la sortie de la branche : aucune nouvelle obligation.

## Statuts (calculés à la lecture)
`A_FAIRE`, `EN_COURS` (étude ou tentative), `EN_ATTENTE_VALIDATION` (résultat accepté `VALIDEE` sur une évaluation du module), `EN_RETARD` (échéance dépassée), `ACQUIS` et `NON_APPLICABLE` (**uniquement** par décision humaine). Ni une lecture ni un résultat ne produisent `ACQUIS`.

## Décision
`POST /catch-ups/:id/decision` (`catchUp.decide` : responsable plein ou délégation) : `ACQUIS` ou `NON_APPLICABLE`, motif obligatoire, confirmation explicite, définitive (trigger), journalisée. Réutilise les mécanismes existants : études (`ModuleStudy`), évaluations, observations, compétences ; aucun second système d'évaluation.

## Évaluations
Une obligation ouverte rend accessible l'évaluation publiée du module concerné, même d'une étape antérieure (`ELIGIBLE_RATTRAPAGE`), en ligne comme sur papier, avec ou sans compte ; la limite de tentatives s'applique toujours (D98, à valider).

## Écrans
Routier : `/mes-rattrapages`. Encadrement : fiche du routier (bouton « Statuer » réservé aux personnes habilitées) ; indicateurs sur `/encadrement`.
