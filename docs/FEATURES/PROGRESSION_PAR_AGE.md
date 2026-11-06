# Progression par l'âge et appartenance à la branche

Décisions : D95, D96, D97, D106, **D173**, **D176**. Traçabilité : [REFERENTIEL_PEDAGOGIQUE.md](../REFERENTIEL_PEDAGOGIQUE.md).

## Une seule étape, calculée (D173)
| Notion | Source | Modifiée par |
| --- | --- | --- |
| **Étape actuelle** (`stage`, `stageReason`) | Date de naissance + référentiel d'âge en vigueur + date civile d'Abidjan | Personne : calcul de l'API à chaque lecture (`apps/api/src/modules/progression/computed-stage.ts`), jamais stockée |
| Historique des anciennes décisions d'étape | `ScoutStageChange`, `ScoutProfile.currentStageId` / `currentStageSince` | Figé (triggers `scout_stage_changes_closed`, `scout_profiles_stage_frozen`) : consultable, jamais lu pour une décision |
| Progression pédagogique | Études (`ModuleStudy`), tentatives, compétences validées | Saisies et décisions existantes |
| Rattrapage (`catchUps`) | Obligations `CatchUpObligation` | Voir [RATTRAPAGE.md](RATTRAPAGE.md) |

**Pourquoi** : une seule vérité. L'étape affichée sur la fiche, la liste (et son filtre), le parcours, « Mon profil », les statistiques, les équipes, les copies, le catalogue et l'éligibilité aux évaluations provient de la même fonction ; une date de naissance corrigée ou un nouveau référentiel la change partout, immédiatement, sans tâche de synchronisation. Aucune route, permission ni champ ne permet de la choisir (`STAGE_IS_COMPUTED`, 422).

**Étape non déterminée** : date de naissance absente (`DATE_NAISSANCE_MANQUANTE`), aucun référentiel en vigueur (`AUCUN_REFERENTIEL`), âge sans période validée (`AUCUNE_REGLE`) ou sortie de la branche (`SORTI`). Aucune étape de substitution. Depuis `2026.2` (D176), toute personne de 18 à 21 ans a une étape ; avant 18 ans, l'étape reste non déterminée.

## Chronologie Tesla `2026.2` (D176)
Adaptation propre à Nikola Tesla Académie (périodes d'inactivité de l'année scoute), **distincte des durées pédagogiques du manuel SAPF-Route** (noviciat 1 mois, apprentissage 6 mois, compagnonnage 10 mois, départ une année scoute) :

| Âge exact | Étape |
| --- | --- |
| Du 18e anniversaire à 18 ans + 1 mois exclu | Noviciat |
| De 18 ans + 1 mois au 19e anniversaire exclu | Apprentissage |
| Du 19e au 20e anniversaire exclu | Compagnonnage |
| Du 20e au 21e anniversaire exclu | Préparation au Départ routier |
| Dès le 21e anniversaire, 00 h 00 (Abidjan) | Sorti de la branche Route |

Les modules obligatoires antérieurs non acquis se rattrapent **étape par étape, 21 jours chacune**, et ferment les autres cours jusque-là (D177, [RATTRAPAGE.md](RATTRAPAGE.md)).

Exemple (né le 27 octobre 2008) : noviciat le 27/10/2026, apprentissage le 27/11/2026, compagnonnage le 27/10/2027, préparation au Départ le 27/10/2028, dernier jour dans la branche le 26/10/2029, sortie le 27/10/2029 à 00 h 00. Un routier arrivé à 19 ans est immédiatement en Compagnonnage (aucune rétrogradation) ; ses modules antérieurs relèvent du [rattrapage](RATTRAPAGE.md).

**L'âge ne prouve aucune réalisation** : l'Engagement routier, les flots, étoiles et insignes, le Raid, l'Entreprise et la cérémonie du Départ ne sont jamais attribués automatiquement. Entrer en « Préparation au Départ routier » ne signifie pas que la cérémonie du Départ a eu lieu.

## Procédure de secours : correction exceptionnelle de l'étape (D176)
| Valeur | Définition |
| --- | --- |
| `computedStage` | Étape normale selon l'âge (jamais modifiée) |
| `activeStageOverride` | Exception en cours, s'il y en a une |
| `effectiveStage` | Étape appliquée au parcours : l'exception si elle est en cours et valide, sinon l'étape normale |

- **Qui** : le responsable plein **en fonction** seul (`progression.supervise`), revérifié dans la transaction (`assertCanAtWrite`) ; un ancien plein, ses anciennes sessions et ses appels directs sont refusés ; l'administrateur technique, l'adjoint, les assistants et les routiers n'y ont pas accès.
- **Où** : fiche du routier, section « Supervision de la progression » → action « Correction exceptionnelle de l'étape » (étape, du … au … inclus, motif ≥ 10 caractères, aperçu obligatoire, confirmation). Levée anticipée motivée depuis la même section.
- **Bornes** : début au plus tôt aujourd'hui ; fin au plus tard la veille du 21e anniversaire ; étape différente de l'étape normale ; refus sans date de naissance, pour un routier sorti ou désactivé ; deux exceptions non levées ne se chevauchent jamais (`stage_overrides_no_overlap`, 409 `STAGE_OVERRIDE_CONFLICT`).
- **Effets** : l'étape appliquée remplace l'étape normale pour les modules « de mon étape », l'éligibilité aux évaluations, le catalogue, les listes, les statistiques et le suivi ; le calendrier du parcours montre la fin de l'exception. **Inchangés** : date de naissance, âge, date d'entrée, acquis, résultats, obligations de rattrapage (calculées sur l'âge), cérémonies, sortie de la branche. À la date de fin, l'étape normale reprend sans intervention ; le jour du 21e anniversaire, l'exception devient inopérante.
- **Historique** : routier, étape normale à la demande, étape exceptionnelle, référentiel, motif, auteur, création, dates, levée (date, auteur, motif). Ni modification ni suppression (trigger `stage_overrides_guard`) ; journal d'audit `stageOverride.created` / `stageOverride.lifted` sans le motif.
- **API** : `GET /scouts/:id/stage-supervision`, `POST /scouts/:id/stage-overrides/preview`, `POST /scouts/:id/stage-overrides`, `POST /stage-overrides/:id/lift`.

