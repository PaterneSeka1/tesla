# Audit du système de progression — 2026-11-23

Périmètre : moteur de progression de Tesla (`packages/shared/src/age-progression.ts`, `pathway.ts`, `apps/api/src/modules/progression/`, `jobs/daily.ts`) comparé au dépôt **suivi-pédagogique CMG** (`src/progression/`, `src/milestones/`, `src/activities/activities.service.ts`), lu en lecture seule. Aucune donnée réelle consultée.

## 1. Deux modèles différents

| Aspect | Tesla | Suivi pédagogique CMG |
| --- | --- | --- |
| Étape | **Calculée** à chaque lecture (âge + référentiel versionné), jamais stockée (D173) | **Stockée** (`routier.stageId`), avancée quand tous les jalons sont validés |
| Unité de progression | Modules obligatoires d'étape, rattrapages, acquis | Jalons d'étape (`StageItem` activité / cérémonie) avec échéance selon l'âge d'entrée |
| Référentiel | `age_rule_sets` versionnés, figés une fois en vigueur | `stage_timings` / `stage_item_timings` modifiables par âge d'entrée |
| Validation | Humaine, plein seul ; ses actes sont définitifs (D188) | Deux niveaux : prévalidation district puis validation océan, séparation des tâches |
| Dates | Date civile d'Abidjan explicite, 29 février traité (D97) | UTC implicite, fin de mois traitée |
| Échéances | Statut `EN_RETARD` calculé à la lecture | `OVERDUE` / `DUE_SOON` (14 j) / `UPCOMING` + rappels quotidiens |

Le modèle Tesla est le plus sûr (une seule vérité, référentiel reproductible) et n'a pas à adopter l'étape stockée de CMG.

## 2. Bonnes pratiques de CMG transposables

