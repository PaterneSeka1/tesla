# Offline-first (PWA)

Référence unique du fonctionnement sans connexion : architecture, données locales, préparation, sécurité, synchronisation, conflits, limites, recette. Décisions : D76–D83 (phase 5, toujours valables sauf mention) et **D109–D117** (refonte offline-first) dans [DECISIONS.md](DECISIONS.md).

**Principe** : une seule application. Après une préparation en ligne, Tesla s'ouvre et se parcourt sans Internet avec les mêmes écrans et la même navigation ; aucune navigation ordinaire ne passe par `/hors-ligne`. Le serveur (PostgreSQL) reste l'unique source des données officielles : tout ce qui est fait sans réseau est **provisoire** jusqu'à sa confirmation.

## 1. Architecture

```
Écrans React (useQuery / mutations habituelles)
  → apiFetch / apiSend (src/lib/api/client.ts)          un seul point d'entrée réseau
      → dépôt local (src/lib/offline/repository.ts)      lectures : copie chiffrée par compte
      → file d'opérations (src/lib/offline/operations.ts) écritures différables
  → coffre chiffré (src/lib/offline/vault.ts, db.ts)     IndexedDB « tesla-academie »
  → API NestJS /api/v1 (idempotence : common/idempotency.interceptor.ts)
  → PostgreSQL
Service worker (public/sw.js) : coquilles HTML, charges RSC, ressources statiques — jamais d'API
```

| Élément | Fichier | Rôle |
| --- | --- | --- |
| Lecture offline-first | `lib/api/client.ts` (`apiFetch`), `lib/offline/repository.ts` | En ligne : réseau puis copie chiffrée ; sans réseau (ou erreur réseau) : dernière copie de l'appareil. Aucun écran n'a sa propre logique. |
| Écritures différées | `lib/api/client.ts` (`apiSend(…, offline)`), `lib/offline/operations.ts` | Écriture rejouable avec identifiant d'opération ; sans réseau, enregistrée dans la file. |
| Session | `lib/api/auth.ts` (`meQueryOptions`), `components/auth/session-gate.tsx` | Sans réseau : identité locale vérifiée lors d'une connexion précédente. |
| Préparation | `lib/offline/preparation.ts`, page **Cet appareil** (`/appareil`) | Téléchargement des données autorisées et des pages. |
| Moteur | `components/offline-runtime.tsx` | Envois dus, retour du réseau, premier plan, déverrouillage. |
| Indicateur | `components/offline/device-status.tsx` | Hors connexion, modifications en attente, conflits, date des données, mise à jour. |
| Mises à jour | `components/service-worker-registration.tsx`, `lib/offline/app-update.ts` | Nouvelle version proposée, jamais forcée. |
| API | `apps/api/src/common/idempotency.interceptor.ts`, modèle `ClientOperation` | Rejeu sans doublon, réservation, conflits. |

TanStack Query reste le gestionnaire d'état ; son cache mémoire n'est pas la base locale. Les requêtes s'exécutent en `networkMode: 'always'` : c'est `apiFetch` qui choisit réseau ou copie locale.

## 2. Matrice des fonctionnalités

**Local complet** : consultation ou préparation sans réseau. **Local provisoire** : enregistré sur l'appareil, effet officiel à la confirmation du serveur. **Serveur obligatoire** : impossible sans réseau (refus explicite : « Hors connexion : ces données ne sont pas encore disponibles sur cet appareil » ou action désactivée).