## Confidentialité des explications (D176)
- Routier : étape actuelle, modules, rattrapages, acquis, échéances, sortie prévue ; aucune explication du calcul (libellés courts `STAGE_STATUS_SHORT_LABELS`).
- Adjoint, assistants, administrateur : étape appliquée et informations d'accompagnement ; ni référentiel, ni règles, ni exceptions, ni motifs (refus 403 de l'API ; version du référentiel et motifs détaillés des rattrapages retirés des réponses).
- Responsable plein : référentiel d'âge, périodes du routier, étape normale et appliquée, exceptions, délai de rattrapage.
- Hors ligne : supervision et exceptions jamais conservées sur l'appareil ; le référentiel n'est préparé que pour le plein.

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
- Version initiale `2026.1` (seed, en vigueur au 2026-10-29) : **uniquement** noviciat 18 ans → 18 ans + 1 mois et sortie à 21 ans. Version `2026.2` (seed, en vigueur au 2026-11-06, D176) : quatre périodes ci-dessus ; délai de rattrapage et seuil d'alerte nuls (non validés).
- API : `GET /age-rules` (responsable plein seul depuis D176), `POST /age-rules` (brouillon), `POST /age-rules/:id/activate` (permission `ageRules.manage`, confirmation explicite). Écran : `/administration/referentiel-age` — consultation par le plein (D176) ; saisie d'un brouillon (prérempli depuis le référentiel applicable, notes non recopiées) et mise en vigueur (date choisie, confirmation) par le plein en fonction (D175). Périodes contrôlées : une par étape, fin après début, aucun chevauchement, début avant la sortie (`400 VALIDATION_ERROR`).

## Sortie de la branche (21 ans)
- Le jour du 21e anniversaire, le routier n'est plus membre actif : `effectiveMembership` le considère `SORTI` **dès la lecture**, même si le traitement n'a pas tourné.
- `MembershipService.applyExits(date)` (idempotent ; `POST /membership/apply-exits` ou `npm run jobs:daily -w @tesla/api`) : `membership_status = SORTI`, `branch_exited_on`, événement `route_membership_events` (ajout seul, unique par routier/nature/date), affectation d'équipe ouverte close à la date de sortie, journal d'audit.
- Rien n'est supprimé : compte, fiche, résultats, études, compétences, étapes, équipes et observations sont conservés. `isActive` (désactivation administrative) n'est pas utilisé. Aucune étape n'est attribuée (le Départ routier n'est pas une conséquence de l'âge).
- Effets : évaluations refusées (`SORTI_BRANCHE`), aucune nouvelle étude déclarée (`SORTI_BRANCHE` ; l'encadrement n'enregistre que des études antérieures à la sortie), aucune nouvelle obligation de rattrapage, aucune exception d'étape ; obligations, résultats, validations, activités et compte conservés ; connexion et consultation conservées (D95, à valider). Aucune opération (rattrapage, exception, décision) ne prolonge l'appartenance ; le Départ routier n'est jamais validé automatiquement.

## Écrans
- Routier : bloc « Mon parcours » sur l'accueil et `/progression` (âge, étape actuelle, temps restant, prochaine échéance) puis trois catégories distinctes : **modules de mon étape**, **modules à rattraper**, **modules déjà acquis** ; « Mon profil » (`/compte`, `GET /auth/profile`) : identité, date de naissance, âge, date d'entrée, ancienneté, étape, prochaine transition, sortie prévue, rattrapages — en lecture seule.
- Encadrement : section « Âge, parcours et rattrapages » de la fiche (mêmes trois catégories) ; indicateurs « Parcours de la communauté » (`GET /statistics/pathways` : effectif actif, sortis, répartition par étape calculée, prochaines sorties, rattrapages ouverts / en retard / en attente, dates de naissance manquantes).

## Tests
`progression-2026-2.spec.ts` (transitions 2026.2 jour par jour, exemple du 27 octobre 2008, sortie à 00 h 00, fins de mois, 29 février, arrivée tardive, exception active / expirée / levée / à 21 ans, échéances non rétroactives) ; `test/stage-override.int-spec.ts` (permissions des cinq profils, ancien plein et concurrence, motifs et dates, chevauchement, levée, historique, sortie, DTO) ; recette `apps/web/test/progression-exception.browser.mjs`. `apps/api/src/modules/progression/age-progression.spec.ts` (avant 18 ans, jour des 18 ans, premier mois, échéance, fin de mois, 29 février, absence de référentiel, déterminisme, changement de référentiel, veille et jour des 21 ans, alerte) ; `test/refonte.int-spec.ts` (parcours HTTP, référentiel figé, sortie idempotente et historique conservé).
