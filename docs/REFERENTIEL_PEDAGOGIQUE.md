# Référentiel pédagogique et traçabilité des règles

Dernière mise à jour : 2026-10-29 (refonte « parcours Route et mandats », branche `feat/refonte-parcours-route-mandats`).

**Principe** : le manuel SAPF-Route est la référence officielle. Aucune règle absente du manuel ou non validée par le responsable n'est codée. Une valeur non arbitrée reste **nulle** (jamais une valeur par défaut) et l'écran l'indique (« non déterminée », « non arbitré »).

## 1. Sources disponibles

| Source | Emplacement | Contenu exploitable | Limites |
| --- | --- | --- | --- |
| Manuel SAPF-Route | **Absent du dépôt** | — | Aucune règle officielle d'étape, de durée, de cérémonie, de flot ou de Départ routier ne peut en être tirée. |
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
| Conséquence pédagogique de l'échéance du noviciat (étape suivante ?) | Manuel absent | **Bloquée** | Après l'échéance : étape théorique « non déterminée » (`AUCUNE_REGLE`) |
| Âges de début et de fin d'Apprentissage et de Compagnonnage | Manuel absent | **Bloquée** | Configurable par une nouvelle version du référentiel (`POST /age-rules`) |
| Nature et conditions du Départ routier | Manuel absent | **Bloquée** | Jamais traité comme une tranche d'âge ; jamais attribué à la sortie |
| Âge d'entrée dans la branche (avant 18 ans ?) | Manuel absent | **Bloquée** | Avant 18 ans : « non déterminée » |
| Sortie de la branche le jour du 21e anniversaire | Règle fournie | Confirmée, implémentée | `branch_exit_age_years = 21`, `MembershipService`, calcul à la lecture |
| Anniversaire d'une personne née un 29 février | Choix technique | **À valider** (D97) | 1er mars les années non bissextiles (`LEAP_DAY_ANNIVERSARY`) |
| Mois calendaire depuis un 29/30/31 | Choix technique | **À valider** (D97) | Ramené au dernier jour du mois (31 janvier + 1 mois = 28 ou 29 février) |
| Date civile de référence | Mission | Confirmée, implémentée | `Africa/Abidjan` (`civilDateAt`) |
| Modules obligatoires par étape | Manuel absent | **Bloquée** | Champ `obligation = OBLIGATOIRE` exigeant une source officielle (CHECK) ; aucun module ainsi marqué |
| Délai de rattrapage | Non défini | **Bloquée** | `catch_up_delay_months` nul → échéance « non déterminée » |
| Rattrapage plafonné à la sortie | Mission | Confirmée, implémentée | `catchUpDueOn` |
| Accès aux évaluations d'une étape antérieure au titre d'un rattrapage | Mission (« lorsque les règles l'autorisent ») | **À valider** (D98) | Statut `ELIGIBLE_RATTRAPAGE` si obligation ouverte |
| Seuil d'alerte avant 21 ans | Non défini | **Bloquée** | `exit_alert_months` nul → liste par date, sans alerte |
| Droits d'un routier sorti de la branche | Non défini | **À valider** (D95) | Connexion et consultation conservées ; évaluations refusées (`SORTI_BRANCHE`) |
| Validation officielle exclusivement humaine | RM / `.claude/rules/pedagogy.md` | Confirmée, implémentée | Décisions motivées, journalisées ; aucun calcul ne valide |
| Un seul responsable plein à une date donnée | Mission | Confirmée, implémentée | Contrainte d'exclusion `leadership_mandates_one_plein` |
| Reconduction illimitée, explicite, jamais automatique | Mission | Confirmée, implémentée | Nouveau mandat `RECONDUCTION` ; préremplissage sans écriture |
| Autorité qui nomme le plein | Non définie | **À valider** (D101) | Texte libre obligatoire ; consigné par l'administration technique ; auto-nomination refusée |
| Habilitations de l'adjoint | Non définies | **À valider** (D103) | Aucune décision officielle par défaut ; délégations nominatives |
| Qui nomme adjoint et assistants | Non défini | **À valider** (D101) | Plein en exercice ou administration technique |
| Calendrier des années scoutes | Non défini | Configurable | `scout_years` (déclarées, sans chevauchement) |
| Cérémonies, engagements, flots : conditions | Manuel absent | **Bloquée** | Référence de cérémonie libre sur la décision d'étape (existant) |

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
- **Décisions officielles suspendues après migration** tant qu'aucun mandat de plein n'est consigné (aucun mandat n'est attribué d'office, conformément à la mission). Voir « Mise en service ».
- Valeurs d'enum `CHEF` / `RESPONSABLE` conservées dans le type PostgreSQL (aucune suppression) mais interdites par contrainte.
- Comptes de démonstration : nom « Chef » remplacé par « Encadrant » au seed (adresses inchangées).

## 4. Références manquantes à fournir

1. Manuel SAPF-Route (édition, date) : périodes d'Apprentissage et de Compagnonnage, nature du Départ routier, modules obligatoires et critères de réussite, conditions de cérémonie et de flot.
2. Règle de nomination du responsable plein (autorité, forme de l'acte) et habilitations de l'adjoint.
3. Délai de rattrapage, seuil d'alerte avant la sortie, droits après la sortie.
4. Calendrier officiel des années scoutes.
