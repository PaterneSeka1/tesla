# Rattrapage des modules obligatoires

Décisions : D98, D99, D173, D176, **D177**. Le rattrapage n'est pas une catégorie de module : c'est une **obligation non acquise** venant d'une étape antérieure.

## Origine d'une obligation
`expectedCatchUps` (calcul pur, `pathway.service.ts`) : modules dont la **version publiée** est `category = ETAPE`, `obligation = OBLIGATOIRE` (ce qui exige une source officielle, contrainte `module_versions_mandatory_source_check`), rattachés à une étape dont la **période théorique est échue** à la date du jour selon le référentiel d'âge. Les modules de l'étape en cours sont « à étudier », pas à rattraper. Une étape sans période validée ne produit aucune obligation : rien n'est présumé.

Tant que le manuel n'est pas fourni, aucun module n'est marqué obligatoire : aucune obligation n'est créée (architecture prête, voir la matrice).

## Plan individuel (`CatchUpPlanService` → `PathwayService`)
- Création **idempotente** (`createMany … skipDuplicates`, unicité routier/module) à la lecture du parcours (`GET /scouts/:id/pathway`, `GET /me/pathway`) et par le traitement quotidien. Une obligation existante n'est jamais réécrite ni supprimée (trigger) ; si le module cesse d'être obligatoire, elle reste tracée (`stillRequired = false`).
- Chaque obligation porte : routier, module, étape d'origine, version du référentiel, motif, date de création, échéance, décision, auteur et motif de décision.
- Échéance (D176) : `catchUpDueOn` = point de départ + délai validé, plafonnée à la veille du 21e anniversaire ; **nulle** tant qu'aucun délai n'est validé (cas de `2026.1` et `2026.2` : durée courte à arbitrer). Point de départ (`catchUpReferenceDate`), jamais rétroactif : la plus tardive des dates — fin de l'étape d'origine ; **entrée à la Route** (nouvel arrivant) ou, à défaut, création de l'obligation ; **publication** de la version obligatoire du module (obligation apparue après l'arrivée) ; mise en vigueur du référentiel. Une échéance enregistrée n'est jamais réécrite.
- **Étape par étape (D177)** : délai de **21 jours par étape** (`catch_up_delay_days`, référentiel `2026.2`) ; les étapes à rattraper s'enchaînent dans l'ordre du parcours. Exemple, arrivée à 20 ans le jour J : Noviciat avant J + 20, Apprentissage avant J + 41, Compagnonnage avant J + 62 (bornes incluses). Une étape ajoutée plus tard prend la suite de la dernière échéance ouverte.
- Les rattrapages ne retardent jamais une transition ni la sortie ; une exception d'étape (procédure de secours) n'en crée ni n'en efface aucun.
- Confidentialité : le routier, l'adjoint et les assistants reçoivent un motif générique (« Module obligatoire d'une étape antérieure ») sans version du référentiel ; motifs détaillés, position par rapport à l'arrivée et arbitrages en attente visibles du seul responsable plein.
- Après la sortie de la branche : aucune nouvelle obligation.

