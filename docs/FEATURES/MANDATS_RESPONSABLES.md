# Encadrement : fonctions, mandats et délégations

Décisions : D93, D94, D100–D103, D105, D107.

## Rôle d'accès et fonction
| Notion | Valeurs | Stockage |
| --- | --- | --- |
| Rôle d'accès (`User.role`) | `ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR` (technique, sans droit pédagogique) | Compte |
| Fonction exercée | `PLEIN`, `ADJOINT`, `ASSISTANT` | Mandat annuel (`leadership_mandates`), jamais dans `User.role` |

Une personne garde un seul compte quand elle change de fonction. `CHEF` et `RESPONSABLE` restent dans le type PostgreSQL (aucune suppression) mais sont interdits (`users_role_current_check`) ; l'ancien rôle est conservé dans `legacy_role`.

## Habilitations (`@tesla/shared/permissions.ts`)
Niveaux : `ROUTIER`, `ENCADREMENT`, `ADMINISTRATEUR`, `OFFICIEL` (responsable plein en exercice **ou** délégation active portant sur la permission), `PLEIN` (non délégable). Calculées à **chaque requête** par la garde de session à la date civile d'Abidjan (`AuthService.resolveAuthority`) : un mandat échu ou une délégation expirée cesse d'agir sans tâche planifiée. `GET /auth/me` expose `leaderFunction` et `permissions` (affichage seulement ; l'API reste l'autorité).

- Tout membre de l'encadrement, avec ou sans mandat : consultation, rédaction, préparation papier, correction, observations, propositions, activités.
- Décisions officielles (approbations, publication, examen des résultats, déblocages, validations, fiches, équipes, étapes, rattrapages, référentiel d'âge) : `OFFICIEL`.
- `delegation.manage`, `mandate.recordTeam` : `PLEIN`. `mandate.recordPlein`, `scoutYear.manage` : `ADMINISTRATEUR`.

## Mandats
- Années scoutes déclarées (`scout_years`, libellé `AAAA-AAAA`, dates configurables, sans chevauchement).
- Mandat : personne, fonction, année, période (par défaut celle de l'année), nature (`NOMINATION`, `RECONDUCTION`, `REMPLACEMENT`, `CHANGEMENT_FONCTION`), autorité de nomination (obligatoire), référence, mandat précédent, observations, auteur de l'enregistrement.
- **Un seul plein à une date** (`leadership_mandates_one_plein`) et **une fonction par personne à une date** (`leadership_mandates_one_per_user`) : contraintes d'exclusion PostgreSQL.
- Immuable (trigger) : seule une fin anticipée peut être enregistrée, une fois. Jamais supprimé.
- Reconduction : nouveau mandat, nombre illimité, jamais automatique. `GET /mandates/:id/reconduction` préremplit l'année suivante (rien n'est écrit) ; l'enregistrement exige l'autorité de nomination et `confirm: true`.
- Personne ne consigne sa propre nomination (`SELF_APPOINTMENT`). Le plein en exercice ne consigne aucun mandat de plein.
- Changement de fonction : fin du mandat en cours puis nouveau mandat `CHANGEMENT_FONCTION` lié au précédent.
- Vacance : aucun plein en exercice → décisions officielles suspendues, signalées à l'écran.

## Délégations
Nominatives, du plein en exercice vers un membre sous mandat, sous-ensemble des permissions `OFFICIEL`, bornées par le mandat du plein, révocables (motif), jamais supprimées. Elles cessent dès que le plein n'est plus en exercice.

## API
`GET /leadership`, `GET /mandates?scoutYearId=&userId=`, `POST /mandates`, `POST /mandates/:id/end`, `GET /mandates/:id/reconduction`, `POST /scout-years`, `GET /delegations`, `POST /delegations`, `POST /delegations/:id/revoke`. Chaque écriture est journalisée (`AuditLog`).

## Écran `/mandats`
Encadrement en exercice, vacances, membres sans mandat (dont anciens comptes à résoudre, avec leur ancien rôle), formulaire de mandat (fonctions proposées selon les habilitations), « Reconduire pour l'année suivante », fin anticipée, délégations, historique par année, années scoutes (administration technique).

## Migration des comptes existants (D107)
Les anciens `CHEF` et `RESPONSABLE` deviennent `ENCADREMENT` avec `legacy_role` ; **aucun mandat n'est attribué** faute d'information fiable. L'écran liste ces comptes « sans mandat » jusqu'à l'enregistrement de leur fonction. Les actions historiques restent attribuées aux mêmes comptes.

## Tests
`common/permissions.spec.ts` ; `test/refonte.int-spec.ts` : un seul plein, contrainte en base, auto-nomination refusée, dix reconductions successives, retour d'un ancien plein, changement de fonction, fin anticipée et perte immédiate des droits, délégation limitée et révocation, permissions non délégables, immutabilité.