| Pratique CMG | État dans Tesla | Suite |
| --- | --- | --- |
| Rappels d'échéance idempotents (`reminderUpcomingAt` / `reminderOverdueAt`, réservation par `updateMany`, lots de 200) | Absent | **Réalisé (D192)** : notifications idempotentes (clé unique), fenêtre à l'arrivée, e-mail réservé avant envoi |
| Classement `DUE_SOON` des échéances | Absent | **Réalisé (D192)** : `catchUpLock.deadline`, fenêtre `catchUpAlertDays` du référentiel (nulle tant que non arbitrée) |
| Annonce des passages d'étape (`stageChanges`) et célébrations acquittées une fois (`StructureMilestone`) | Un passage par l'âge est silencieux | À arbitrer : événement calculé (étape d'hier ≠ étape du jour), acquittement unique, jamais une cérémonie |
| Traitement par lots, erreurs isolées | Le traitement quotidien s'arrêtait à la première fiche en erreur et rechargeait le référentiel pour chaque routier | **Corrigé** (§ 4) |
| Lectures du référentiel hors de la transaction (`prepareAdvance`) | Déjà respecté : `loadStageContext` charge une fois par requête | — |
| Moteur pur testé (`previewPathway`) | Déjà respecté et plus complet (`computeAgeProgression`, 39 cas) | — |
| Refus d'une transition par simple modification (`DEDICATED_TRANSITION`) | Déjà respecté : étape non saisissable (`STAGE_IS_COMPUTED`) | — |

## 3. Faiblesses de CMG à ne pas reproduire
- Étape stockée et modifiée par la validation : seconde source de vérité.
- `createEvent` et `closeAndAdvance` : « chercher puis créer » sans contrainte d'unicité (doublons possibles en concurrence).
- Journal d'audit écrit **après** la transaction (`apply`, `validate`) : une action peut réussir sans trace.
- Référentiel entier relu à chaque passage (`stageTiming.findMany()` sans filtre).
- Dernière étape toujours « en cours » dans `previewPathway`, même échue.

## 4. Constats sur Tesla et corrections

| # | Constat | Gravité | État |
| --- | --- | --- | --- |
| T1 | Indicateurs « Parcours de la communauté » : obligations des routiers **sortis** ou désactivés comptées, ainsi que les modules devenus facultatifs et les obligations « à réexaminer » ; résultat accepté compté aussi « en retard ». Chiffres différents de la fiche | Important | Corrigé : `summarizeOpenCatchUps` (mêmes critères que `catchUpStatus` et le verrou), nouveau compteur `toReview` |
| T2 | `decideCatchUp` (décision officielle) sans revérification de la fonction de plein dans la transaction, contrairement aux exceptions d'étape et aux reconnaissances | Important | Corrigé : `assertCanAtWrite(tx, actor, 'catchUp.decide')` |
| T3 | `sync` ne refusait pas un apprenant adulte de 18 à 20 ans consulté par l'encadrement : écriture rejetée par le trigger `route_only_scout_profile`, donc erreur 500 | Moyen | Corrigé : garde `kind === 'ADULTE'` |
| T4 | Traitement quotidien : 3 requêtes de référentiel par routier, arrêt à la première erreur | Moyen | Corrigé : `syncAllCatchUps` (chargement unique, erreurs isolées, code de sortie 1, identifiants seulement) |
| T5 | Lecture du parcours : modules obligatoires chargés deux fois | Faible | Corrigé |
| T6 | `GET` du parcours écrit des obligations (création idempotente) | Faible, assumé (RATTRAPAGE.md) | Conservé : idempotent (`skipDuplicates`) |
| T7 | Obligations et reconnaissances relues trois fois par lecture (`sync`, `build`, `loadCatchUpLock`) | Faible (25 routiers) | Non traité : refonte en un instantané unique non nécessaire à cet effectif |

## 5. Annonce du passage d'étape — validée et réalisée le 2026-11-24 (D193)

Recommandation retenue : **notification calculée, sans étape stockée**, sur l'infrastructure D192.
- Le traitement quotidien compare l'étape appliquée du jour (`computedStageOf`) à celle de la veille ; si elle change et que la nouvelle est déterminée, il crée une notification `ETAPE_NOUVELLE` (clé `etape:<fiche>:<étape>:<date de début>`), donc une seule fois même si le traitement est relancé. Un traitement manqué se rattrape en retenant toute période commencée depuis 7 jours au plus.
- Routier : « Vous entrez en Apprentissage » et lien vers « Mon parcours », dans la fenêtre « Notifications » (et par e-mail si configuré). Encadrement : le plein seul, avec le nom ; l'adjoint et les assistants voient déjà l'étape sur la fiche.
- Garde-fous : jamais pour une exception de secours levée, une sortie (21 ans) ou un apprenant adulte ; libellé « nouvelle étape du parcours », **jamais** cérémonie, engagement ni validation (l'âge ne prouve aucune réalisation, D176).
- Pourquoi pas l'approche CMG (étape stockée, avancée à la validation) : elle rouvrirait une seconde vérité que D173 a supprimée.
- Coût : une valeur d'enum, une fonction pure testée, un appel dans le traitement ; aucune nouvelle table.

## 6. Vérifications
- `npm run lint`, `npm run typecheck` : réussis.
- `npm run test` : API **312** réussis (dont `catch-up-summary.spec.ts`, 11 cas), web **146** réussis.
- Intégration (`tesla_test`) : **200 réussis**, 1 ignoré, dont `catch-up-reminders.int-spec.ts` 6/6 (rappels et annonces) ; aucune dérive de schéma.
- Non exécutés : recette navigateur de la fenêtre « Notifications », envoi SMTP réel.

## 7. Arbitrages
Fenêtre d'alerte fixée à 7 jours (référentiel `2026.3`) et annonce du passage d'étape validée, le 2026-11-24. Restent à autoriser : application des migrations et du seed sur `tesla`, planification du traitement quotidien.
