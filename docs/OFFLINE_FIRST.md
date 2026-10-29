# Stratégie hors ligne (PWA) — phase 5

Référence unique du hors ligne : stockage, cache, versions, autorisations, synchronisation, conflits, limites. Décisions : D76 à D83 dans [DECISIONS.md](DECISIONS.md).

Public visé : **routiers disposant d'un compte**. Les routiers sans compte restent suivis par les chefs avec les supports papier.

## 1. Vue d'ensemble

| Élément | Fichier | Rôle |
| --- | --- | --- |
| Manifest, icônes | `apps/web/src/app/manifest.ts`, `public/icons/` | Installation lorsque le navigateur le propose |
| Service worker `v2` | `apps/web/public/sw.js` (production uniquement) | Coquille publique `/hors-ligne` et ressources statiques |
| Coquille hors ligne | `/hors-ligne` (alias `/telechargements`, `/synchronisation`) → `OfflineHub` | Téléchargements, lecture, tentatives, synchronisation, stockage, confidentialité |
| Préparation | `/evaluations/[id]/preparer` | Réservation serveur d'une tentative hors ligne |
| Stockage local | `src/lib/offline/db.ts` (IndexedDB), `vault.ts` (chiffrement) | Données locales chiffrées par compte |
| Téléchargements | `src/lib/offline/downloads.ts`, `components/download-module-button.tsx`, `offline-reader.tsx` | Paquet de module, images, lecture |
| Tentatives et file | `src/lib/offline/attempts.ts`, `components/offline-attempt.tsx`, `offline-runtime.tsx` | Saisie, remise locale, envoi, réessais |
| API | `apps/api/src/modules/evaluations/offline.*.ts`, `pedagogy/module-catalog.*` | Paquets, réservation, réception idempotente, statut |

Le serveur (PostgreSQL) reste l'unique source officielle. Aucun statut local n'est présenté comme un résultat.

## 2. Service worker et cache

