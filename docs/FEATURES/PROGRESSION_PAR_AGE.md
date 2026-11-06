# Progression par l'âge et appartenance à la branche

Décisions : D95, D96, D97, D106, **D173**. Traçabilité : [REFERENTIEL_PEDAGOGIQUE.md](../REFERENTIEL_PEDAGOGIQUE.md).

## Une seule étape, calculée (D173)
| Notion | Source | Modifiée par |
| --- | --- | --- |
| **Étape actuelle** (`stage`, `stageReason`) | Date de naissance + référentiel d'âge en vigueur + date civile d'Abidjan | Personne : calcul de l'API à chaque lecture (`apps/api/src/modules/progression/computed-stage.ts`), jamais stockée |
| Historique des anciennes décisions d'étape | `ScoutStageChange`, `ScoutProfile.currentStageId` / `currentStageSince` | Figé (triggers `scout_stage_changes_closed`, `scout_profiles_stage_frozen`) : consultable, jamais lu pour une décision |
| Progression pédagogique | Études (`ModuleStudy`), tentatives, compétences validées | Saisies et décisions existantes |
| Rattrapage (`catchUps`) | Obligations `CatchUpObligation` | Voir [RATTRAPAGE.md](RATTRAPAGE.md) |

**Pourquoi** : une seule vérité. L'étape affichée sur la fiche, la liste (et son filtre), le parcours, « Mon profil », les statistiques, les équipes, les copies, le catalogue et l'éligibilité aux évaluations provient de la même fonction ; une date de naissance corrigée ou un nouveau référentiel la change partout, immédiatement, sans tâche de synchronisation. Aucune route, permission ni champ ne permet de la choisir (`STAGE_IS_COMPUTED`, 422).

**Étape non déterminée** : date de naissance absente (`DATE_NAISSANCE_MANQUANTE`), aucun référentiel en vigueur (`AUCUN_REFERENTIEL`), âge sans période validée (`AUCUNE_REGLE`) ou sortie de la branche (`SORTI`). Aucune étape de substitution. Avec le référentiel `2026.1`, seule la période du noviciat est connue : **hors de ce mois, l'étape est non déterminée** et seules les évaluations ouvertes par un rattrapage ou un déblocage restent accessibles. Compléter le référentiel est donc un préalable à l'exploitation.

**Date d'entrée** (`joinedAt`, facultative) : ancienneté (« Mon profil ») et position des rattrapages par rapport à l'arrivée ; elle ne détermine jamais l'étape et n'est jamais remplacée par la date du jour.

**Correction de la date de naissance** : motivée, confirmée, journalisée (D173) ; aperçu préalable `GET /scouts/:id/birth-date-impact` (âge, étape, sortie avant / après, rattrapages nouveaux ou à réexaminer). Après enregistrement : étape recalculée à la lecture, plan de rattrapage complété (idempotent), obligations devenues incohérentes signalées « À réexaminer » ; aucune obligation, décision, validation ni historique effacé.

**Données héritées** : les étapes officielles enregistrées avant D173 restent en base et dans l'historique de la fiche (« Décisions antérieures ») ; elles ne sont plus affichées comme étape actuelle. La migration n'attribue aucune étape.

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
- API : `GET /age-rules` (encadrement), `POST /age-rules` (brouillon), `POST /age-rules/:id/activate` (permission `ageRules.manage`, confirmation explicite). Écran : `/administration/referentiel-age` — consultation par l'encadrement ; saisie d'un brouillon (prérempli depuis le référentiel applicable, notes non recopiées) et mise en vigueur (date choisie, confirmation) par le plein en fonction (D175). Périodes contrôlées : une par étape, fin après début, aucun chevauchement, début avant la sortie (`400 VALIDATION_ERROR`).

## Sortie de la branche (21 ans)
- Le jour du 21e anniversaire, le routier n'est plus membre actif : `effectiveMembership` le considère `SORTI` **dès la lecture**, même si le traitement n'a pas tourné.
- `MembershipService.applyExits(date)` (idempotent ; `POST /membership/apply-exits` ou `npm run jobs:daily -w @tesla/api`) : `membership_status = SORTI`, `branch_exited_on`, événement `route_membership_events` (ajout seul, unique par routier/nature/date), affectation d'équipe ouverte close à la date de sortie, journal d'audit.
- Rien n'est supprimé : compte, fiche, résultats, études, compétences, étapes, équipes et observations sont conservés. `isActive` (désactivation administrative) n'est pas utilisé. Aucune étape n'est attribuée (le Départ routier n'est pas une conséquence de l'âge).
- Effets : évaluations refusées (`SORTI_BRANCHE`), aucune nouvelle obligation de rattrapage ; connexion et consultation conservées (D95, à valider).

## Écrans
- Routier : bloc « Mon parcours » sur l'accueil et `/progression` (âge, étape actuelle, temps restant, prochaine échéance) puis trois catégories distinctes : **modules de mon étape**, **modules à rattraper**, **modules déjà acquis** ; « Mon profil » (`/compte`, `GET /auth/profile`) : identité, date de naissance, âge, date d'entrée, ancienneté, étape, prochaine transition, sortie prévue, rattrapages — en lecture seule.
- Encadrement : section « Âge, parcours et rattrapages » de la fiche (mêmes trois catégories) ; indicateurs « Parcours de la communauté » (`GET /statistics/pathways` : effectif actif, sortis, répartition par étape calculée, prochaines sorties, rattrapages ouverts / en retard / en attente, dates de naissance manquantes).

## Tests
`apps/api/src/modules/progression/age-progression.spec.ts` (avant 18 ans, jour des 18 ans, premier mois, échéance, fin de mois, 29 février, absence de référentiel, déterminisme, changement de référentiel, veille et jour des 21 ans, alerte) ; `test/refonte.int-spec.ts` (parcours HTTP, référentiel figé, sortie idempotente et historique conservé).
