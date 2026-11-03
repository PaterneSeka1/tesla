# Déploiement Vercel + OVH

Architecture de référence (D167) : **web Next.js sur Vercel**, **API NestJS, PostgreSQL et sauvegardes sur le VPS OVH**, fichiers sur Cloudflare R2. Le mode historique (web et API sur le VPS) reste documenté dans [DEPLOYMENT.md](DEPLOYMENT.md), qui contient aussi les étapes communes (R2, sauvegardes, supervision, sécurité) auxquelles ce guide renvoie.

**État au 2026-11-03** : scripts, unités, vhost et relais vérifiés localement (§ 12), y compris l'exécution sur un Node.js 22 isolé (`/opt/node22/bin`) à côté du Node.js 20 du système (D168). Aucun VPS, aucun projet Vercel, aucun compte Cloudflare réels n'ont été utilisés : première exécution en **préproduction**.

## 1. Architecture

```
Navigateur ── https://<projet>.vercel.app ── Vercel (Next.js, PWA, sw.js)
                 │  pages, ressources statiques
                 └─ /api/v1/*  ── relais même origine (apps/web/src/proxy.ts)
                                  + X-Tesla-Proxy-Secret, X-Tesla-Client-Ip
                                        │ HTTPS
                       https://<domaine_api> ── Nginx (vhost tesla-<instance>, VPS partagé)
                                        │ 127.0.0.1:<API_PORT>
                                  tesla-api@<instance> (NestJS, utilisateur tesla,
                                                        /opt/node22/bin/node)
                                        │ 127.0.0.1:5432
                                  PostgreSQL 18 (jamais exposé)
Fichiers : R2 privé (URL signées) · Sauvegardes : R2 dédié, chiffrées (GnuPG)
```

