# Mot de passe unique en ligne et hors connexion (refonte lot 3, D180)

**Principe** : un compte Tesla = **un seul mot de passe**. En ligne, il authentifie la personne auprès du serveur. Hors connexion, sur un appareil **préparé au préalable**, le même mot de passe **déverrouille localement** les données déjà téléchargées. Aucun second mot de passe, aucun code PIN, plus de « phrase locale ».

Le déverrouillage hors connexion n'est **pas** une authentification : rien n'est vérifié par le serveur, aucune session n'est créée, aucun droit n'est accordé. Chaque écriture différée reste revérifiée par le serveur au retour du réseau (D110, D133).

## 1. Authentification en ligne (inchangée)

Sessions opaques en cookie `httpOnly` (`SameSite=Lax`, `Secure` en production), mots de passe hachés par **Argon2id** côté API, en-tête anti-CSRF sur toute écriture, limitation persistante des tentatives (D165). Changement de mot de passe : les autres sessions sont fermées ; réinitialisation : toutes les sessions sont fermées (`account-self.service.ts`).

## 2. Coffre local (format 3)

```
IndexedDB « tesla-academie »
  settings / vault:<userId>   en-tête du coffre (format 3)
     salt, iterations          PBKDF2-SHA-256, sel aléatoire de 16 octets propre à l'appareil, 600 000 itérations
     password : Cipher         DEK encapsulée par la clé dérivée du mot de passe
     device   : {id, Cipher}   DEK encapsulée par la clé de l'appareil (remise par le serveur)
     check    : Cipher         { ownerId } chiffré par la DEK (contrôle d'appartenance)
  records / <userId>:<id>      enregistrements chiffrés par la DEK (AES-GCM 256, donnée authentifiée = clé)
  settings / session           déverrouillage en cours : DEK non exportable, échéance, dernière activité
API PostgreSQL
  offline_devices              par appareil : clé aléatoire de 32 octets, libellé, dates, révocation
```

- **DEK** (clé de données) : AES-GCM 256 générée aléatoirement par `crypto.subtle.generateKey` à la préparation. Elle n'est exportable qu'au moment exact de son encapsulation (création, reprotection) ; la clé utilisée pendant la session est importée **non exportable**.
- **Encapsulation** : `crypto.subtle.wrapKey('raw', DEK, KEK, AES-GCM)` avec donnée authentifiée liée au coffre et à l'usage (`vault:<id>:password`, `vault:<id>:device:<deviceId>`) : un bloc ne peut pas être réutilisé pour un autre compte ou un autre usage.
- **KEK mot de passe** : `PBKDF2-SHA-256(mot de passe, sel de l'appareil, 600 000)`. Argon2id n'existe pas dans Web Crypto ; une implémentation WebAssembly ajouterait une dépendance cryptographique à auditer et à charger hors ligne : PBKDF2 est retenu (recommandation OWASP 2023 pour SHA-256). Le nombre d'itérations est enregistré dans l'en-tête (évolutif).
- **Clé d'appareil** : 32 octets aléatoires générés par l'API (`randomBytes`), conservés dans `offline_devices`, **remis uniquement à une session valide** du titulaire (`POST /auth/offline-devices/:id/key`, `Cache-Control: no-store`). Elle n'est jamais conservée en clair sur l'appareil : elle sert à décapsuler puis est oubliée.
- Aucun algorithme maison : uniquement les primitives Web Crypto (`lib/offline/vault-crypto.ts`).

**Jamais stockés** : le mot de passe (ni en clair, ni sous forme réversible), une clé de déchiffrement dans `localStorage`, un secret dans le cache du service worker, un jeton permanent. Seuls des témoins sans valeur secrète vont dans `localStorage` (présence d'un coffre pour la détection d'effacement, verrouillage manuel).

## 3. Parcours

