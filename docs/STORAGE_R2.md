# Stockage objet (Cloudflare R2) et sauvegardes externes

Décisions : D143 (fichiers applicatifs), D144 (sauvegardes). Code : `apps/api/src/storage/`, `apps/api/src/modules/pedagogy/module-files.*`, `apps/web/src/lib/api/files.ts`, `deploy/scripts/backup.sh`. Restauration : [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Déploiement : [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Audit du stockage (2026-11-02)

Constat principal : **aucun fichier n'était téléversé ni écrit durablement par l'application**. Les PDF sont produits en mémoire à chaque demande ; les images et ressources des leçons sont des adresses `https://` externes. Le seul stockage disque durable du VPS est celui des sauvegardes et des journaux. Aucune migration de fichiers locaux n'est donc nécessaire.

| Catégorie | Emplacement actuel | Mode actuel | Volume / fréquence | Confidentialité | Vers R2 ? | Hors ligne | Sauvegardes | Modification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Images et documents joints aux modules | — (n'existait pas : URL externes) | — | dizaines à centaines de fichiers, ≤ 5 Mo (image) / 20 Mo (PDF) ; ajouts ponctuels | interne (publié = tous les connectés) | **Oui** (nouveau) | en ligne uniquement, signalé | copie chiffrée du compartiment (§ 7) | module `storage`, table `stored_files`, ressource `file_id` |
| Images insérées dans le texte des leçons | JSON de la leçon, `src` https externe | URL externe | faible | publique (hébergeur tiers) | Non (inchangé) ; extension possible (§ 11) | téléchargées dans le coffre chiffré | contenu JSON dans PostgreSQL | aucune |
| PDF module imprimable (`module-pdf.ts`) | mémoire de l'API | généré à la demande, `StreamableFile` | quelques Ko–Mo, à la demande | publié | **Non** | non (impression en ligne) | inutile (régénérable) | aucune |
| PDF questionnaire / corrigé / grille papier (`paper-pdf.ts`) | mémoire de l'API | généré à la demande | idem | corrigé : encadrement seul | **Non** (corrigé jamais conservé) | non | inutile (régénérable depuis la version publiée) | aucune |
| PDF fiche médicale (`medical-pdf.ts`) | mémoire de l'API | déchiffré et généré à la demande pour le seul titulaire | rare | **sensible** | **Non** (D137 inchangée) | jamais | contenu chiffré dans PostgreSQL | aucune |
| Données métier (comptes, routiers, scores, réponses…) | PostgreSQL | tables | faible | variable | **Non** | coffre IndexedDB chiffré | dump chiffré | aucune |
| Métadonnées de fichiers | — | — | une ligne par fichier | interne | PostgreSQL (`stored_files`) | non | dump chiffré | migration additive |
| Paquets hors ligne, réponses, position de lecture | IndexedDB chiffré (appareil) | AES-GCM | ≤ 30 Mo par module | personnelle | **Non** | oui | non (appareil) | aucune |
| Coquille PWA | cache du service worker | pré-cache | Ko | publique | Non | oui | non | aucune |
| Sauvegardes PostgreSQL | `/var/backups/tesla/<instance>` (14 jours) + distant rclone (non choisi) | dump GnuPG | Mo, 2 par jour | **sensible** (chiffré) | **Oui** (compartiment dédié) | — | — | rétention locale réduite, alertes, contrôle par relecture |
| Journaux | journald (≤ 1 Go), Nginx (logrotate) | disque VPS | Mo / jour | interne | Non | — | non | aucune |
| Fichiers temporaires | `mktemp` des scripts de sauvegarde | supprimés en fin d'exécution | taille d'un dump | sensible | Non | — | — | contrôle d'espace libre avant dump |

### Écarts relevés et corrigés
- `deploy/scripts/backup.sh` : `pg_restore --list | grep -q` sous `pipefail` échoue par SIGPIPE dès que la liste dépasse le tampon du tube (reproduit pendant les tests) → `grep -c`.
- `deploy/scripts/verify-backup.sh` comptait `leadership_mandates` (gelée depuis D132) ; compte désormais `leadership_assignments`, `medical_records`, `stored_files` et tolère une table absente d'une ancienne sauvegarde.
- `deploy/env/production.env.example` ne mentionnait pas `MEDICAL_DATA_KEY`, pourtant obligatoire en production (démarrage refusé sans elle) : ajoutée, avec la consigne de la conserver hors du VPS.
- Les ressources IMAGE/DOCUMENT n'acceptaient qu'une URL externe : un fichier téléversé est désormais possible.

## 2. Architecture cible

| Composant | Conserve | Ne conserve pas |
| --- | --- | --- |
| VPS (Next.js, NestJS, PostgreSQL) | code, base, journaux, fichiers temporaires des scripts (supprimés) | contenu des fichiers téléversés (jamais reçu : envoi direct), sauvegardes au-delà de `BACKUP_RETENTION_DAYS` |
| PostgreSQL | données métier, `stored_files` (propriétaire, catégorie, nom normalisé, clé, compartiment, type, taille, SHA-256, statut, dates, auteur) | aucun binaire, aucune URL signée |
| R2 — `tesla-files-<env>` (privé) | objets des fichiers validés, clés `<préfixe>/module-resources/<AAAA>/<MM>/<uuid>` | aucun nom d'utilisateur dans les clés, aucun accès public |
| R2 — `tesla-backups` (privé, verrouillé) | dumps chiffrés GnuPG, empreintes, copie chiffrée (rclone crypt) des fichiers | aucune donnée en clair |
| IndexedDB (appareil) | coffre chiffré inchangé : paquets de modules (texte, images des leçons), réponses | aucune URL signée, aucun fichier joint R2 |

Un seul fournisseur est codé derrière le port `ObjectStorage` (`object-storage.ts`) : changer de fournisseur compatible S3 (MinIO, Scaleway, AWS) ne touche que `R2_ENDPOINT` et, au besoin, `s3-object-storage.ts`.

## 3. Téléversement (D143)

1. Le navigateur calcule le SHA-256 du fichier et envoie `{ fileName, mimeType, sizeBytes, sha256 }` à `POST /api/v1/editor/modules/:id/files`.
2. L'API vérifie session, CSRF, `module.write`, accès au module (auteur, collaborateur, responsable), existence d'une version `BROUILLON`, liste blanche (PNG, JPEG, WebP, GIF, PDF), cohérence extension ↔ type, plafonds (5 Mo image, 20 Mo PDF, `R2_UPLOAD_MAX_BYTES`), au plus 20 envois en attente par personne.
3. L'API crée la fiche `EN_ATTENTE` et renvoie une URL `PUT` signée (`R2_SIGNED_URL_EXPIRATION`, 300 s par défaut) dont la signature couvre `content-type`, `content-length` et `if-none-match: *` : autre type, autre taille ou écrasement d'un objet existant refusés par R2.
4. Le navigateur envoie le fichier directement à R2 (`credentials: 'omit'`, sans Referer) : le fichier ne transite ni par Nginx ni par Node.
5. `POST …/files/:fileId/complete` : l'API relit l'objet **en flux** (jamais en mémoire entière), contrôle présence, taille, signature binaire réelle et SHA-256. Conforme → `VALIDE` ; sinon objet supprimé et fiche `REJETE`. Une seconde confirmation renvoie le même résultat ; une confirmation concurrente ne valide qu'une fois.
6. La ressource est créée avec `fileId` (`POST …/resources`) : seul un fichier `VALIDE` du même module, de la nature annoncée, est accepté (contrôles applicatifs + `CHECK module_resources_url_or_file`).

Multipart : non implémenté (inutile sous 20 Mo ; à envisager seulement au-delà de 100 Mo).

## 4. Lecture et publication

`GET /api/v1/module-files/:fileId` → `302` vers une URL `GET` signée (5 min), `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. Accès accordé si :
- une ressource de la **version publiée** d'un module référence le fichier (toute personne connectée, règle pédagogique 1) ;
- sinon, la personne rédige le module propriétaire ou un module qui le référence (brouillon, versions antérieures).

Un objet présent dans R2 n'est donc jamais lisible du seul fait de son existence ; un brouillon reste invisible des routiers (404). Le type et la disposition sont imposés par l'URL signée : images `inline`, PDF `attachment` (jamais rendus dans l'origine de l'application). Nouvelle version et duplication recopient la **référence** : un objet validé est immuable (trigger `stored_files_guard`) et partagé.

## 5. Sécurité

| Exigence | Mesure |
| --- | --- |
| Compartiments privés | aucun domaine public ni accès `r2.dev` ; lecture par URL signée courte uniquement |
| Permissions avant chaque accès | `assertCan` + `resolveAccess` à chaque demande d'envoi, confirmation et lecture |
| Isolation | fichier d'un autre module refusé (404) ; confirmation réservée à l'auteur de l'envoi ou au responsable |
| Validation réelle | signature binaire + SHA-256 + taille relus côté serveur ; SVG, HTML, exécutables, archives refusés (liste blanche) |
| Path traversal / clés | clé générée par le serveur (`randomUUID`), `CHECK stored_files_storage_key_safe` ; nom d'origine normalisé, utilisé seulement comme nom de téléchargement (RFC 6266, sans injection d'en-tête) |
| Écrasement | `If-None-Match: *` signé ; identité de l'objet immuable en base (trigger) |
| CORS | compartiment : `PUT` depuis l'origine de l'application seulement (§ 6.3) |
| Journaux | ni URL signée, ni clé d'objet, ni clé d'accès : identifiant du fichier et code d'erreur du fournisseur seulement (testé) |
| Erreurs R2 | 503 `FILE_STORAGE_ERROR` sans détail ; non configuré : 503 `FILE_STORAGE_UNAVAILABLE` |
| Objets abandonnés | `jobs:daily` supprime les envois non confirmés 1 h après expiration (`ABANDONNE`) et réessaie la suppression des rejets |
| Suppression accidentelle | les fiches `stored_files` ne sont jamais supprimées (trigger) ; l'application n'efface que des objets jamais validés ; les fichiers validés sans référence depuis 7 jours sont **signalés** (journal du traitement quotidien), leur effacement reste une décision humaine |
| Cache | URL de lecture `private, max-age=<durée de l'URL>` ; redirection API `no-store` ; service worker : `/api` exclu, R2 hors origine (non intercepté) |

## 6. Configuration Cloudflare (opérations manuelles)

Aucune ressource Cloudflare n'a été créée par le développement. À faire par l'administrateur, par environnement :

### 6.1 Compartiments
| Compartiment | Usage | Emplacement | Accès public |
| --- | --- | --- | --- |
| `tesla-files-production` | fichiers applicatifs | indice de localisation « WEUR » ou automatique (à choisir) | **désactivé** |
| `tesla-files-preproduction` | idem préproduction | idem | désactivé |
| `tesla-files-dev` | développement (facultatif) | idem | désactivé |
| `tesla-backups` | sauvegardes (préfixes `production/`, `preproduction/`, `production-files/`) | idem | désactivé |

Tableau de bord → R2 → *Create bucket* ; ne jamais activer *Public access* ni un domaine personnalisé.

### 6.2 Jetons d'API (R2 → *Manage API tokens*)
| Jeton | Permission | Portée | Où |
| --- | --- | --- | --- |
| `tesla-app-production` | Object Read & Write | `tesla-files-production` seul | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` de `/etc/tesla/production.env` |
| `tesla-app-preproduction` | Object Read & Write | `tesla-files-preproduction` seul | `/etc/tesla/preproduction.env` |
| `tesla-backup-writer` | Object Read & Write | `tesla-backups` seul | remote rclone `r2-backup` (utilisateur `tesla`) |
| `tesla-files-reader` | Object Read only | `tesla-files-production` | remote rclone `r2-files-ro` (copie des fichiers) |
| `tesla-backup-restore` | Object Read only | `tesla-backups` | poste d'administration uniquement |

Le jeton applicatif ne peut pas atteindre les sauvegardes ; le jeton de sauvegarde ne peut pas supprimer les objets verrouillés (§ 6.4).

### 6.3 CORS du compartiment applicatif (R2 → compartiment → *Settings* → *CORS policy*)
```json
[
  {
    "AllowedOrigins": ["https://<domaine>"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "if-none-match"],
    "MaxAgeSeconds": 3600
  }
]
```
Préproduction : son propre domaine, sur son propre compartiment. Développement : `http://localhost:3000`. Aucune règle `GET` n'est nécessaire (navigation et `<img>` ne sont pas soumis à CORS).

### 6.4 Compartiment des sauvegardes
- **Bucket lock** (R2 → `tesla-backups` → *Settings* → *Bucket lock rules*) : préfixe `production/`, rétention **30 jours** (proposition) ; une compromission du VPS ne peut pas effacer les sauvegardes récentes.
- **Object lifecycle** : suppression après **90 jours** des préfixes `production/` et `preproduction/` (proposition, cf. [BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 1) ; aucune suppression pour `production-files/` tant que la politique de conservation des fichiers n'est pas décidée.
- Compartiment applicatif : règle de cycle de vie *Abort incomplete multipart uploads* après 1 jour (protection, sans effet aujourd'hui).

### 6.5 Remotes rclone (utilisateur `tesla`, `~/.config/rclone/rclone.conf`, mode 0600)
```ini
[r2-backup]
type = s3
provider = Cloudflare
access_key_id = <jeton tesla-backup-writer>
secret_access_key = <secret>
endpoint = https://<compte>.r2.cloudflarestorage.com
no_check_bucket = true

[r2-files-ro]
type = s3
provider = Cloudflare
access_key_id = <jeton tesla-files-reader>
secret_access_key = <secret>
endpoint = https://<compte>.r2.cloudflarestorage.com
no_check_bucket = true

[r2-backup-crypt]
type = crypt
remote = r2-backup:tesla-backups
password = <rclone obscure …>
password2 = <rclone obscure …>
```
Les mots de passe `crypt` sont à conserver **hors du VPS**, avec la clé privée GnuPG (sans eux, la copie des fichiers est illisible).

## 7. Sauvegardes externes (D144)

`backup.sh` conserve son principe (dump → contrôle → restauration d'essai facultative → chiffrement GnuPG par clé publique → SHA-256 → copie `--immutable`) et ajoute :
- contrôle d'espace libre avant le dump (`BACKUP_MIN_FREE_MB`) ;
- vérification distante **par relecture** (`rclone check --download`) ;
- `BACKUP_RETENTION_DAYS=0` : copie locale supprimée après vérification de la copie distante (refusé sans `BACKUP_REMOTE`) ; recommandé : `2` ;
- copie incrémentale chiffrée des fichiers applicatifs (`FILES_BACKUP_SOURCE` → `FILES_BACKUP_REMOTE`, ajout seul) ;
- alerte en cas d'échec (`BACKUP_ALERT_URL`) et signal de réussite (`BACKUP_HEARTBEAT_URL`, à brancher sur une sonde qui alerte en l'absence de signal).

Le script n'efface jamais rien à distance : la rétention distante relève du cycle de vie R2.

**Clés indispensables à la restauration** (à conserver hors VPS, en deux exemplaires, par deux personnes, séparément des sauvegardes) : clé privée GnuPG de sauvegarde, `MEDICAL_DATA_KEY` (sans elle, les fiches médicales restaurées sont illisibles), mots de passe rclone `crypt`, jeton `tesla-backup-restore`. Une copie R2 n'est pas une stratégie de restauration : l'exercice de [BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 4 reste obligatoire.

Seconde copie indépendante : recommandée si l'association accepte un second fournisseur (même script, second `BACKUP_REMOTE` via un remote rclone `union` ou une seconde unité) ; non mise en place.

## 8. Hors ligne

| Situation | Comportement |
| --- | --- |
| Module téléchargé, sans réseau | inchangé : texte et images des leçons depuis le coffre chiffré ; aucune requête R2 |
| Fichier joint (R2) | « fichier joint indisponible hors ligne » dans la liste des ressources indisponibles ; aucune URL signée conservée, donc rien n'expire sur l'appareil |
| Nouvelle version publiée | inchangé : mise à jour proposée, ancienne copie intacte jusqu'au remplacement |
| Envoi de fichier sans réseau | refusé immédiatement (« Connexion requise ») : aucune file d'envoi de fichiers sur l'appareil (pas de promesse de synchronisation) |
| Reconnexion | aucune opération de fichier en attente ; la file de synchronisation existante est inchangée |

## 9. PDF

Aucun PDF généré n'est conservé : module, questionnaire, corrigé, grille et fiche médicale restent produits à la demande, en mémoire, et transmis directement. Ils sont régénérables à l'identique depuis la version publiée ou la fiche chiffrée. Une conservation sur R2 ne se justifierait que pour un document qui ne peut pas être régénéré (ex. copies papier numérisées, non développées) : elle exigera une catégorie dédiée, une durée de conservation décidée et, pour un document sensible, un chiffrement applicatif.

## 10. Fiches médicales

Inchangées (D135–D137) : contenu chiffré dans PostgreSQL, PDF à la demande pour le seul titulaire, jamais hors ligne. Aucun téléversement médical n'est ajouté. Si un besoin est validé : catégorie distincte, chiffrement applicatif avant envoi (clé hors R2), lecture par le seul titulaire, audit sans contenu, durée de conservation, jamais d'URL publique ni de cache.

## 11. Coûts (estimation, à confirmer)

Tarifs publiés par Cloudflare au 2026-11 (classe *Standard*) : 10 Go-mois, 1 million d'opérations de classe A et 10 millions de classe B gratuits par mois ; au-delà 4,50 $ par million (A), 0,36 $ par million (B) ; sortie de données gratuite ; suppressions non facturées ; un `PUT` refusé par condition (412) est une opération A. Prix du Go-mois au-delà de la franchise : voir la page tarifaire.

| Poste | Hypothèse | Ordre de grandeur |
| --- | --- | --- |
| Fichiers des modules | 300 fichiers × 2 Mo | ≈ 0,6 Go |
| Sauvegardes | 2 par jour × 90 jours × 20 Mo (dump chiffré estimé) | ≈ 3,6 Go |
| Copie des fichiers | = fichiers | ≈ 0,6 Go |
| Opérations A | envois (1 PUT), copies et listes rclone (≈ 10 par sauvegarde) | quelques milliers / mois |
| Opérations B | confirmation (HEAD + GET), lectures (1 GET par ouverture) | quelques dizaines de milliers / mois |

Conclusion : dans la franchise gratuite à l'échelle d'une communauté de 25 routiers ; à surveiller dans le tableau de bord R2 (Métriques). Le volume réel des dumps est à mesurer en préproduction.

## 12. Exploitation

- **Supervision** : journal de `tesla-daily@<instance>` (« Stockage : … envois abandonnés, fichiers par statut, sans référence ») ; unité en échec si un nettoyage est reporté ; `df -h /var/backups` ; tableau de bord R2.
- **Dépannage** : 503 `FILE_STORAGE_UNAVAILABLE` → variables R2 absentes ; 503 `FILE_STORAGE_ERROR` → journal API (`Stockage (head) en échec … (AccessDenied|NoSuchBucket|…)`) : jeton, portée, nom de compartiment, horloge du VPS ; envoi refusé par le navigateur → CORS (origine, en-têtes `content-type`, `if-none-match`) ou URL expirée (recommencer) ; 422 `FILE_REJECTED` → fichier modifié, tronqué ou de type différent.
- **Rotation des identifiants** : créer un nouveau jeton → remplacer les variables (ou `rclone.conf`) → `systemctl restart tesla-api@<instance>` (ou sauvegarde manuelle de contrôle) → vérifier un envoi et une lecture → révoquer l'ancien jeton. Au moins une fois par an et à chaque départ d'un administrateur. En cas de fuite : révoquer immédiatement, puis recréer.

## 13. Checklist de mise en production

1. Compartiments, jetons, CORS, verrou et cycle de vie créés (§ 6) ; accès public désactivé vérifié.
2. `/etc/tesla/<instance>.env` complété (`R2_*`, `MEDICAL_DATA_KEY`, `BACKUP_*`) ; `rclone.conf` en 0600 ; `rclone lsd r2-backup:` réussi.
3. Migration `20261110090000_stored_files` appliquée par `deploy.sh` (`prisma migrate deploy`).
4. Préproduction : envoi d'une image et d'un PDF, refus d'un fichier renommé, lecture par un routier après publication, refus avant publication, nettoyage d'un envoi abandonné.
5. Vérifier sur R2 réel que l'URL signée refuse un second `PUT` (412) et un fichier de taille différente (403).
6. Sauvegarde manuelle → copie dans `tesla-backups` → `verify-backup.sh` sur un poste distinct → restauration d'exercice.
7. Alerte d'échec testée (`BACKUP_REMOTE` volontairement erroné en préproduction).
8. Clés hors VPS inventoriées (§ 7).