- **Pré-cache** à l'installation : `/hors-ligne`, manifest, icônes, logo, puis les ressources `/_next/static/…` référencées par cette coquille (lecture du HTML pré-caché).
- **Navigation** : réseau d'abord ; en cas d'échec, la coquille `/hors-ligne`. Aucune autre page HTML n'est mise en cache.
- **Statique versionné** (`/_next/static/`, `/icons/`, `/brand/`) : cache d'abord.
- **Jamais intercepté ni mis en cache** : `/api/*`, `/connexion`, toute requête non GET, toute autre origine (l'API est sur une origine distincte). Les réponses de l'API hors ligne portent `Cache-Control: no-store`.
- La coquille `/hors-ligne` est publique et générique : elle ne contient aucune donnée de compte ; tout contenu privé est lu dans le coffre local déverrouillé.
- Changer `VERSION` purge les anciens caches `tesla-*`.

## 3. Stockage local (IndexedDB `tesla-academie`, version 2)

| Magasin | Clé | Contenu |
| --- | --- | --- |
| `settings` | `vault` | En-tête du coffre : sel, bloc de contrôle chiffré contenant l'identifiant du propriétaire, révision |
| `records` | `<ownerId>:module:<slug>` | Module téléchargé (chiffré) |
| `records` | `<ownerId>:attempt:<attemptId>` | Paquet d'évaluation, réponses et état de synchronisation (chiffrés) |

Correspondance avec les collections conceptuelles : `downloadedModules`, `downloadedLessons`, `downloadedAssets` sont regroupés dans l'enregistrement `module:` (paquet, images en octets, ressources indisponibles, date de téléchargement, version exacte `versionId`, taille estimée, dernière consultation, position de lecture) ; `offlineEvaluationPackages`, `offlineAttempts`, `offlineAnswers`, `syncQueue`, `syncMetadata` sont regroupés dans l'enregistrement `attempt:` (paquet, réponses, statut, `operationId`, date de création, nombre d'envois, prochaine tentative, dernière erreur, dernier statut serveur). Un enregistrement par objet : écriture atomique, pas d'orphelin.

- **Versionnement** : `OFFLINE_DB_VERSION = 2`. La migration crée les magasins absents ; les magasins v1 (`modules`, `lessons`, `syncQueue`), jamais utilisés, restent intacts. Changement d'onglet concurrent : `onversionchange` ferme la connexion, `onblocked` affiche un message.
- **Concurrence entre onglets** : chaque enregistrement porte une `revision` vérifiée dans la transaction d'écriture (échec explicite en cas de conflit).
- **Quota** : `QuotaExceededError` est traduit en message clair ; aucune réponse n'est supprimée pour libérer de l'espace.

### Chiffrement applicatif (coffre local)
- Phrase locale d'au moins 12 caractères, **distincte du mot de passe**, jamais envoyée au serveur.
- Dérivation PBKDF2-SHA-256 (600 000 itérations, sel aléatoire), chiffrement AES-GCM 256 avec IV aléatoire ; la clé de l'enregistrement est liée comme donnée authentifiée (un enregistrement ne peut pas être déplacé vers un autre).
- La clé n'existe qu'en mémoire, jamais dans IndexedDB. Verrouillage manuel, à la déconnexion et diffusé aux autres onglets (`BroadcastChannel`).
- Un coffre par profil de navigateur, lié au premier compte routier qui l'active. Un autre compte doit utiliser un autre profil de navigateur.
- Nécessite un contexte sécurisé (HTTPS ou `localhost`). Phrase oubliée : données irrécupérables.

## 4. Téléchargement des modules

1. Le routier connecté déverrouille son coffre puis choisit « Télécharger pour lire hors ligne » sur un module publié (tout module publié, quelle que soit son étape).
2. `GET /modules/:slug/offline-package` renvoie la version publiée exacte (`versionId`), son contenu complet et une empreinte SHA-256, vérifiée dans le navigateur.
3. Les images des leçons sont téléchargées une à une (sans cookie, sans référent, 20 s maximum, PNG/JPEG/WebP/GIF/AVIF, 3 Mo par image, 30 Mo par module). Progression affichée.
4. Contrôle d'espace préalable avec `navigator.storage.estimate()` lorsque disponible (marge ×8) ; sinon le quota est détecté à l'écriture.
5. **Écriture unique en fin de téléchargement** : un téléchargement interrompu ou une image en échec n'écrit rien ; la version précédente reste intacte. La reprise consiste à recommencer proprement.
6. Ressources externes et vidéos : listées comme « indisponibles hors ligne », jamais téléchargées.
7. Double téléchargement : bloqué pendant l'opération ; une version déjà présente n'est pas retéléchargée.
8. Suppression locale après confirmation ; les tentatives sont conservées.

### Versions
- « Vérifier les versions » compare la version locale à la version publiée (`GET /modules/:slug`) et propose la mise à jour, jamais appliquée automatiquement ; le remplacement demande une confirmation.
- Une tentative reste liée au `evaluationVersionId` réservé : une nouvelle publication ne modifie ni le questionnaire local ni la correction (le serveur corrige avec les questions de la version réservée).
- Aucune publication ni modification de contenu hors ligne.

### Lecture
Lecture des leçons, navigation, images conservées, références, position et date de dernière lecture enregistrées localement. Rendu par `LessonContent` (liste blanche JSON, aucun HTML interprété). Une lecture locale n'est jamais présentée comme un acquis.

## 5. Évaluations hors ligne

### Préparation (en ligne obligatoire)
`POST /offline/evaluations/:id/prepare`, dans une transaction verrouillant le profil :
- identité, rôle (`evaluation.take`), profil routier lié au compte ;
- évaluation publiée, éligibilité serveur (étape ou dérogation active), limite de tentatives ;
- tentative ouverte : la réservation hors ligne valide du même compte est renvoyée (idempotent) ; toute autre tentative ouverte → `409 ATTEMPT_ALREADY_OPEN`.

Le serveur crée une tentative `HORS_LIGNE` / `EN_COURS` avec un code `NT-AAAA-NNNNNN`, une **autorisation opaque** (UUID aléatoire, unique, enregistrée en base) et une validité de **24 heures**. Le paquet contient : propriétaire, profil, tentative, évaluation, version exacte, questions sans corrigé ni barème détaillé, émission, expiration, politique. L'autorisation n'est pas un jeton d'authentification : elle n'est acceptée qu'avec la session du même compte et pour cette seule tentative.

### Saisie
Sauvegarde locale à chaque modification (indication « Réponses enregistrées sur cet appareil »), reprise après fermeture, remise locale confirmée puis **immuable** (statut `EN_ATTENTE`, message « En attente de synchronisation. Aucun résultat officiel »). Aucune correction locale, aucune réponse attendue disponible localement, aucune IA.

Les routes de passation en ligne (`/attempts/:id/answers`, `/attempts/:id/submit`) refusent les tentatives `HORS_LIGNE` (404) : une copie hors ligne ne peut être remise que par la synchronisation.

### Politique d'autorisation (D78)
- Droits vérifiés à la préparation **et** à la réception.
- La copie doit **parvenir au serveur** avant l'expiration ; l'heure déclarée par l'appareil n'est jamais utilisée pour décider.
- Expiration, dérogation révoquée, éligibilité perdue, tentative clôturée ou version indisponible → **rejet motivé** (pas de mise en attente) : décision enregistrée, tentative passée à `ANNULEE` (non comptée dans la limite de tentatives), réponses non enregistrées. La copie locale est conservée avec le statut `REJETE`.
- Horodatages distincts : émission (`offline_issued_at`), déclaration appareil (`offline_device_submitted_at`, indicatif), réception (`offline_received_at`), décision (`offline_decided_at`).
- Aucune validation d'acquis ni changement d'étape à la synchronisation.

**À valider humainement** : durée de 24 h, rejet plutôt que mise en attente en cas de révocation, conservation éventuelle côté serveur du contenu d'une copie rejetée pour examen par un chef.

## 6. Synchronisation

`POST /offline/attempts/:id/sync` avec `operationId`, `authorization`, `versionId`, `deviceSubmittedAt`, `answers` (schéma strict : tout champ supplémentaire, dont un score, est refusé).

Côté serveur, dans une transaction avec verrou de ligne :
1. tentative hors ligne du compte appelant uniquement (sinon 404/403) ;
2. autorisation et version identiques au paquet (sinon `409 OFFLINE_PACKAGE_CONFLICT`) ;
3. **idempotence** : `operationId` unique en base + empreinte SHA-256 de la charge. Même opération et même contenu → statut existant renvoyé, sans nouvelle écriture ; autre opération ou contenu → `409 OFFLINE_ALREADY_RECEIVED` (les réponses officielles ne sont jamais écrasées) ;
4. revérification des droits (§ 5) ;
5. copie complète exigée (`409 OFFLINE_INCOMPLETE` sinon) ; enregistrement des réponses, **correction objective serveur** (`gradeObjectiveQuestions`), statut `A_CORRIGER` pour la suite humaine habituelle.

Statut : `GET /offline/attempts/:id/status` et `GET /me/offline-sync/status` (`syncStatus` `LOCAL` | `SYNCHRONISE` | `REJETE`, code de décision, message, dates).

### File locale
États : `LOCAL` (saisie) → `EN_ATTENTE` (remise locale) → `EN_COURS` (envoi) → `SYNCHRONISE` | `REJETE` | `CONFLIT`. `SYNCHRONISE` n'est écrit qu'après réponse explicite du serveur.

| Situation | Classement local |
| --- | --- |
| Réseau absent, 5xx, 429 | `EN_ATTENTE`, réessai différé |
| 401 (session expirée) | `EN_ATTENTE`, arrêt des envois automatiques, reconnexion au **même compte** demandée |
| 409 (conflit de paquet, autre copie reçue, copie incomplète, tentative déjà ouverte) | `CONFLIT`, message affiché |
| Autres 4xx | `REJETE` |
| Décision serveur de rejet | `REJETE` avec code et message |
| Compte connecté différent du propriétaire du coffre | aucun envoi, coffre verrouillé |

Déclenchement : manuel, au retour du réseau (`online`), à l'ouverture de l'application, au retour au premier plan (`visibilitychange`), au déverrouillage. Pas de dépendance à Background Sync. Temporisation progressive 5 s × 2ⁿ plafonnée à 30 min, **6 envois automatiques au maximum** puis manuel uniquement ; aucun minuteur sans opération due. Un état `EN_COURS` laissé par une fermeture brutale est repris (le serveur déduplique).

Au retour du réseau, les requêtes TanStack Query actives en erreur sont relancées (une page ouverte hors réseau retrouve sa session).

### Conflits
| Cas | Réponse |
| --- | --- |
| Tentative déjà synchronisée (même copie) | Statut existant, aucun doublon |
| Copie différente déjà reçue (autre appareil) | `409 OFFLINE_ALREADY_RECEIVED` |
| Autorisation expirée / révoquée | Décision `AUTHORIZATION_EXPIRED` / `AUTHORIZATION_REVOKED` |
| Questionnaire archivé | Accepté si la version réservée est `PUBLIE` ou `ARCHIVE` ; sinon `VERSION_UNAVAILABLE` |
| Nouvelle version publiée | Correction sur la version réservée |
| Session expirée | 401, copie conservée |
| Compte désactivé | Session refusée (401) ; copie conservée |
| Réponses incompatibles (question étrangère, format) | 400, copie conservée en `REJETE` |
| Copie incomplète | `409 OFFLINE_INCOMPLETE` |
| Tentative d'un autre routier | 404 |

## 7. Déconnexion et confidentialité

- Déconnexion : avertissement si des copies ne sont pas synchronisées, puis verrouillage du coffre (clé effacée de la mémoire, autres onglets verrouillés), purge du cache TanStack, révocation de la session serveur. **Les copies chiffrées sont conservées** (aucune suppression silencieuse de réponses) ; elles ne sont lisibles qu'avec la phrase locale.
- Minimisation : pas de jeton de session (cookie httpOnly), pas de données d'autres routiers, pas de corrigé, pas de résultat détaillé hors ligne.
- Limites : pendant le déverrouillage, un appareil ou un navigateur compromis peut lire les données ; les métadonnées (nombre d'enregistrements, identifiant du propriétaire dans les clés, tailles) ne sont pas chiffrées ; le navigateur peut effacer le stockage (éviction, nettoyage, désinstallation). « Demander la conservation locale » appelle `navigator.storage.persist()`, sans garantie.

## 8. Compatibilité navigateur

| Fonction | Exigence | Dégradation |
| --- | --- | --- |
| Service worker | Production, HTTPS | Application utilisable en ligne |
| IndexedDB | Requise pour le hors ligne | Message « Stockage hors ligne indisponible » |
| Web Crypto (`crypto.subtle`) | Contexte sécurisé | Coffre refusé avec message explicite |
| `navigator.storage.estimate/persist` | Optionnelles | Estimation affichée comme indisponible |
| `BroadcastChannel` | Optionnelle | Verrouillage limité à l'onglet courant |
| Installation | Selon navigateur ; iOS via « Sur l'écran d'accueil » | Utilisation dans le navigateur |

**Vérifié** : Chromium headless (Playwright) en fenêtre 390 px. **Non vérifié** : Chrome Android, Safari iOS (éviction après 7 jours sans usage possible), Edge, Firefox, appareils physiques.

## 9. Récupération après échec

- Téléchargement en échec : rien n'est écrit, recommencer en ligne.
- Copie `EN_ATTENTE` après 6 échecs : « Synchroniser maintenant ».
- Session expirée : se reconnecter avec le même compte, déverrouiller, synchroniser.
- `CONFLIT` / `REJETE` : conserver la copie, contacter un chef ; consulter « Résultats officiels ».
- Phrase oubliée : données locales irrécupérables ; un chef peut proposer une nouvelle tentative (en ligne, hors ligne ou papier) selon les règles habituelles.

## 10. Recette navigateur

```bash
# 1. API de production sur tesla_test (port 4000) et web de production (port 3105, NEXT_PUBLIC_API_URL vers l'API)
# 2. Fixture fictive
cd apps/api && TEST_DATABASE_URL=…/tesla_test npx tsx test/offline-browser-fixture.mts
# 3. Scénario (Playwright requis, non installé dans le dépôt)
PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… node apps/web/test/offline.browser.mjs
```
