# Référentiel pédagogique et traçabilité des règles

Dernière mise à jour : 2026-10-30 (manuel SAPF-Route versé au dépôt, matrice manuel ↔ moteur, § 5) ; 2026-10-29 (refonte « parcours Route et mandats ») ; 2026-10-30 (mandats supprimés : fonctions désignées par l'administrateur, D132).

**Principe** : le manuel SAPF-Route est la référence pédagogique (document d'atelier régional, non présenté comme règlement national tant qu'il n'est pas validé). Aucune règle absente du manuel ou non validée par le responsable n'est codée. Une valeur non arbitrée reste **nulle** (jamais une valeur par défaut) et l'écran l'indique (« non déterminée », « non arbitré »).

## 1. Sources disponibles

| Source | Emplacement | Contenu exploitable | Limites |
| --- | --- | --- | --- |
| Manuel SAPF-Route (atelier Branche Route, Région d'Abidjan, communauté Mahatma Gandhi ; 11 pages, sans date ni édition) | `docs/sources/SAPF-Route (2).pdf` (versé le 2026-10-30) | Étapes, durées générales et par âge, activités, signes distinctifs, Raid, Mini-Camp, Entreprise, domaines d'action, cérémonies | Ambiguïtés listées au § 5 ; aucune règle d'âge n'en est tirée sans validation. Modules 03 à 12 du [catalogue initial](CATALOGUE_PEDAGOGIQUE_INITIAL.md). |
| « BASE DU SCOUTISME » (6 pages) | `docs/sources/BASE DU SCOUTISME.pdf` | Définition, histoire, loi, principes, méthode, Morse | Document de découverte, pas un référentiel de progression. Importé en brouillons M01–M04. |
| Découpage éditorial | `docs/sources/Nikola_Tesla_Modules_Scoutisme.md` | Proposition de modules et d'étapes suggérées | Explicitement « brouillon à valider ». |
| Règles métier fournies par le responsable | Mission de refonte du 2026-10-29 | Noviciat d'un mois à compter du 18e anniversaire ; sortie de la branche le jour du 21e anniversaire ; reconduction illimitée du responsable plein ; un seul plein à la fois ; fonctions plein / adjoint / assistant | À rapprocher du manuel dès qu'il est fourni. |
| Étapes et flots | `packages/shared/src/progression.ts` (`PROGRESSION_STAGES`) | Noviciat (flot gris), Apprentissage (flot marron), Compagnonnage (flot routier), Départ routier (étoile or) | Repris des phases précédentes ; libellés à confirmer sur le manuel. |

## 2. Matrice de traçabilité

Statuts : **Confirmée** (règle fournie ou validée par le responsable) · **Implémentée** · **À valider** (`A_VALIDER`, choix provisoire documenté) · **Bloquée** (source manquante : architecture prête, aucune valeur).

| Règle | Référence | Statut | Implémentation |
| --- | --- | --- | --- |
| Étape théorique déterminée par l'âge (date de naissance), jamais par la date d'entrée | Mission 2026-10-29 | Confirmée, implémentée | `computeAgeProgression` (`@tesla/shared/age-progression.ts`), `PathwayService` |
| Noviciat : du 18e anniversaire à un mois calendaire plus tard (échéance exclue) | Règle fournie par le responsable | Confirmée, implémentée ; à rapprocher du manuel | Référentiel `2026.1` (`age_stage_rules`) |
| Fin du mois de noviciat sans validation automatique | Mission | Confirmée, implémentée | Aucun service ne modifie `currentStageId` sur calcul |
| Conséquence pédagogique de l'échéance du noviciat (étape suivante ?) | Manuel : durée d'un mois, sans conséquence automatique | **Bloquée** (à arbitrer, § 5) | Après l'échéance : étape théorique « non déterminée » (`AUCUNE_REGLE`) |
| Âges de début et de fin d'Apprentissage et de Compagnonnage | Manuel : durées, pas d'âges (§ 5) | **Bloquée** | Configurable par une nouvelle version du référentiel (`POST /age-rules`) |
| Nature et conditions du Départ routier | Manuel p. 4–5 et 9 : Service puis Envoi, en branche ou en ONG | **Décrite, non codée** (conditions d'accès non définies) | Jamais traité comme une tranche d'âge ; jamais attribué à la sortie |
| Âge d'entrée dans la branche (avant 18 ans ?) | Manuel p. 2 : « généralement âgés de 18 à 21 ans » | **Bloquée** | Avant 18 ans : « non déterminée » |
| Sortie de la branche le jour du 21e anniversaire | Règle fournie | Confirmée, implémentée | `branch_exit_age_years = 21`, `MembershipService`, calcul à la lecture |
| Anniversaire d'une personne née un 29 février | Choix technique | **À valider** (D97) | 1er mars les années non bissextiles (`LEAP_DAY_ANNIVERSARY`) |
| Mois calendaire depuis un 29/30/31 | Choix technique | **À valider** (D97) | Ramené au dernier jour du mois (31 janvier + 1 mois = 28 ou 29 février) |
| Date civile de référence | Mission | Confirmée, implémentée | `Africa/Abidjan` (`civilDateAt`) |
| Modules obligatoires par étape | Le manuel n'en définit aucun | **Bloquée** | Champ `obligation = OBLIGATOIRE` exigeant une source officielle (CHECK) ; aucun module ainsi marqué |
| Délai de rattrapage | Non défini | **Bloquée** | `catch_up_delay_months` nul → échéance « non déterminée » |
| Rattrapage plafonné à la sortie | Mission | Confirmée, implémentée | `catchUpDueOn` |
| Accès aux évaluations d'une étape antérieure au titre d'un rattrapage | Mission (« lorsque les règles l'autorisent ») | **À valider** (D98) | Statut `ELIGIBLE_RATTRAPAGE` si obligation ouverte |
| Seuil d'alerte avant 21 ans | Non défini | **Bloquée** | `exit_alert_months` nul → liste par date, sans alerte |
| Droits d'un routier sorti de la branche | Non défini | **À valider** (D95) | Connexion et consultation conservées ; évaluations refusées (`SORTI_BRANCHE`) |
| Validation officielle exclusivement humaine | RM / `.claude/rules/pedagogy.md` | Confirmée, implémentée | Décisions motivées, journalisées ; aucun calcul ne valide |
| Un seul responsable plein à un instant donné | Mission | Confirmée, implémentée | Index unique partiel `leadership_assignments_one_plein` ; remplacement confirmé et atomique (D132) |
| Désignation du plein, de l'adjoint et des assistants | Décision du 2026-10-30 | Confirmée, implémentée | Par l'administrateur, sans année scoute, sans reconduction (D132) ; mandats annuels supprimés |
| Autorité qui nomme le plein | Non définie | **À valider** (D101) | Texte libre obligatoire ; consigné par l'administration technique ; auto-nomination refusée |
| Habilitations de l'adjoint et des assistants | Décision du 2026-10-30 | Implémentée | Droits de l'encadrement (accompagnement) ; aucune décision officielle ; aucune délégation (D132) |
| Qui nomme adjoint et assistants | Non défini | **À valider** (D101) | Plein en exercice ou administration technique |
| Calendrier des années scoutes | Non défini | Plus utilisé pour l'encadrement | `scout_years` conservée en lecture seule (D132) |
| Cérémonies, engagements, flots : conditions | Manuel p. 8–10 : moments, acteurs, objets ; pas de conditions | **Décrite, non codée** | Référence de cérémonie libre sur la décision d'étape (existant) |

## 3. État des lieux (audit initial)

### Opérationnel avant la refonte (conservé)
Authentification et sessions ; fiches routiers avec ou sans compte, matricules, équipes historisées ; observations versionnées ; modules et workflow `BROUILLON → SOUMIS → APPROUVE → PUBLIE` ; questionnaires, passation en ligne, papier, correction, examen ; dérogations ; historique des étapes officielles (`ScoutStageChange`) ; compétences et validations ; études de modules ; programme annuel, activités, présences ; tableaux de bord ; hors ligne chiffré ; seed « Bases du scoutisme ».

### Partiel avant la refonte
`ScoutProfile.birthDate` présent mais inutilisé ; étapes recommandées sur les modules sans notion d'obligation ; statistiques par étape officielle seulement.

### Absent avant la refonte (livré par la refonte)
Étape théorique par l'âge, référentiel versionné, échéances, sortie à 21 ans et appartenance à la branche, plans de rattrapage, typologie des modules, catalogue de découverte, fonctions plein / adjoint / assistant, mandats et années scoutes, délégations, espace d'encadrement unique.

### Incompatibilités traitées
- Rôles `CHEF` / `RESPONSABLE` codés en dur dans les permissions, la navigation, le web et les tests → rôle d'accès `ENCADREMENT` + fonction issue du mandat (D93, D94).
- `isActive` du profil (désactivation administrative) ≠ appartenance à la branche → `membership_status` distinct (D95).
- Espaces `/chef` et `/responsable` séparés → `/encadrement` unique, anciennes URL redirigées (D105).

### Risques de migration
- **Décisions officielles suspendues** tant qu'aucun responsable plein n'est désigné par l'administrateur (aucune fonction attribuée d'office ; les mandats en vigueur ont été repris, D132).
- Valeurs d'enum `CHEF` / `RESPONSABLE` conservées dans le type PostgreSQL (aucune suppression) mais interdites par contrainte.
- Comptes de démonstration : nom « Chef » remplacé par « Encadrant » au seed (adresses inchangées).

## 4. Références manquantes à fournir

1. Manuel SAPF-Route : versé le 2026-10-30. Restent à fournir : édition et date, statut (régional ou national), sens des colonnes d'âge (§ 5), modules obligatoires et critères de réussite, conditions de cérémonie et de flot.
2. Règle de nomination du responsable plein (autorité, forme de l'acte) et habilitations de l'adjoint.
3. Délai de rattrapage, seuil d'alerte avant la sortie, droits après la sortie.
4. Calendrier officiel des années scoutes.

## 5. Matrice manuel SAPF-Route ↔ moteur (2026-10-30)

Pages = numéros imprimés. « Moteur » = référentiel d'âge versionné (`age_rule_sets`, `computeAgeProgression`), plans de rattrapage et décisions d'étape. **Aucune nouvelle règle n'est codée** : le référentiel `2026.1` reste inchangé ; les éléments ci-dessous attendent une décision du responsable (D124).

| Élément du manuel | Page | Valeur | Correspondance dans TESLA | Statut |
| --- | --- | --- | --- | --- |
| Public de la branche | 2 | « généralement âgés de 18 à 21 ans » | Noviciat à 18 ans ; sortie au 21e anniversaire (`2026.1`) | Cohérent avec les règles confirmées |
| Noviciat | 3, 4 | 1 mois (aux trois âges) | Noviciat de 18 ans à 18 ans + 1 mois (`2026.1`) | **Confirmé** par le manuel |
| Apprentissage | 3 | 6 mois | Aucune tranche d'âge | À valider |
| Compagnonnage | 3 | 10 mois (2 mois Raid + 8 mois Entreprise) | Aucune tranche d'âge | À valider |
| Départ routier | 4 | une année scoute | Aucune tranche ; jamais attribué à la sortie | À valider |
| Tableau synoptique | 4–5 | Durées par activité selon « 18 ans / 19 ans / 20 ans » (ci-dessous) | Non codé | **Ambigu** |
| Signes distinctifs | 4–5 | foulard, flot gris, insigne routier, étoile marron, flot marron, étoile blanche, label de domaine, flot routier, étoile or, Bible | `PROGRESSION_STAGES` (flots) ; référence de cérémonie libre sur la décision d'étape | Décrits dans les modules 04 et 06 |
| Cérémonies | 8–10 | accueil (1 à 15 jours après l'arrivée), engagement, remise de flots (chaque fin d'étape), départ (fin de la 4e étape) | Aucune échéance calculée | Décrites (module 06, 12) ; non codées |
| Rattrapage | — | Non traité par le manuel | Plans de rattrapage existants (D98) | Inchangé |

Tableau synoptique (mois) :

| Activité | 18 ans | 19 ans | 20 ans |
| --- | --- | --- | --- |
| Noviciat (cérémonie de fin d'étape) | 1 | 1 | 1 |
| Apprentissage — Engagement | 3 | 3 | 1 |
| Apprentissage — Mini-Camp | 3 | 3 | 1 |
| Compagnonnage — Raid | 2 | 2 | 1 |
| Compagnonnage — Entreprise | 8 | 5 | 3 |
| Départ routier — Service | 6 | 3 | 1 |
| Départ routier — Envoi | 3 | 1 | 1 |
| **Total** | **26** | **18** | **9** |

Observations (non validées) :
- La colonne « 18 ans » retrouve exactement les durées générales (apprentissage 3 + 3 = 6 ; compagnonnage 2 + 8 = 10 ; départ 6 + 3 = 9 mois ≈ une année scoute).
- Les totaux (26, 18, 9 mois) tiennent dans le temps restant avant 21 ans pour une **entrée** à 18, 19 ou 20 ans. **Hypothèse** : les colonnes désignent l'âge d'entrée dans la branche, les durées étant raccourcies pour un jeune arrivé tard.
- Si l'hypothèse est confirmée, le modèle actuel (étape théorique par **tranches d'âge**) ne suffit pas : il faudrait un calendrier par **âge d'entrée** (durées successives à partir de l'accueil). C'est une évolution du moteur à décider, pas un paramétrage.

Questions au responsable :
1. Les colonnes 18/19/20 ans désignent-elles l'âge d'entrée, l'âge au début de l'activité, ou autre chose ?
2. Un routier entré à 19 ans et 6 mois suit-il la colonne 19 ou 20 ?
3. À la fin du noviciat, l'étape officielle change-t-elle seulement après la cérémonie de remise du flot gris (décision humaine, comportement actuel) ?
4. Ces durées sont-elles des minimums, des maximums ou des repères ?
5. Le manuel a-t-il une édition, une date et un statut (régional / national) ?