- **Même origine** : le navigateur n'appelle que `https://<projet>.vercel.app/api/v1/...` (`NEXT_PUBLIC_API_URL=/api/v1`). Le cookie de session (`HttpOnly`, `Secure`, `SameSite=Lax`, sans attribut `Domain`) est donc propre au domaine Vercel : aucun cookie tiers, rien à changer dans l'API. Téléchargements PDF et ZIP, déconnexion, activation et mot de passe oublié passent par le même relais.
- **CSRF inchangé** : l'en-tête `x-tesla-csrf` et l'en-tête `Origin` du navigateur sont transmis tels quels ; l'API exige `Origin ∈ CORS_ORIGINS` (= l'origine Vercel exacte).
- **Adresse du client** : Vercel relaie depuis ses propres adresses. Le relais ajoute l'adresse établie par Vercel (`x-forwarded-for`, réécrit par Vercel) et un **secret partagé** ; Nginx ne retient cette adresse que si le secret est exact, sinon `$remote_addr`. Un client qui joint directement le domaine de l'API ne peut donc pas usurper une adresse. Les deux en-têtes sont retirés avant l'API. Sans ce mécanisme, tous les utilisateurs partageraient les limites par adresse IP (D165).
- **Base de données** : uniquement sur le VPS. Vercel ne reçoit ni `DATABASE_URL`, ni `MEDICAL_DATA_KEY`, ni identifiant R2, ni SMTP.
- **Hors ligne** : inchangé (coffre IndexedDB chiffré, file d'opérations). `sw.js` ne met jamais en cache `/api/` (même origine désormais) ; les pages de compte restent exclues.

## 2. Arborescence du VPS

```
/var/www/tesla/                 root:root 0755   (TESLA_DEPLOY_ROOT ; rien d'autre n'est touché sous /var/www)
├── acme/                       root:root 0755   webroot Let's Encrypt de Tesla
├── maintenance/                root:root 0755   page de maintenance (mode historique)
├── production/                 tesla:tesla 0750 illisible par www-data et les autres comptes
│   ├── repo/                   clone de travail de tesla (git fetch, git archive)
│   ├── releases/<AAAAMMJJhhmmss>-<sha12>/   releases immuables (HEALTHY | FAILED)
│   ├── current -> releases/<…>              bascule atomique
│   └── shared/deploy.lock                   un seul déploiement ou retour arrière à la fois
└── preproduction/              même structure, base, port, domaine et clés propres
/etc/tesla/<instance>.env       root:tesla 0640  secrets (jamais dans Git)
/etc/nginx/tesla/<instance>-proxy.conf  root 0600  secret du relais Vercel
/var/backups/tesla/<instance>/  tesla 0700       sauvegardes chiffrées locales
/opt/node22/bin/{node,npm,npx}  root             Node.js de TESLA (TESLA_NODE_DIR), installé hors script
/usr/bin/node                   (système)        Node.js des autres applications : jamais utilisé ni modifié
```

Les services TESLA (API, traitement quotidien, sauvegarde, santé) ne voient de `/var/www` que leur propre instance, en lecture seule (`TemporaryFileSystem=/var/www:ro` + `BindReadOnlyPaths`) : les autres applications du VPS leur sont invisibles. Aucune commande ne modifie les droits de `/var/www`.

## 3. Prérequis (hors VPS)

1. **DNS** : enregistrement `A` (et `AAAA`) de `<domaine_api>` (ex. `api-academie.<domaine>`) vers le VPS ; préproduction : `api-preprod-academie.<domaine>`. Attendre `dig +short <domaine_api>`.
2. **Cloudflare R2** : [STORAGE_R2.md](STORAGE_R2.md) § 6, avec **`AllowedOrigins` = l'origine Vercel** (`https://<projet>.vercel.app`) dans la règle CORS du compartiment applicatif (envoi direct par URL signée depuis le navigateur).
3. **Vercel** : un projet relié au dépôt GitHub (étape 8). Noter l'adresse de production `https://<projet>.vercel.app`.
4. **Vérifier l'existant du VPS** (applications déjà en place) : `ss -ltnp` (ports pris), `pg_lsclusters` (version et port de PostgreSQL), `/usr/bin/node -v`, `ls /etc/nginx/sites-enabled/`, `ufw status`. Le script s'adapte (§ 4) mais ne modifie jamais ces éléments.
5. **Node.js 22 de TESLA (D168)** : TESLA exige Node.js ≥ 22.12 (`package.json`, `engines`). Sur le VPS OVH, `/usr/bin/node` (20.20.0) sert les autres applications et **n'est jamais modifié** ; TESLA utilise un Node.js distinct, `/opt/node22/bin` (22.23.4, npm 10.9.9), déjà installé. Contrôle :

   ```bash
   /usr/bin/node -v                                               # v20.20.0 (autres applications, inchangé)
   /opt/node22/bin/node -v && /opt/node22/bin/npm -v && /opt/node22/bin/npx -v   # v22.23.4, 10.9.9, 10.9.9
   ls -ld /opt/node22 /opt/node22/bin                             # root, lisible par tous (utilisateur tesla)
   ```

   Sur un autre serveur sans ce dossier : installer l'archive officielle `node-v22.x-linux-x64.tar.xz` de nodejs.org (somme SHA-256 vérifiée contre `SHASUMS256.txt`) dans `/opt/node22`, **sans** lien dans `/usr/bin` ni `/usr/local/bin` et sans paquet `nodejs`. Un autre dossier est possible (`--node-dir`) s'il est hors de `/home` et `/root` (invisibles des services, `ProtectHome=true`). `bootstrap.sh` n'installe jamais Node.js et s'arrête si le dossier est absent ou en version < 22.12.

## 4. Installation du serveur (root, une fois par instance)

Le clone d'installation est fait par `ubuntu`, **hors** de `/var/www/tesla` ; le clone de travail (`/var/www/tesla/<instance>/repo`) appartient à `tesla` et est créé par le script. Aucun conflit de propriétaire. Un clone déjà fait par `ubuntu` à cet emplacement est rendu à `tesla` (ce dossier seul) ; la racine `/var/www/tesla` ne doit jamais être elle-même un clone (refus explicite).

```bash
ssh ubuntu@<ip_vps>
git clone https://github.com/PaterneSeka1/tesla.git ~/tesla && cd ~/tesla
git checkout <étiquette_validée>
sudo deploy/scripts/bootstrap.sh production <domaine_api> <e-mail_letsencrypt> \
  --web-url https://<projet>.vercel.app --api-port <port_libre>
```

| Option | Effet |
| --- | --- |
| `--web-url` | Origine Vercel → `CORS_ORIGINS` (et `PUBLIC_APP_URL`, commenté). Sans elle, valeur `<projet>` à compléter : `deploy.sh` refuse de démarrer tant qu'elle reste. |
| `--api-port` | Port local de l'API (défaut 4000, préproduction 4100). **Refus si le port est occupé** sur le VPS. |
| `--node-dir` | Dossier de `node`, `npm`, `npx` de TESLA (défaut `/opt/node22/bin`). Écrit dans `TESLA_NODE_DIR` et dans les unités systemd ; **commun aux deux instances** (unités partagées) : refus si l'autre instance utilise un autre dossier, ou si la valeur diffère d'un fichier d'instance existant (modifier alors `TESLA_NODE_DIR` dans ce fichier). |
| `--pg-port` | Port du cluster PostgreSQL **18** à utiliser (défaut 5432). Un cluster d'une autre version n'est jamais modifié : le script s'arrête. Sans aucun cluster, PostgreSQL 18 est installé. |
| `--no-tls` | DNS pas encore prêt ; relancer ensuite. |
| `--enable-firewall` | Active UFW s'il est inactif. **Par défaut, UFW inactif reste inactif** (d'autres applications peuvent écouter sur d'autres ports) ; actif, seuls 80/443 sont ajoutés. `--no-firewall` : aucune action. |
| `--with-journald` | Installe la rétention journald de Tesla — réglage **global** du serveur, à n'activer qu'après accord. |
| `--web-hosting local` | Mode historique ([DEPLOYMENT.md](DEPLOYMENT.md)). |

Ce que fait le script (idempotent ; ne remplace jamais une configuration ou un secret existant) : contrôle du Node.js de TESLA (`TESLA_NODE_DIR` ≥ 22.12, `npm` et `npx` présents ; aucun paquet `nodejs`, `/usr/bin/node` ni utilisé ni modifié) ; paquets (Nginx, Certbot, rclone) ; utilisateur système `tesla` (sans sudo, sauf le redémarrage de ses propres unités) ; arborescence § 2 ; base `tesla_<instance>` et rôle non superutilisateur, extension `btree_gist` ; `/etc/tesla/<instance>.env` (`WEB_HOSTING=vercel`, `DATABASE_URL`, `MEDICAL_DATA_KEY` générés) ; unités systemd rendues avec `TESLA_NODE_DIR` (`ExecStart=/opt/node22/bin/node …`, `Environment=PATH=/opt/node22/bin:…` ; `tesla-web@` n'est **ni activé ni démarré**) ; sudoers ; secret du relais ; vhost `tesla-<instance>` (HTTP provisoire, certificat `certonly --webroot` dans `/var/www/tesla/acme`, puis `tesla-api.conf`). Chaque changement Nginx passe par `nginx -t` ; en cas d'échec la version précédente est rétablie et Nginx n'est **pas** rechargé. Le site par défaut et les autres sites ne sont jamais modifiés.

**Immédiatement** : copier `MEDICAL_DATA_KEY` dans le coffre de l'association (deux personnes, hors VPS).

## 5. Configuration de l'instance

Compléter `/etc/tesla/production.env` (le script liste les `<…>` restants) comme [DEPLOYMENT.md](DEPLOYMENT.md) § 3 étape 5 (R2, GnuPG, rclone, alertes, SMTP facultatif). Spécifique à ce mode :

| Variable | Valeur |
| --- | --- |
| `WEB_HOSTING` | `vercel` |
| `PUBLIC_URL` | `https://<domaine_api>` (contrôles de santé du VPS) |
| `CORS_ORIGINS` | `https://<projet>.vercel.app` — origine exacte ; jamais une adresse de prévisualisation en production |
| `PUBLIC_APP_URL` | `https://<projet>.vercel.app` si SMTP est configuré (liens des e-mails) |
| `API_PORT` | Port local choisi à l'installation (Nginx l'utilise : relancer `bootstrap.sh` s'il change) |
| `TRUST_PROXY` | `true` (Nginx écrase `X-Forwarded-For`) |
| `TESLA_NODE_DIR` | `/opt/node22/bin` (écrit par `bootstrap.sh`) ; absent d'un fichier antérieur : même défaut |
| `NEXT_PUBLIC_API_URL`, `WEB_PORT` | absents (Vercel) |

Puis, en `tesla` : `gpg --import cle-publique.asc` et `rclone config` ([STORAGE_R2.md](STORAGE_R2.md) § 7).

## 6. Premier déploiement de l'API (utilisateur `tesla`)

```bash
sudo -iu tesla
git -C /var/www/tesla/production/repo fetch --tags
git -C /var/www/tesla/production/repo checkout --detach <étiquette_validée>   # scripts de la même version
/var/www/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette_validée>
exit
sudo systemctl start tesla-daily@production.timer tesla-backup@production.timer tesla-healthcheck@production.timer
```

`deploy.sh` (mode Vercel) : verrou → **Node.js de TESLA** placé en tête du `PATH` du script seul (version ≥ 22.12 vérifiée, journalisée ; unités installées vérifiées : une unité encore sur un autre `node` arrête le déploiement → relancer `bootstrap.sh`) → contrôles (variables sans `<…>`, 2 Gio libres) → release `git archive` → `npm ci`, build de `@tesla/shared` et de l'API seulement → **sauvegarde** → `prisma migrate deploy` (additif, jamais `reset` ni `db push`) → bascule de `current` → redémarrage de `tesla-api@production` seul → santé de l'API (60 s) → `HEALTHY`, ou retour automatique et `FAILED`. La santé ne dépend jamais de Vercel : une panne de Vercel ne provoque pas de retour arrière de l'API.

Contrôle : `curl -fsS https://<domaine_api>/api/v1/health` → `"status":"ok"`.

## 7. Certificats HTTPS

Obtenus par `bootstrap.sh` (`certbot certonly --webroot -w /var/www/tesla/acme`) ; renouvellement par `certbot.timer`, qui recharge Nginx. Contrôle : `certbot certificates`, `certbot renew --dry-run`. Le web est en HTTPS par Vercel (`*.vercel.app`).

## 8. Projet Vercel

1. *Add New → Project* → dépôt GitHub `tesla` ; **Root Directory : `apps/web`** ; *Include files outside the root directory* : activé (par défaut) ; framework Next.js ; **Node.js 22.x**.
2. Installation et build : définis par [`apps/web/vercel.json`](../apps/web/vercel.json) — `npm ci` à la racine du monorepo, puis `npm run build:shared && npm run build -w @tesla/web` (le package `@tesla/shared` est compilé avant Next.js).
3. Variables d'environnement, environnement **Production** uniquement :

   | Variable | Valeur | Nature |
   | --- | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `/api/v1` | publique, intégrée au build |
   | `TESLA_API_ORIGIN` | `https://<domaine_api>` (sans chemin) | serveur uniquement |
   | `TESLA_PROXY_SECRET` | valeur entre guillemets de `sudo cat /etc/nginx/tesla/production-proxy.conf` (32 caractères) | serveur uniquement, **Sensitive** |
   | `NEXT_TELEMETRY_DISABLED` | `1` | — |

   Rien d'autre : jamais `DATABASE_URL`, `MEDICAL_DATA_KEY`, `R2_*`, `SMTP_*`.
4. **Prévisualisations** : ne pas leur donner `TESLA_API_ORIGIN` de production. Sans relais configuré, `/api/v1/*` répond 503 (aucune donnée réelle exposée). Une préproduction Vercel se relie à l'API de préproduction avec son propre secret et une origine ajoutée au `CORS_ORIGINS` de préproduction seulement.
5. Déployer (*Deploy*), puis vérifier § 10.

Un changement de `NEXT_PUBLIC_API_URL` impose un nouveau build Vercel ; `TESLA_API_ORIGIN` et `TESLA_PROXY_SECRET` sont lus à l'exécution (redéployer pour qu'ils s'appliquent).

## 9. Premier administrateur (utilisateur `tesla`)

```bash
sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/exec.sh production \
  node dist/jobs/create-admin.js --email <adresse> --first-name <prénom> --last-name <nom> \
  --web-url https://<projet>.vercel.app
```

`exec.sh <instance> <commande…>` exécute une commande ponctuelle dans `current/apps/api`, avec l'environnement de l'instance et le Node.js de TESLA (jamais un `node` nu de la session, qui serait `/usr/bin/node` 20). Mêmes usages : `exec.sh production npx prisma migrate status`, `exec.sh production npm run pedagogy:audit`, `exec.sh production npm run db:seed:pedagogy -- --dry-run`, `exec.sh production node dist/jobs/daily.js`.

Le lien (usage unique, 72 h) pointe vers le web Vercel. Suite : [DEPLOYMENT.md](DEPLOYMENT.md) § 3 étape 10.

## 10. Vérifications après mise en service

```bash
W=https://<projet>.vercel.app; A=https://<domaine_api>
curl -fsS $W/api/v1/health                                     # relais Vercel → API : "status":"ok"
curl -s -o /dev/null -w '%{http_code}\n' $A/                    # 404 (aucune page web sur le VPS)
curl -s -o /dev/null -w '%{http_code}\n' $A/api/docs            # 404
curl -sI $W/connexion | grep -Ei 'content-security|x-frame|referrer'
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' \
  -H 'x-tesla-csrf: 1' $W/api/v1/auth/logout                    # 403 (origine refusée)
ss -ltnp | grep -E ':(5432|<API_PORT>)\b'                       # 127.0.0.1 uniquement
systemctl --failed; systemctl is-enabled tesla-web@production   # aucun échec ; « disabled » ou absent
```

Navigateur : connexion, une fiche, un PDF (module, copie papier), déconnexion ; « Cet appareil » : préparation hors ligne, coupure réseau, consultation, saisie différée puis synchronisation. Usurpation d'adresse : 4 demandes « mot de passe oublié » **depuis un même poste** via `$W` répondent 429 à la 4ᵉ ; le même essai avec `-H 'X-Tesla-Client-Ip: 203.0.113.9'` directement sur `$A` reste compté sur l'adresse réelle.

## 11. Mise à jour, retour arrière, sauvegarde

- **API** : comme § 6 avec la nouvelle étiquette, d'abord en préproduction. Si les unités, Nginx ou sudoers changent, relancer `bootstrap.sh` (idempotent) depuis `~/tesla` à jour.
- **Node.js de TESLA** : mise à jour mineure dans le même dossier (`/opt/node22`) → redéployer (`deploy.sh` reconstruit les dépendances natives). Changement de dossier → `TESLA_NODE_DIR` dans **les deux** fichiers d'instance, `bootstrap.sh` (unités rendues de nouveau, `daemon-reload`), puis `deploy.sh`. Contrôle : `systemctl show -p ExecStart tesla-api@production` et `sudo cat /proc/$(systemctl show -p MainPID --value tesla-api@production)/cmdline | tr '\0' ' '` → `/opt/node22/bin/node dist/main.js`.
- **Web** : déploiement Vercel de la **même étiquette** (branche de production ou *Promote*). Ordre : API d'abord (contrats additifs), web ensuite.
- **Retour arrière de l'API** : `sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/rollback.sh production [release]` (dernière release saine ; jamais une release `FAILED` ni un chemin hors de `releases/`). **Web** : *Instant Rollback* Vercel. Aucun retour arrière de la base : [BACKUP_RESTORE.md](BACKUP_RESTORE.md).
- **Sauvegardes** : inchangées (`tesla-backup@.timer`, `/var/backups/tesla/<instance>`, R2), voir [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Restauration (jamais par-dessus la base existante, procédure complète : [BACKUP_RESTORE.md § 5](BACKUP_RESTORE.md#5-restauration-en-production)) :

  ```bash
  sudo systemctl stop tesla-api@production
  # restore.sh lu par root (dossier de l'instance en 0750), exécuté par postgres (authentification peer) ;
  # sauvegarde, .sha256 et clé privée accessibles à postgres le temps de l'opération
  sudo cat /var/www/tesla/production/repo/deploy/scripts/restore.sh | sudo -u postgres env \
    BACKUP_RESTORE_CHECK_URL=postgresql://postgres@/postgres RESTORE_OWNER=tesla_production \
    bash -s -- /chemin/tesla-<horodatage>.dump.gpg tesla_restaure_<date>
  # puis DATABASE_URL → tesla_restaure_<date> dans /etc/tesla/production.env
  sudo systemctl start tesla-api@production
  sudo systemctl start tesla-healthcheck@production   # code non nul si l'API est en échec
  ```
- **Changement de secret du relais** : supprimer `/etc/nginx/tesla/<instance>-proxy.conf`, relancer `bootstrap.sh`, mettre à jour `TESLA_PROXY_SECRET` sur Vercel et redéployer (quelques minutes où les adresses ne sont plus distinguées).

## 12. Vérifications locales et limites

Exécuté localement le 2026-11-03 (détails : [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)) : `deploy-scripts.test.sh` (releases, retour arrière, verrou, rétention, garde-fous de chemins, modes vercel/local ; deux Node.js simulés — 20 en tête du `PATH`, 22 dans `TESLA_NODE_DIR` : `npm ci`, builds et Prisma sur 22, aucun appel à 20, refus d'un dossier en 20, absent ou sous `/home`, refus d'unités sur un autre `node`, `exec.sh`), release `git archive` réelle construite avec un Node.js 22 isolé et un faux Node.js 20 bloquant en tête du `PATH` (`npm ci`, `@tesla/shared`, API, `prisma validate` / `migrate status`), ShellCheck, `systemd-analyze verify`, `nginx -t` (nginx 1.24 d'Ubuntu 24.04, deux instances + mode historique + un autre site), chaîne réelle web (`next start`, build `/api/v1`) → relais → Nginx TLS → API → PostgreSQL 18.

À vérifier sur OVH et Vercel (non testable localement) : comportement exact du relais Vercel (transmission de `Set-Cookie`, `Origin`, corps binaires volumineux, délai maximal d'une réponse relayée — ZIP de lots), réécriture effective de `x-forwarded-for` par Vercel, isolation systemd réelle (`TemporaryFileSystem`), coexistence avec les autres sites Nginx (`listen 443 ssl http2` partagé), Certbot, R2 réel et CORS avec l'origine Vercel, appareils réels.
