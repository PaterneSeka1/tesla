# Parcours officiel et parcours antérieur (D181)

## Quatre notions distinctes

| Notion | Source | Qui décide |
| --- | --- | --- |
| Étape actuelle | Calculée par l'API selon l'âge et le référentiel en vigueur (`computed-stage.ts`) ; exception de secours éventuelle (D176) | Personne ne la saisit |
| Étapes reconnues | `prior_stage_recognitions` (étapes accomplies avant l'arrivée) | Responsable plein en fonction |
| Progression numérique | Études, évaluations, rattrapages, acquis | Routier (études), plein (résultats, acquis) |
| Historique | Reconnaissances et révocations, exceptions, décisions de rattrapage, journal d'audit | — (jamais effacé) |

Une étape reconnue ne vaut ni module étudié, ni acquis, ni résultat. Un cours lu ne valide rien. Les indicateurs du routier restent séparés : étapes reconnues, modules de l'étape étudiés, modules à rattraper.

## Invariant : un routier actif a toujours une étape

- Inscription (`POST /scouts`) : date de naissance **obligatoire** ; l'API calcule l'étape et refuse (`422`) si elle est indéterminable : `BIRTH_DATE_REQUIRED`, `NO_AGE_RULE_SET`, `BELOW_ROUTE_AGE` (pas encore l'âge d'entrer), `NO_AGE_RULE` (référentiel incomplet), `ABOVE_ROUTE_AGE` (21 ans atteints). Jamais d'étape par défaut.
- Aperçu avant inscription : `GET /scouts/stage-preview?birthDate=` (étape, âge, motif de blocage, étapes antérieures reconnaissables). Le formulaire l'affiche et désactive l'enregistrement en cas de blocage.
- Correction : retirer la date de naissance d'un routier actif est refusé (API et trigger `scout_profiles_birth_date_kept`) ; une date qui rendrait l'étape indéterminable aussi (sauf sortie à 21 ans). Réactivation refusée sans date de naissance.
- Fiches historiques : `npm run diagnose:stages -w @tesla/api` (après `npm run build`), **lecture seule**, identifiants internes et codes seulement : `DATE_NAISSANCE_MANQUANTE`, `AGE_AVANT_ENTREE`, `REFERENTIEL_INCOMPLET`, `SORTIE_NON_ENREGISTREE` (régularisée par `jobs:daily`), `RECONNAISSANCE_INCOHERENTE`, `RATTRAPAGE_A_REEXAMINER`. Code de sortie 2 s'il reste des anomalies. Aucune correction automatique : la date de naissance ne se devine pas. Une fiche active sans étape s'affiche « À régulariser » (liste) et « Fiche à régulariser » (fiche), jamais « Sans étape ».
- Plusieurs étapes actives simultanées : impossible par construction (étape calculée ; exceptions sans chevauchement, contrainte SQL).

## Reconnaissance du parcours antérieur

- À l'inscription (« Routier ayant déjà un parcours », plein seulement) ou depuis la fiche (« Reconnaître une étape antérieure »).
- Étapes strictement antérieures à l'étape **normale selon l'âge** ; date de fin facultative (entre la naissance et aujourd'hui) ; observation facultative.
- `POST /scouts/:id/prior-stages` (`expectedUpdatedAt` facultatif → `409 SCOUT_PROFILE_CHANGED`), `POST /prior-stages/:id/revoke` (motif ≥ 5 caractères, `confirm: true`), `GET /scouts/:id/prior-stages` (encadrement).
- Contrôles : `progression.supervise` + `assertCanAtWrite` ; fiche verrouillée (`FOR UPDATE`) ; index unique partiel (une reconnaissance en vigueur par étape) ; trigger : ni suppression ni modification, révocation unique. Journal `priorStage.recognized` / `priorStage.revoked`.
- Décision officielle : jamais mise en file hors connexion (inscription avec parcours antérieur comprise).
- Effet : rattrapages de l'étape non créés et non bloquants (statut `PARCOURS_ANTERIEUR`). Révocation : rattrapages de nouveau exigibles (recréés si besoin), ancienne reconnaissance visible avec auteur, date et motif.
- Le routier voit ses étapes reconnues (frise « Parcours antérieur reconnu ») sans observation ni révocation ; il ne peut rien reconnaître (`403`).

## Frise

`ScoutPathway.timeline` : Noviciat → Apprentissage → Compagnonnage → Préparation au Départ routier, chaque étape « Parcours antérieur reconnu », « Période terminée » (période d'âge échue — jamais une cérémonie), « En cours » ou « À venir ».
