# Routiers, équipes et suivi — fonctionnalités livrées

Phase 1 (2026-10-29). Ce document décrit ce qui est **réellement développé**. Contrats : [API.md](../API.md) ; règles : [BUSINESS_RULES.md](../BUSINESS_RULES.md) (RM-001 à RM-018) ; choix : [DECISIONS.md](../DECISIONS.md) (D32 à D43).

Légende : ✅ implémentée et testée · 🟡 partiellement implémentée · ⬜ non développée · ⛔ bloquée (arbitrage attendu).

## Connexion et sessions

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Connexion e-mail / mot de passe | ✅ | `/connexion` → espace du rôle (ou page demandée). Argon2id. Message d'erreur unique. |
| Déconnexion | ✅ | Bouton de l'en-tête ; session révoquée côté serveur, cache client vidé. |
| Session serveur, cookie httpOnly, expiration, révocation | ✅ | 12 h absolues (`SESSION_TTL_HOURS`). Compte désactivé = sessions refusées. |
| Limitation des tentatives | ✅ | En mémoire (instance unique). |
| Protection CSRF | ✅ | En-tête `x-tesla-csrf` + origine autorisée + SameSite=Lax. |
| Protection des espaces web | ✅ | `proxy.ts` (cookie) + `SessionGate` (session et rôle) ; l'API reste la seule garantie. |
| Comptes de démonstration | ✅ | `*.demo@tesla.test` (responsable, 2 chefs, 1 routier sans profil), créés par `npm run db:seed` si `DEMO_ACCOUNT_PASSWORD` est défini dans le `.env` local, jamais en production. |
| Création / activation de comptes, mot de passe oublié | ⬜ | Phase « Comptes ». |

## Équipes — `/administration/equipes`

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Liste, recherche (nom, description), filtre actives / archivées / toutes, pagination | ✅ | Chefs et responsable. |
| Création `/administration/equipes/nouvelle` | ✅ | Responsable. Nom unique sans distinction de casse. |
| Fiche `/administration/equipes/[id]` : membres actuels | ✅ | Liens vers les fiches routiers. |
| Modification (nom, description) | ✅ | Responsable ; impossible sur une équipe archivée. |
| Archivage avec confirmation | ✅ | Affectations ouvertes clôturées ; historique conservé ; journalisé. |
| Désarchivage | ⬜ | Non demandé. |

## Routiers — `/administration/routiers`

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Liste, recherche par nom, prénoms ou matricule | ✅ | Plusieurs mots combinés ; insensible à la casse. |
| Filtres équipe (dont « sans équipe »), étape (dont « non renseignée »), statut, compte ; pagination | ✅ | Filtres initialisables par l'URL (liens du tableau de bord). |
| Inscription sans compte `/administration/routiers/nouveau` | ✅ | Responsable. Aucun champ e-mail ni mot de passe ; matricule, étape et équipe initiale facultatifs. |
| Matricule facultatif, unique, normalisé | ✅ | 7 chiffres + 1 lettre ; saisie en minuscules ou avec espaces acceptée. |
| Prévention des doublons | ✅ | Matricule unique ; homonyme exact → confirmation explicite. Accents non normalisés. |
| Fiche `/administration/routiers/[id]` | ✅ | Identité, matricule, équipe, étape, statut du compte, historique des équipes, historique pédagogique, observations. |
| Modification `/administration/routiers/[id]/modifier` | ✅ | Responsable ; changement d'étape journalisé. |
| Activation / désactivation avec confirmation | ✅ | Responsable ; désactivation = clôture de l'affectation. |
| Rattachement ultérieur d'un compte existant | ✅ | Responsable, par e-mail, après confirmation. Vérifications : compte existant, rôle routier, ni compte ni profil déjà rattachés. Profil et historique conservés. |
| Historique pédagogique | 🟡 | Affiche les tentatives d'évaluation et changements d'étape **réellement enregistrés** ; aucune tentative ne peut encore être créée depuis l'interface (phase 4 bis). |
| Validation officielle d'acquis | ⬜ | Phase 4 ; aucun écran ne la simule. |

## Affectations

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Affectation / changement d'équipe avec confirmation | ✅ | Transaction : verrou du profil → clôture de l'affectation précédente → nouvelle affectation → `AuditLog` (auteur). |
| Une seule équipe active | ✅ | Index unique partiel + contrainte d'exclusion PostgreSQL ; test de concurrence (5 affectations simultanées). |
| Retrait de l'équipe | ✅ | Clôture, jamais suppression. |
| Historique (équipe, dates, auteurs) | ✅ | Équipes archivées signalées. |
| Date de début choisie dans l'interface | ⬜ | L'API accepte `startedAt` ; l'écran utilise la date du jour. |

## Observations

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Saisie (date, contenu, catégorie libre facultative, visibilité) | ✅ | Chefs et responsable. |
| Consultation paginée selon la visibilité | ✅ | « Chefs et responsable » ou « Responsable uniquement » (lisible aussi par l'auteur). Jamais par les routiers. |
| Modification par l'auteur, historique des versions | ✅ | API `…/revisions` ; l'écran affiche la date de modification mais pas encore la liste des versions. |
| Suppression | — | Interdite (trigger). |
| Catégories prédéfinies, habilitation par équipe | ⛔ | Arbitrage du responsable attendu. |

## Tableaux de bord

| Fonctionnalité | État | Détail |
| --- | --- | --- |
| Indicateurs responsable et chef (routiers actifs, sans équipe, sans compte, équipes actives) | ✅ | Totaux réels de l'API, liens vers les listes filtrées. Aucun graphique. |
| Espace routier (son propre suivi) | ⬜ | Le routier n'a aucun accès aux fiches ni aux observations. |

## Préparation des évaluations papier

Le modèle, les contraintes et les services sont en place depuis la phase 1 bis (voir [ARCHITECTURE.md](../ARCHITECTURE.md#suivi-hybride-numérique--papier)) :

| Besoin | Où |
| --- | --- |
| Évaluation papier ou numérique | `EvaluationAttempt.mode` (`PAPIER`, `EN_LIGNE`, `HORS_LIGNE`) |
| Routier concerné | `scoutProfileId` (profil, jamais seulement le compte) |
| Version exacte du questionnaire | `evaluationVersionId` (FK composite, immuable) |
| Code unique `NT-2027-000125` | Émis par le serveur (compteur annuel transactionnel), unique, immuable, distinct du matricule |
| Date de réalisation, chef ayant saisi | `completedAt`, `recordedById` (+ historique `evaluation_attempt_events`) |
| Statut de correction, validation du responsable | `status` (`A_CORRIGER`, `SOUMISE`, `VALIDEE`/`REFUSEE`), `decidedById` |

Routes HTTP, écrans de saisie et génération PDF : ⬜ phase 4 bis (contrats prévus dans [API.md](../API.md)).

## Utilisation en développement

```bash
# .env local (jamais versionné) : DEMO_ACCOUNT_PASSWORD=<au moins 12 caractères>
npm run db:deploy && npm run db:seed
npm run dev   # http://localhost:3000/connexion — responsable.demo@tesla.test
```
