# Encadrement : responsable plein, adjoint, assistants

Décisions : D132 (remplace D100–D103, D107 et D123), D133. Historique de l'ancien modèle de mandats : [DECISIONS.md](../DECISIONS.md) (D93–D107).

## Principe
Trois fonctions humaines, qui représentent l'organisation de la communauté — **pas des espaces applicatifs** :

| Fonction | Droits |
| --- | --- |
| Responsable plein | décisions pédagogiques officielles (niveau `OFFICIEL`) en plus des droits de l'encadrement |
| Adjoint, assistant | droits de l'encadrement : consultation, rédaction, correction, observations, propositions, activités |

Un membre de l'encadrement sans fonction a les mêmes droits que l'adjoint et les assistants. Aucun mandat annuel, aucune année scoute, aucune reconduction, aucune délégation.

## Désignation par l'administrateur
L'administrateur (compte `ADMINISTRATEUR`, sans aucun droit pédagogique) désigne directement, depuis la page « Encadrement » (`/communaute`) :
- le responsable plein (ou son remplaçant), l'adjoint et les assistants ;
- la fin d'une fonction (motif obligatoire) ;
- et consulte l'historique complet.

Seul un compte **actif de l'encadrement** peut recevoir une fonction : l'administrateur ne peut pas se désigner lui-même (administrateur fonctionnel ≠ technique). Le plein ne gère pas l'encadrement.

## Remplacement du responsable plein
`POST /leadership/assignments` avec `function: 'PLEIN'` :
1. autorisation `leadership.manage` vérifiée ;
2. compte cible vérifié (existant, actif, encadrement) ;
3. transaction sérialisée (verrou consultatif) ;
4. si un autre plein est en fonction : `confirmReplacement: true` exigé (sinon `409 PLEIN_REPLACEMENT_UNCONFIRMED`), puis fin de sa fonction (« Remplacé comme responsable plein. ») ;
5. fin de l'éventuelle fonction précédente du nouveau plein (« Changement de fonction. ») ;
6. création de la nouvelle fonction ;
7. journal d'audit `leadership.assigned` (fonction, fonction précédente, personne remplacée) ;
8. droits recalculés **à la requête suivante** de chacun (garde de session) : l'ancien plein perd immédiatement les décisions officielles, sans nouvelle connexion ; il conserve son compte, ses sessions et l'accès de l'encadrement. Côté web, toute réponse 403 relit la session (menu à jour).

Les actions passées de l'ancien plein (publications, décisions, fiches) restent attribuées à son compte : rien n'est supprimé ni réattribué.

## Garanties en base (`leadership_assignments`)
- un seul plein en fonction : index unique partiel `leadership_assignments_one_plein` ; une seule fonction en cours par personne : `leadership_assignments_one_per_user` ;
- jamais supprimée ; seule la fin (`ended_at`, motif, auteur) peut être enregistrée, une fois (trigger `leadership_assignments_guard`) ;
- concurrence : deux remplacements simultanés aboutissent à un seul plein en fonction (testé).

## Migration (`20261107090000_leadership_assignments`, additive)
- Mandats en vigueur à la date de migration (date civile d'Abidjan) repris comme fonctions (`source_mandate_id`, affichés « repris » dans l'historique).
- `leadership_mandates`, `delegations`, `scout_years` **conservées en lecture seule** (trigger `archived_table_guard` refusant toute nouvelle écriture) ; aucune donnée supprimée. Leur suppression éventuelle exigerait une migration destructive, non réalisée et à valider explicitement.
- Comptes sans mandat (dont anciens `CHEF`/`RESPONSABLE`) : aucune fonction attribuée d'office ; l'administrateur désigne le plein après la migration. Base locale de développement : aucun mandat existant, donc aucun plein désigné à ce jour.

## API
| Route | Permission | Rôle |
| --- | --- | --- |
| `GET /leadership` | `leadership.read` | composition actuelle (noms et fonctions), tout membre connecté |
| `GET /leadership/admin` | `leadership.manage` | composition, comptes désignables avec leur fonction, historique |
| `POST /leadership/assignments` | `leadership.manage` | désigner (`userId`, `function`, `reason?`, `confirmReplacement?`) |
| `POST /leadership/assignments/:id/end` | `leadership.manage` | mettre fin (`reason`) |

Erreurs : `NOT_STAFF` (400), `ALREADY_IN_FUNCTION`, `PLEIN_REPLACEMENT_UNCONFIRMED`, `ASSIGNMENT_ALREADY_ENDED`, `LEADERSHIP_CHANGED` (409), `ASSIGNMENT_NOT_FOUND` (404). Supprimées : `/mandates`, `/delegations`, `/scout-years` (404).

## Tests
`common/permissions.spec.ts` (décisions réservées au plein, adjoint et assistants sans décision, administrateur sans droit pédagogique) ; `test/refonte.int-spec.ts` (accès directs refusés, désignation, remplacement confirmé et atomique, retrait immédiat, historique et audit, unicité en base et en concurrence, adjoint et assistants, changement et fin de fonction, immutabilité, tables gelées, anciennes routes) ; `test/accounts.int-spec.ts` (fin de fonction du plein) ; `test/offline-sync.int-spec.ts` (opération rejouée après remplacement refusée sans effet).