| Rubrique (rôle) | Local complet | Local provisoire | Serveur obligatoire |
| --- | --- | --- | --- |
| Tableau de bord (tous) | Dernières données préparées, indicateurs, échéances, activités | — | Indicateurs en temps réel |
| Bibliothèque, modules, leçons (routier, encadrement) | Liste (pages préparées), fiche du module, toutes les leçons, navigation, position de lecture ; images si « Télécharger avec les images » | — | Ressources externes et vidéos ; recherche et filtres non préparés |
| Progression, compétences, rattrapages, activités, résultats (routier) | Étape théorique et officielle connues, compétences, acquis, obligations, échéances, historique, résultats déjà communiqués | — | Nouveaux acquis, décisions de rattrapage |
| Évaluations (routier) | Liste, présentation, passation d'une copie **préparée en ligne** dans `/evaluations/:id/passer` | Remise locale (immuable), envoi à la synchronisation | Préparation (réservation 24 h), passation en ligne, correction, résultat |
| Routiers et fiches (encadrement) | Liste préparée, fiche complète, parcours, progression, dossier, historique d'équipe, observations | Création de fiche (identifiant provisoire), modification de la fiche (version de référence ; un matricule saisi reste soumis aux contrôles du serveur), observation | Changement d'étape, activation, rattachement de compte, modification d'observation |
| Équipes (encadrement) | Liste et membres | Changement d'affectation (équipe de référence) | Création, archivage d'équipe |
| Activités et présences (encadrement) | Programme, liste, détail, feuille de présence | Création d'activité, modification et compte rendu (révision de référence), statut, présences (statut de référence par ligne) | Import du programme |
| Responsables et mandats | Consultation des fonctions et mandats synchronisés | — (aucun brouillon de nomination : D116) | Nominations, reconductions, fins, délégations |
| Validation des contenus, corrections, examens | — | — | Tout (corrigés et barèmes jamais stockés sur l'appareil, D113) |
| Statistiques (encadrement) | Vue d'ensemble des parcours (tableau de bord) | — | Page Statistiques et ses filtres |

Opérations différables : `attendance.save`, `activity.create`, `activity.update`, `activity.status`, `observation.create`, `scout.create`, `scout.update`, `team.assign` (`OPERATION_TYPES`). Chacune exige localement la permission connue et est **revérifiée par le serveur à la réception** ; aucune ne valide un acquis ni ne change une étape.

## 3. Service worker `v4` (D114)

| Cache | Contenu | Stratégie |
| --- | --- | --- |
| `tesla-shell-v4` | `/connexion`, `/hors-ligne`, manifest, icônes, logo | Pré-cache à l'installation |
| `tesla-pages` | Coquilles HTML des pages visitées ou préparées (clé : chemin) | Réseau d'abord ; repli sur la copie du chemin |
| `tesla-rsc` | Charges RSC (clé : chemin + en-têtes du routeur, indépendante de `_rsc`) | Réseau d'abord ; repli exact ; sinon erreur → Next.js bascule sur une navigation complète |
| `tesla-static` | `/_next/static`, `/_next/image`, icônes, marque | Cache d'abord ; nettoyage des ressources plus référencées (`PRUNE_STATIC`) |

- Les pages Next.js de Tesla sont rendues sans cookie ni donnée : le HTML et les charges RSC sont des coquilles génériques, sans risque d'exposition entre comptes. Les routes dynamiques servent une coquille sans paramètres puis demandent le segment complet (`Next-Router-Segment-Prefetch: /_full`) : la préparation le précharge (le serveur redirige vers la bonne clé `_rsc`).
- Navigation sans réseau : page conservée ; `/` → `/connexion` (qui oriente vers le tableau de bord) ; page jamais préparée → `/hors-ligne` (« Page non disponible sans connexion »), seul cas de repli.
- Jamais intercepté : API (autre origine), `/api/*`, requêtes non GET.
- **Mises à jour** : une nouvelle version s'installe sans s'activer ; le bouton « Mettre à jour » de l'indicateur l'active (confirmation s'il reste des modifications en attente) puis recharge la page. Repli : rechargement après 3 s si l'ancienne version ne cède pas la main (application ouverte hors connexion). Ouverte hors connexion, l'application suit l'enregistrement existant et recherche les mises à jour au retour du réseau. IndexedDB n'est jamais touché.

## 4. Données locales (IndexedDB `tesla-academie`, version 2)

Aucun changement de schéma IndexedDB (aucune migration à risque) : les nouvelles données sont des enregistrements chiffrés supplémentaires du magasin `records`, préfixés par compte. Les modules et tentatives de la phase 5 sont lus tels quels.

| Magasin | Clé | Contenu |
| --- | --- | --- |
| `settings` | `vault` | En-tête historique (phase 5) : toujours accepté pour le compte qui l'a créé |
| `settings` | `vault:<userId>` | En-tête du coffre d'un compte : sel, bloc de contrôle chiffré (D111) |
| `settings` | `session` | Déverrouillage en cours : compte et clé AES **non exportable**, expiration (12 h) |
| `records` | `<owner>:identity` | Utilisateur vérifié par le serveur et date de vérification (D112) |
| `records` | `<owner>:q:<chemin>` | Copie d'une réponse GET (paramètres triés), date, opérations appliquées |
| `records` | `<owner>:op:<id>` | Opération en attente (§ 7) |
| `records` | `<owner>:meta:idmap` | Identifiants provisoires → identifiants serveur |
| `records` | `<owner>:meta:preparation`, `meta:preparation-pages` | Dernier rapport de préparation, pages préparées |
| `records` | `<owner>:module:<slug>`, `attempt:<id>`, `reading:<slug>` | Module avec images, copie d'évaluation (phase 5), position de lecture |

- Listage par préfixe sans lecture ni déchiffrement (`getAllKeys` sur un intervalle).
- Concurrence entre onglets : révision vérifiée dans la transaction (opérations, tentatives, modules) ; les copies de lecture sont simplement remplacées.
- **Jamais stockés** : session, mot de passe, phrase locale, réservations brutes hors paquet, corrigés, barèmes, corrections, revues de résultats, PDF (liste d'exclusion de `repository.ts`).
- Périmètre : chaque compte ne télécharge que ce que l'API lui renvoie (permissions serveur) ; un routier ne reçoit aucune fiche.

## 5. Coffre, identité locale et sécurité (D111, D112)

- **Un coffre par compte** sur l'appareil, déverrouillé par une phrase locale (12 caractères minimum, distincte du mot de passe, jamais transmise ; PBKDF2-SHA-256 600 000 itérations, AES-GCM 256, clé d'enregistrement liée comme donnée authentifiée). Ouvert à tous les rôles.
- Hors connexion, la phrase est essayée sur les coffres présents : aucune liste de comptes n'est affichée. Jamais de nouveau coffre par-dessus des données existantes d'un compte.
- **Déverrouillage conservé 12 h** dans IndexedDB (clé non exportable) pour permettre rechargements, navigation et réouverture sans ressaisie ; supprimé au verrouillage, à la déconnexion et au changement de compte. Pendant cette période, quiconque utilise le profil du navigateur peut lire les données : verrouiller avant de prêter l'appareil.
- **Identité locale** : enregistrée à chaque vérification serveur (`/auth/me`, connexion, déverrouillage en ligne). Utilisée **uniquement sans réseau** et pendant **14 jours** au plus (`OFFLINE_ACCESS_MAX_DAYS`, à valider) ; horloge antérieure à la vérification → refus. Au-delà, les données restent chiffrées mais ne sont plus affichées.
- **Mandats** : `GET /auth/me` expose `authorityValidUntil` (fin du mandat ou de la plus proche délégation). Passée cette date, l'identité locale perd les permissions du mandat (permissions du rôle sans mandat), même hors connexion.
- Une identité locale ne crée **jamais** de session serveur ni de droit : l'interface masque seulement ; chaque opération est revérifiée à la réception (session, permissions effectives du jour, règles métier).
- **Refus explicite du serveur** (401) : jamais d'usage local ; reconnexion demandée, opérations conservées. Un autre compte connecté verrouille le coffre ouvert.
- **Révocation pendant l'isolement** : un appareil sans réseau ne peut pas l'apprendre. Elle prend effet au premier contact (session refusée, opérations rejetées) ; la durée locale de 14 jours borne l'exposition.

## 6. Préparation de l'appareil (D115)

Page **Cet appareil** (menu utilisateur) :
1. Connexion en ligne ; 2. activation ou déverrouillage du coffre ; 3–5. « Préparer cet appareil » : données autorisées par rôle (via les requêtes des écrans : tableaux de bord, bibliothèque et toutes les leçons, parcours, évaluations disponibles, routiers et fiches, équipes, activités et feuilles de présence, programme, compétences, responsables), puis pages de l'application et segments RSC (service worker) ; 6. vérification ; 7. « Prêt pour une utilisation sans connexion » **seulement si** aucune donnée ni page indispensable ne manque, sinon « Préparation incomplète » avec le détail.

- « Vérifier » contrôle sans réseau que les pages préparées sont toujours présentes (éviction).
- Partiel : images des modules (« Télécharger avec les images »), recherches et filtres autres que les vues par défaut, pages jamais visitées ni préparées.
- Après un déploiement, mettre à jour la préparation (pages et segments de la nouvelle version).

## 7. Synchronisation (D110)

Chaque opération : identifiant (UUID), propriétaire, type, libellé, méthode et chemin, données validées par les schémas partagés, entité cible, identifiant provisoire éventuel, dépendances, date locale, état, nombre d'envois, prochaine tentative, dernière erreur et code serveur, réponse.

États : `LOCAL` → `EN_ATTENTE` → `EN_COURS` → `SYNCHRONISE` | `CONFLIT` | `REJETE`.

- **Idempotence** : l'en-tête `x-tesla-operation-id` accompagne aussi la première tentative en ligne. Le serveur réserve l'identifiant (compte, méthode, chemin, empreinte SHA-256 du corps) avant l'exécution normale, enregistre la réponse, la renvoie à un second envoi identique ; autre contenu ou autre compte → `409 OPERATION_ID_REUSED` ; envoi concurrent → `409 OPERATION_IN_PROGRESS` (réessai) ; réservation restée sans réponse plus de 2 min → `409 OPERATION_UNCONFIRMED` (vérification humaine, jamais de rejeu aveugle). Une erreur libère l'identifiant (la transaction métier a été annulée).
- **Ordre et dépendances** : opérations envoyées par date ; une opération dépend des précédentes sur la même entité et des créations dont elle utilise l'identifiant provisoire. Une dépendance en conflit ou rejetée bloque la suivante (`CONFLIT` motivé).
- **Identifiants provisoires** : UUID local remplacé dans les chemins et corps après confirmation de la création.
- **Fusion** : deux saisies sur la même entité, pas encore envoyées, sont fusionnées (présences par ligne, champs de fiche ou d'activité) en gardant la **version de référence initiale**. Après confirmation d'une opération, la suivante est rebasée sur la version renvoyée (révision, `updatedAt`, équipe).
- **Affichage provisoire** : présences, fiche et activité modifiées sont appliquées à la copie locale de l'écran ; la copie serveur les remplace au rafraîchissement.
- **Classement des échecs** : réseau, 5xx, 429, `OPERATION_IN_PROGRESS` → `EN_ATTENTE` (5 s × 2ⁿ, 30 min max, 6 envois automatiques puis manuel) ; 401 → `EN_ATTENTE`, reconnexion au même compte ; 409 → `CONFLIT` ; autres 4xx → `REJETE`.
- **Déclenchements** : ouverture, retour du réseau (session revérifiée, copies remplacées), premier plan, déverrouillage, nouvelle opération, « Synchroniser maintenant ». Pas de Background Sync.
- **Conservation** : une opération non confirmée n'est jamais supprimée automatiquement (déconnexion, mise à jour, quota) ; seul « Abandonner » (confirmé) la retire. Les opérations confirmées sont nettoyées après 30 jours.
- Les copies d'évaluation conservent leur propre file et leur réception dédiée (§ 9).

## 8. Conflits

Pas de « dernière écriture gagnante » pour les données partagées : chaque écriture différée porte la version vue lors de la saisie.

| Situation | Détection | Résolution |
| --- | --- | --- |
| Deux membres modifient la même fiche | `expectedUpdatedAt` → `409 SCOUT_PROFILE_CHANGED` | Consulter la version à jour, puis refaire ou abandonner |
| Équipe changée pendant la coupure | `expectedTeamId` → `409 TEAM_ASSIGNMENT_CHANGED` | Idem |
| Présence saisie entre-temps par un autre | `expectedStatus` par ligne → `409 ATTENDANCE_CHANGED` (même statut : accepté) | Idem |
| Activité modifiée entre-temps | Révision (`409` existant) | Idem |
| Même opération reçue deux fois | Identifiant d'opération | Réponse enregistrée, aucun doublon |
| Évaluation déjà remise sur un autre appareil | `409 OFFLINE_ALREADY_RECEIVED` (phase 5) | Copie locale conservée, statut officiel consultable |
| Module remplacé par une nouvelle version | Lecture : la copie locale reste la version téléchargée ; évaluation : corrigée sur la version réservée | Mise à jour proposée, jamais imposée |
| Mandat expiré avant synchronisation | Permissions recalculées par le serveur → `403` → `REJETE` ; localement, permissions retirées après `authorityValidUntil` | Opération conservée jusqu'à abandon |
| Routier atteignant 21 ans pendant la coupure | Sortie calculée par le serveur (D95) : écritures refusées selon les règles existantes | Idem ; l'affichage local reste celui de la dernière copie |
| Compétence validée sur le serveur | Aucune décision officielle n'est différable | — |
| Doublon possible à la création d'une fiche | `409 POSSIBLE_DUPLICATE` → `CONFLIT` | Abandonner puis créer en ligne avec confirmation |

Une saisie refusée reste sur l'appareil (`CONFLIT`/`REJETE`, message du serveur) jusqu'à « Réessayer » ou « Abandonner ».

## 9. Évaluations (D117, garanties D77–D81 inchangées)

- Intégrées aux écrans habituels : « Préparer pour passer sans connexion » sur la présentation (`/evaluations/:id/preparer`, en ligne obligatoire), puis passation dans **`/evaluations/:id/passer`**, qui reprend la copie de l'appareil avec ou sans réseau ; « Reprendre sur cet appareil » sur la présentation.
- Sans réseau et sans copie préparée : aucune tentative ne peut être ouverte (message explicite) ; pas de brouillon non officiel (une réservation serveur reste nécessaire).
- Inchangé : version exacte, aucun corrigé dans le paquet, sauvegarde et reprise locales, remise locale immuable, réception transactionnelle et idempotente, revérification des droits, correction objective serveur, validation humaine.
- **Réservation de 24 h** : étudiée, conservée. La prolonger exposerait davantage une copie sans contrôle de droits ; la raccourcir pénaliserait les sorties sans réseau. À arbitrer avec D78 (durée configurable par évaluation envisageable).

## 10. Interface (D116)

- Plus d'onglet « Hors ligne » : la navigation est identique avec ou sans réseau. La gestion de l'appareil est dans le menu utilisateur (**Cet appareil**). `/telechargements` et `/synchronisation` redirigent vers `/appareil`.
- Indicateur discret dans le cadre, affiché seulement s'il est utile : « Hors connexion », « 3 modifications en attente », « Conflit à résoudre », « Données du 30/10 09:29 », « Mettre à jour ».
- Une écriture différée affiche « Enregistré sur cet appareil — En attente de synchronisation : rien n'est encore officiel ».

## 11. Stockage et confidentialité

- Estimation affichée (`navigator.storage.estimate`), « Demander la conservation durable » (`persist()`, sans garantie).
- Quota dépassé : message explicite ; aucune opération ni copie d'évaluation n'est supprimée pour libérer de l'espace.
- Appareil partagé : un coffre par compte, verrouillage manuel et à la déconnexion, changement de compte verrouillant le précédent.
- Le navigateur peut effacer le stockage (nettoyage, désinstallation, Safari iOS après 7 jours sans usage) : synchroniser avant toute manipulation ; les données non synchronisées seraient perdues.
- Métadonnées non chiffrées : identifiants de compte et chemins d'API dans les clés, tailles, nombre d'enregistrements.

## 12. Compatibilité et limites

| Fonction | Exigence | Dégradation |
| --- | --- | --- |
| Service worker | Production, HTTPS (ou `localhost`) | Application utilisable en ligne |
| IndexedDB, Web Crypto | Contexte sécurisé | Usage sans connexion indisponible, message explicite |
| `BroadcastChannel` | Optionnel | Verrouillage limité à l'onglet courant |

Limites connues :
- Recherche, filtres et pages de liste au-delà des vues préparées : non disponibles sans réseau.
- Brouillons de nomination ou de délégation : non prévus (D116).
- Fenêtre résiduelle : arrêt du serveur entre l'effet métier et l'enregistrement de la réponse → `OPERATION_UNCONFIRMED`, vérification humaine.
- Révocation inconnue tant que l'appareil reste isolé (borne : 14 jours).
- Après un déploiement, les pages non revisitées restent celles de la version préparée tant que la préparation n'est pas mise à jour.

## 12 bis. Corrections du 2026-10-30 (préparation à la production)

- **Appareil partagé** : la session serveur est confirmée avant toute lecture (connexion et `/auth/me`) ; le coffre ouvert d'un autre compte est verrouillé (AUD-002).
- **Lectures strictes** (`withStrictReads`) pendant la préparation et le téléchargement d'un module : ni repli sur une ancienne copie, ni copie non enregistrée comptée comme réussie ; « Prêt » reflète l'état réel (AUD-008).
- **File d'opérations** : une écriture mise en file après un envoi interrompu (`sent`) n'est plus fusionnée ; elle compte comme un essai (AUD-009).
- Pages de création et de modification de fiche préparées (AUD-010).
- Après un 401, la dernière réponse `/auth/me` est retirée du cache : plus de boucle `/connexion` ↔ page protégée (AUD-006).
- Première installation du service worker : plus de rechargement (la saisie en cours est conservée) ; seule une mise à jour acceptée recharge (AUD-007).
- `/users` (gestion des comptes) exclu du coffre.

Restent ouverts : phrase oubliée, verrou entre onglets, version de format IndexedDB, échéance locale des réservations, détection d'éviction ([PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md) AUD-019 à AUD-024).

## 13. Recette navigateur

```bash
# 1. Base de test, fixture fictive (remise à zéro de la base « _test »)
cd apps/api && TEST_DATABASE_URL=…/tesla_test OFFLINE_FIXTURE=/chemin/fixture.json npx tsx test/offline-browser-fixture.mts
# 2. API de production sur tesla_test (port 4000) et web de production sur http://localhost:3000
# 3. Scénario (Playwright non installé dans le dépôt : module et Chromium fournis par variables)
PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… OFFLINE_FIXTURE=… \
PROFILE_DIR=/chemin/profil SW_FILE=$PWD/apps/web/public/sw.js [VIEWPORT_WIDTH=1280] \
node apps/web/test/offline-first.browser.mjs
```

`SW_FILE` active le contrôle de mise à jour (le fichier est modifié puis restauré pendant le test). La recette est exécutée par la CI (job `browser`) avec Playwright installé à la volée ; la recette des comptes (`apps/web/test/accounts.browser.mjs`) suit la même procédure.
