# Progression par l'âge et appartenance à la branche

Décisions : D95, D96, D97, D106. Traçabilité : [REFERENTIEL_PEDAGOGIQUE.md](../REFERENTIEL_PEDAGOGIQUE.md).

## Quatre notions distinctes
| Notion | Source | Modifiée par |
| --- | --- | --- |
| Étape théorique (`theoreticalStage`) | Date de naissance + référentiel d'âge en vigueur | Calcul à la lecture, jamais stockée |
| Étape officielle (`officialStage` = `ScoutProfile.currentStageId`) | Historique `ScoutStageChange` | Décision du responsable uniquement |
| Progression pédagogique | Études (`ModuleStudy`), tentatives, compétences validées | Saisies et décisions existantes |
| Rattrapage (`catchUps`) | Obligations `CatchUpObligation` | Voir [RATTRAPAGE.md](RATTRAPAGE.md) |

L'écart entre étape officielle et théorique (`ALIGNEE`, `EN_AVANCE`, `EN_RETARD`, `INDETERMINE`) est une information d'accompagnement, jamais une décision. La date d'intégration (`joinedAt`) reste l'ancienneté administrative.

## Moteur de calcul (`packages/shared/src/age-progression.ts`)
Fonctions pures, déterministes, sur des dates civiles « AAAA-MM-JJ » :
- `civilDateAt(instant)` : date civile à Abidjan (`Africa/Abidjan`), jamais celle du serveur ou du navigateur.
- `ageOn(naissance, date)` : âge révolu (anniversaires atteints).
- `anniversaryOf(naissance, n)` : né un 29 février → 1er mars les années non bissextiles (D97, à valider).
- `addCalendarMonths` : mois calendaires, jour ramené au dernier jour du mois.
- `computeAgeProgression({ birthDate, referenceDate, rules })` : étape théorique et motif (`REGLE`, `DATE_NAISSANCE_MANQUANTE`, `AUCUN_REFERENTIEL`, `AUCUNE_REGLE`, `SORTI`), période en cours `[début, échéance[`, prochaine échéance, date de sortie, jours restants, alerte (nulle sans seuil validé).

## Référentiel versionné (`age_rule_sets`, `age_stage_rules`)
- Version, source, notes, âge de sortie, délai de rattrapage, seuil d'alerte (nuls tant que non arbitrés), périodes par étape (années révolues + mois) avec leur source.
- Référentiel applicable à une date : le plus récent `EN_VIGUEUR` dont `effective_from` ≤ date. Un référentiel en vigueur est **figé** (trigger) : une évolution crée une nouvelle version, les calculs antérieurs restent reproductibles.
- Version initiale `2026.1` (seed, en vigueur au 2026-10-29) : **uniquement** noviciat 18 ans → 18 ans + 1 mois et sortie à 21 ans.
- API : `GET /age-rules` (encadrement), `POST /age-rules` (brouillon), `POST /age-rules/:id/activate` (permission `ageRules.manage`, confirmation explicite). Écran : `/administration/referentiel-age` (consultation).

## Sortie de la branche (21 ans)
- Le jour du 21e anniversaire, le routier n'est plus membre actif : `effectiveMembership` le considère `SORTI` **dès la lecture**, même si le traitement n'a pas tourné.
- `MembershipService.applyExits(date)` (idempotent ; `POST /membership/apply-exits` ou `npm run jobs:daily -w @tesla/api`) : `membership_status = SORTI`, `branch_exited_on`, événement `route_membership_events` (ajout seul, unique par routier/nature/date), affectation d'équipe ouverte close à la date de sortie, journal d'audit.
- Rien n'est supprimé : compte, fiche, résultats, études, compétences, étapes, équipes et observations sont conservés. `isActive` (désactivation administrative) n'est pas utilisé. Aucune étape n'est attribuée (le Départ routier n'est pas une conséquence de l'âge).
- Effets : évaluations refusées (`SORTI_BRANCHE`), aucune nouvelle obligation de rattrapage ; connexion et consultation conservées (D95, à valider).

## Écrans
- Routier : bloc « Mon parcours » sur `/routier` et `/progression` (âge, étapes théorique et officielle, écart, temps restant, prochaine échéance).
- Encadrement : section « Âge, parcours et rattrapages » de la fiche ; indicateurs « Parcours de la communauté » sur `/encadrement` (`GET /statistics/pathways` : effectif actif, sortis, étapes théoriques, écarts, prochaines sorties par date, rattrapages ouverts / en retard / en attente, dates de naissance manquantes).

## Tests
`apps/api/src/modules/progression/age-progression.spec.ts` (avant 18 ans, jour des 18 ans, premier mois, échéance, fin de mois, 29 février, absence de référentiel, déterminisme, changement de référentiel, veille et jour des 21 ans, alerte) ; `test/refonte.int-spec.ts` (parcours HTTP, référentiel figé, sortie idempotente et historique conservé).