## Statuts (calculés à la lecture)
`A_FAIRE`, `EN_COURS` (étude ou tentative), `EN_ATTENTE_VALIDATION` (résultat accepté `VALIDEE` sur une évaluation du module), `EN_RETARD` (échéance dépassée), `A_REEXAMINER` (D173 : d'après les données actuelles — date de naissance corrigée, nouveau référentiel — l'étape d'origine n'est plus échue ; l'obligation reste et attend une décision), `ACQUIS` et `NON_APPLICABLE` (**uniquement** par décision humaine). Ni une lecture ni un résultat ne produisent `ACQUIS`.

## Date d'entrée et recalcul (D173)
- Chaque obligation indique (`arrival`) si l'étape d'origine s'est achevée **avant** l'entrée à la Route, **depuis** l'arrivée, ou si la date d'entrée est inconnue. C'est une information de suivi : une arrivée tardive ne dispense d'aucun module, et un module non étudié n'est jamais présumé acquis ni non applicable.
- Recalcul : à chaque lecture du parcours, après l'inscription d'un routier et après toute correction de sa date de naissance, par le traitement quotidien ; un module devenu obligatoire ou une évaluation acceptée est pris en compte à la lecture suivante. Création idempotente : aucun doublon, aucune obligation réécrite ni supprimée.
- Un module acquis (décision `ACQUIS`) n'est jamais réattribué : l'unicité (routier, module) l'interdit.
- Routier sans compte : mêmes règles ; l'encadrement suit, imprime et saisit les copies papier selon les permissions existantes.

## Verrou des autres cours (D177)
Calcul central `apps/api/src/modules/progression/catch-up-lock.ts`, à chaque lecture (aucune tâche planifiée).
- **Obligation bloquante** : sans décision, module toujours obligatoire, étape d'origine échue, aucun résultat accepté (`VALIDEE`) sur une évaluation du module.
- **Étape en rattrapage** : la plus ancienne étape ayant une obligation bloquante. **Ouverts à l'évaluation et à la déclaration d'étude** : modules à rattraper de cette étape et des étapes antérieures, textes fondamentaux qu'ils citent. **En attente** : les évaluations et études de tous les autres modules.
- **Lecture libre (D181)** : catalogue, module, leçons, impression, PDF, paquet hors ligne et fichiers restent ouverts pour tout module publié ; le catalogue signale seulement « Évaluation après rattrapage ».
- **Effets pour le routier** : déclaration d'étude refusée (`403 CATCH_UP_LOCKED`) ; évaluations `VERROUILLE_RATTRAPAGE`, en ligne comme sur papier (préparation par l'encadrement comprise), sauf **dérogation active** du responsable.
- **Parcours antérieur reconnu (D181)** : aucune obligation n'est créée pour une étape reconnue ; une obligation existante passe « Étape reconnue (parcours antérieur) », ne bloque plus et n'est jamais déclarée acquise. Une révocation la rend de nouveau exigible.
- **Inchangés** : étape actuelle (aucune rétrogradation), sortie à 21 ans, accès de l'encadrement, acquis et historiques. Après la sortie de la branche, aucun verrou (toute nouvelle activité est déjà fermée).
- **Affichage** : bandeau « Rattrapage en cours : étape, à terminer avant le … » sur « Mes rattrapages », le parcours et le catalogue ; `GET /me/pathway` et `GET /scouts/:id/pathway` exposent `catchUpLock` (étape, échéance, modules ouverts) et `blocking` par obligation.

## Alerte et rappels (D192)
- **Alerte** : `catchUpLock.deadline` vaut `PROCHE` de `catchUpAlertDays` jours avant l'échéance de l'étape en rattrapage jusqu'à elle (bornes incluses), `DEPASSEE` dès le lendemain ; le bandeau l'affiche (« Échéance proche. », « Échéance dépassée. »). Fenêtre : 7 jours (`2026.3`, validée le 2026-11-24) ; nulle = aucune alerte préalable.
- **Rappels** : `CatchUpRemindersService.dispatch` (traitement quotidien, après le recalcul des plans) reprend le calcul du verrou ; au plus un rappel « échéance proche » et un rappel « en retard » par routier, étape et échéance (clé `rattrapage:<fiche>:<étape>:<échéance>:<nature>`). Destinataires : le routier (compte actif) avec un message générique et un lien vers « Mes rattrapages » ; le responsable plein en fonction avec le nom du routier et un lien vers sa fiche. Routier sans compte : plein seul.
- **Fenêtre « Notifications »** : s'ouvre à l'arrivée sur la plateforme tant qu'il reste des notifications non lues ; « J'ai compris » les marque lues (`POST /me/notifications/read`), « Plus tard » la ferme jusqu'au prochain chargement. `GET /me/notifications` : non lues du titulaire seul. Jamais en cache hors ligne.
- **E-mail** : si le SMTP est configuré (D166), chaque notification de moins de 2 jours est envoyée au plus une fois (réservation `email_attempted_at`, confirmation `emailed_at`) ; un échec n'est pas retenté, la notification reste affichée. Ni le contenu ni l'adresse ne sont journalisés.

## Décision
`POST /catch-ups/:id/decision` (`catchUp.decide` : responsable plein ou délégation) : `ACQUIS` ou `NON_APPLICABLE`, motif obligatoire, confirmation explicite, définitive (trigger), journalisée. Réutilise les mécanismes existants : études (`ModuleStudy`), évaluations, observations, compétences ; aucun second système d'évaluation.

## Évaluations
Une obligation ouverte rend accessible l'évaluation publiée du module concerné, même d'une étape antérieure (`ELIGIBLE_RATTRAPAGE`), en ligne comme sur papier, avec ou sans compte ; la limite de tentatives s'applique toujours (D98, à valider).

## Écrans
Routier : `/mes-rattrapages`. Encadrement : fiche du routier (bouton « Statuer » réservé aux personnes habilitées) ; indicateurs sur `/encadrement` (`summarizeOpenCatchUps` : routiers encore membres, mêmes critères que la fiche ; ouverts, en retard, sans échéance, à valider, à réexaminer).