| Situation | Comportement |
| --- | --- |
| **Préparation** | À la connexion, case « Utiliser aussi cet appareil sans connexion » (appareil personnel), ou « Cet appareil » → « Préparer cet appareil » (mot de passe revérifié par le serveur pour éviter une faute de frappe). L'API enregistre l'appareil et remet sa clé ; la DEK est créée et encapsulée deux fois ; la préparation télécharge ensuite les données autorisées et les pages (« Prêt pour une utilisation sans connexion » seulement si rien d'indispensable ne manque, inchangé). |
| **En ligne, session valide** | Le coffre s'ouvre **sans saisie** grâce à la clé de l'appareil (la session prouve l'identité). Un verrouillage manuel (« Verrouiller ») tient jusqu'à la prochaine saisie du mot de passe. |
| **Connexion en ligne** | Le mot de passe que le serveur vient de vérifier ouvre le coffre. S'il a changé depuis (autre appareil, réinitialisation), la DEK est obtenue par la clé d'appareil et **reprotégée par le nouveau mot de passe** : aucune donnée perdue, l'ancien mot de passe n'ouvre plus rien sur cet appareil. |
| **Hors connexion** | « Vous utilisez Nikola Tesla Académie hors ligne. » Un seul champ : le mot de passe habituel, essayé sur les coffres présents (aucune liste de comptes). Succès → identité locale (≤ 14 jours, D112) et données préparées. Échec → « Mot de passe incorrect. » + rappel qu'un changement fait ailleurs n'est connu qu'à la prochaine connexion. Au-delà de 3 échecs, attente croissante (1 s → 30 s). |
| **Changement depuis cet appareil** (« Mon compte ») | Après la confirmation du serveur, la DEK est reprotégée par le nouveau mot de passe (ancien mot de passe ou clé d'appareil). |
| **Changement depuis un autre appareil** | Le serveur ferme les autres sessions. Hors connexion, cet appareil ne peut pas le savoir : l'**ancien** mot de passe l'ouvre encore jusqu'à la prochaine connexion (limite assumée, bornée par les 14 jours d'identité locale). À la connexion suivante avec le nouveau mot de passe : reprotection automatique. |
| **Mot de passe oublié** | Réinitialisation en ligne obligatoire (inchangée, toutes les sessions fermées). À la connexion suivante avec le nouveau mot de passe, la clé de l'appareil reprotège le coffre : les données non synchronisées sont conservées. Si l'appareil a été retiré entre-temps, ses données ne peuvent plus être déchiffrées (effacement expliqué). Aucun contournement. |
| **Appareil perdu ou prêté** | « Cet appareil » → « Appareils préparés » → **Retirer** (ou `POST /auth/offline-devices/:id/revoke`). La clé n'est plus jamais remise. Dès que l'appareil retiré se reconnecte (session encore valide), ses deux protections sont **détruites** : données illisibles, effacement proposé. Tant qu'il reste hors connexion, il ne peut pas l'apprendre : changer aussi son mot de passe. |
| **Déconnexion** | Coffre verrouillé ; données et modifications non synchronisées **conservées** (jamais d'effacement silencieux). |
| **Changement d'utilisateur** | Un coffre par compte ; la connexion d'un autre compte verrouille le coffre ouvert ; chacun son mot de passe. |
| **Effacement** | « Effacer les données de cet appareil » : nombre d'éléments annoncé, consentement explicite, perte des modifications non synchronisées annoncée ; l'appareil est retiré côté serveur s'il est joignable. Les autres coffres ne sont pas touchés. |
| **Ancien coffre à phrase locale** | Toujours lisible hors connexion avec l'ancienne phrase. En ligne, « Cet appareil » propose une **conversion unique** : ancienne phrase + mot de passe → enregistrements rechiffrés par une nouvelle DEK, ensuite seul le mot de passe est demandé. Phrase oubliée → effacement expliqué. |

## 4. Verrouillage et durées

- Déverrouillage conservé (rechargements, navigation hors connexion) : **12 h au plus** ; **verrouillage après 2 h sans activité** (clavier ou toucher, enregistrée au plus une fois par minute).
- Identité locale utilisable hors connexion : **14 jours** après la dernière vérification serveur (`OFFLINE_ACCESS_MAX_DAYS`, D112, à valider).
- Ces durées sont des valeurs de départ (D111, D112, D180) à valider par le responsable.

## 5. Modèle de menace

| Menace | Protection | Limite |
| --- | --- | --- |
| Personne qui emprunte l'appareil verrouillé | Mot de passe requis ; données chiffrées | — |
| Appareil laissé déverrouillé | Verrouillage manuel, après 2 h d'inactivité, au plus 12 h | Pendant la session, la clé (non exportable) est utilisable par quiconque utilise le profil du navigateur |
| **Vol de l'appareil et extraction du coffre** | AES-GCM, PBKDF2 600 000 itérations, sel par appareil | **Attaque hors ligne par dictionnaire possible** contre un mot de passe faible : la limitation des essais dans l'interface ne protège pas contre une copie des fichiers. Seuls la robustesse du mot de passe (longueur minimale imposée à la création du compte) et le retrait rapide de l'appareil limitent le risque. Pendant les 12 h d'un déverrouillage, la DEK figure dans le stockage du navigateur (non exportable par script, mais présente dans les fichiers du profil). |
| Appareil retiré qui reste hors connexion | Aucune (il ne peut pas l'apprendre) | Changer le mot de passe ; les données restent lisibles avec l'ancien jusqu'à la reconnexion (≤ 14 jours d'affichage) |
| Fuite de la base serveur | Les clés d'appareil seules ne déchiffrent rien sans une copie du coffre de l'appareil | Base + appareil compromis ensemble = données lisibles (elles sont de toute façon une copie de données du serveur) |
| Autre compte sur le même navigateur | Un coffre et une DEK par compte ; données authentifiées liées au compte | Métadonnées non chiffrées (identifiants de compte et chemins dans les clés, tailles) |
| Script injecté (XSS) | CSP, rendu sans HTML, clés non exportables | Un script dans la page pendant une session ouverte peut lire les données déchiffrées |

## 6. Synchronisation (inchangée, D110)

Au retour du réseau : session revérifiée (`/auth/me`), coffre ouvert par la clé d'appareil s'il était fermé, appareil revérifié (retrait), opérations envoyées dans l'ordre avec leur identifiant d'idempotence, conflits et rejets conservés, rien n'est confirmé avant la réponse du serveur, rien n'est supprimé avant sa persistance. Session expirée : reconnexion demandée, opérations conservées.

## 7. API

| Route | Rôle |
| --- | --- |
| `GET /auth/offline-devices` | Appareils du titulaire (libellé, dates, retrait ; jamais la clé) |
| `POST /auth/offline-devices` `{label}` | Enregistre l'appareil, remet sa clé (201, `no-store`) ; 10 appareils actifs au plus (`409 OFFLINE_DEVICE_LIMIT`) |
| `POST /auth/offline-devices/:id/key` | Clé d'un appareil actif du titulaire (`no-store`) ; `404` (autre compte), `410 OFFLINE_DEVICE_REVOKED` |
| `POST /auth/offline-devices/:id/revoke` | Retrait définitif et idempotent, journalisé |

Migration additive `20261118090000_offline_devices` (table + contrainte `octet_length(key_material) = 32`). Aucune donnée existante modifiée.

## 8. Tests

- Unitaires : `vault-crypto.test.ts` (mot de passe juste/faux, liaison au coffre, reprotection par la clé d'appareil, clé étrangère, altération).
- Intégration : `offline-devices.int-spec.ts` (clé de 32 octets non mise en cache, isolation entre comptes, retrait 410, limite, changement de mot de passe ailleurs : ancienne session refusée, nouvelle connexion acceptée).
- Navigateur : `apps/web/test/offline-auth.browser.mjs` (17 contrôles, voir [UX_ACCEPTANCE_TESTS.md](../QUALITY/UX_ACCEPTANCE_TESTS.md)) ; `offline-first.browser.mjs` et `catalogue-lecture.browser.mjs` adaptés au mot de passe.

## 9. Limites connues

- Premier usage hors connexion impossible sans préparation en ligne préalable (par construction).
- Révocation et changement de mot de passe inconnus d'un appareil isolé jusqu'à sa reconnexion.
- PBKDF2 plutôt qu'Argon2id (disponibilité native) ; coût d'ouverture ≈ 0,5–1,5 s sur un téléphone d'entrée de gamme (à mesurer en préproduction).
- Le navigateur peut effacer le stockage (Safari iOS après 7 jours sans usage) : synchroniser avant.
- Un mot de passe faible reste le point faible face au vol de l'appareil.
