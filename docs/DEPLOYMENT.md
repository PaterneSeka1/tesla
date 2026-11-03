# Déploiement sur VPS OVH (Ubuntu 24.04 LTS)

> **Architecture de référence depuis le 2026-11-03 (D167) : web sur Vercel, API sur le VPS — voir [DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md).** Ce guide décrit le **mode historique** (`WEB_HOSTING=local` : web et API sur le VPS, `bootstrap.sh … --web-hosting local`) et les étapes communes (R2, sauvegardes, supervision, sécurité) auxquelles le guide Vercel renvoie.

Guide opérationnel unique. Fichiers de référence : [`deploy/`](../deploy). Sauvegardes : [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Stockage objet : [STORAGE_R2.md](STORAGE_R2.md). Liste de contrôle : [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

**État au 2026-11-02** : aucun VPS OVH, aucun compte Cloudflare ni aucun téléphone réel n'a été utilisé. Les scripts ont été vérifiés localement (shellcheck, `nginx -t` sur nginx 1.24, sauvegarde/restauration sur PostgreSQL 18, recettes navigateur sur l'application de production) ; leur première exécution réelle doit se faire en **préproduction**.

## 1. Architecture

```
Internet ── 443 ── Nginx ──┬── /api/*  → 127.0.0.1:4000  tesla-api@<instance>  (NestJS)
           (80 : ACME       └── /*      → 127.0.0.1:3000  tesla-web@<instance>  (Next.js)
            et redirection)        PostgreSQL 18 : localhost:5432 (jamais exposé)
                                   Fichiers : Cloudflare R2 (privé, URL signées)
                                   Sauvegardes : R2 (compartiment verrouillé, jeton distinct)
```

- Deux instances isolées possibles : `production` (3000/4000 par défaut) et `preproduction` (3100/4100), ports refusés s'ils sont déjà pris sur le VPS (`--api-port`, `--web-port`), chacune avec domaine, base `tesla_<instance>`, `/etc/tesla/<instance>.env`, compartiments et clés propres. Aucune donnée réelle en préproduction.
- systemd (pas de PM2) : `tesla-api@`, `tesla-web@`, `tesla-daily@.timer`, `tesla-backup@.timer`, `tesla-healthcheck@.timer`, et `tesla-alert@` déclenchée par `OnFailure=` des trois dernières.
- Releases immuables : `/var/www/tesla/<instance>/releases/<date>-<commit>/`, lien `current` (arborescence : [DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md) § 2). Une release n'est marquée saine (`HEALTHY`) qu'après un contrôle de santé réussi ; seules les releases saines servent au retour arrière.

## 2. Ressources

Mesures locales du 2026-11-02 (build de production, base de recette, une seule personne connectée) : web Next.js ≈ 150 Mo de mémoire résidente, API NestJS ≈ 350 Mo après une série de tests, PostgreSQL ≈ 60 Mo, build web ≈ 460 Mo de pointe ; une release ≈ 1,4 Go (dépendances comprises, cache de build supprimé). **Aucune mesure de charge** : 25 routiers et l'encadrement sont une charge faible, mais à confirmer en préproduction.

| Élément | Recommandation | Justification |
| --- | --- | --- |
| VPS | 2 vCPU, **4 Go** de RAM, 40 Go SSD (ex. gamme VPS OVH d'entrée de milieu de gamme) | Services ≈ 0,6 Go + build ≈ 0,5 Go + système ; marge pour PostgreSQL. 2 Go est possible avec un swap de 2 Go, au prix de builds lents. |
| Disque | 40 Go | 5 releases saines + 2 en échec ≈ 10 Go, base et sauvegardes locales de 2 jours < 1 Go, journaux plafonnés à 1 Go ; aucun fichier téléversé sur le VPS |
| Cloudflare R2 | Offre gratuite probablement suffisante (10 Go) | Images et PDF des modules, sauvegardes chiffrées |
| Domaine | Un sous-domaine par instance | Ex. `academie.<domaine>` et `preprod-academie.<domaine>` |

## 3. Première installation

### Étape 1 — OVH
1. Commander le VPS Ubuntu 24.04 LTS ; ajouter votre clé SSH publique ; noter l'adresse IPv4 (et IPv6).
2. Se connecter (`ssh ubuntu@<ip>`), puis `sudo -i`. **Ne pas changer le port SSH ni désactiver l'accès par mot de passe avant d'avoir vérifié la connexion par clé dans une seconde session.**
3. `apt update && apt full-upgrade -y && reboot`.

### Étape 2 — DNS
Créer l'enregistrement `A` (et `AAAA`) du domaine vers le VPS. Attendre la propagation (`dig +short <domaine>`) : le certificat ne peut pas être obtenu avant.

### Étape 3 — Cloudflare R2 (console Cloudflare, hors VPS)
Suivre [STORAGE_R2.md](STORAGE_R2.md) § 6 : compartiments privés `tesla-files-production` (et `-preproduction`), compartiment `tesla-backups` avec verrou et cycle de vie, CORS du compartiment applicatif limité au domaine, **trois jetons distincts** (application en lecture/écriture sur son seul compartiment ; sauvegarde en écriture sur `tesla-backups` ; lecture seule pour la restauration, conservé hors VPS).

### Étape 4 — Installation du serveur (root)

```bash
git clone https://github.com/PaterneSeka1/tesla.git ~/tesla        # en ubuntu, hors de /var/www/tesla
cd ~/tesla && git checkout <étiquette_validée>
sudo deploy/scripts/bootstrap.sh production <domaine> <e-mail_pour_lets_encrypt> --web-hosting local
```

`bootstrap.sh` est idempotent (relançable sans risque), ne remplace jamais une configuration existante et ne modifie rien hors des fichiers de Tesla (VPS partagé) : détail des options (`--api-port`, `--web-port`, `--pg-port`, `--node-dir`, `--enable-firewall`, `--with-journald`, `--repo`, `--no-tls`) et des garanties dans [DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md) § 4. En mode historique, il active aussi `tesla-web@` et installe `tesla.conf` (web et API derrière le même domaine). Le site Nginx par défaut, les autres sites, la version de Node.js ou de PostgreSQL déjà installée et l'état d'UFW ne sont jamais modifiés (TESLA s'exécute sur son propre Node.js 22, `/opt/node22/bin` par défaut, D168) ; la rotation des journaux Nginx relève de `/etc/logrotate.d/nginx` d'Ubuntu.

**Immédiatement** : copier `MEDICAL_DATA_KEY` dans le coffre de l'association (deux personnes, hors VPS). Sans elle, les fiches médicales restaurées sont illisibles.

### Étape 5 — Compléter la configuration
Le script liste les valeurs `<…>` restantes de `/etc/tesla/production.env` :

| Variable | Valeur |
| --- | --- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Jeton **applicatif** (étape 3) |
| `BACKUP_GPG_RECIPIENT` | Empreinte de la clé **publique** de sauvegarde (la clé privée reste hors VPS) |
| `ALERT_URL` | URL recevant un POST texte en cas d'échec (ex. sujet ntfy privé, passerelle e-mail) |
| `BACKUP_HEARTBEAT_URL` (facultatif) | Sonde « dead man's switch » appelée après chaque sauvegarde réussie |
| `BACKUP_RESTORE_CHECK_URL` (recommandé) | Rôle de maintenance `CREATEDB` pour la restauration d'essai à chaque sauvegarde |
| `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (facultatif, D166) | Envoi des liens et codes d'activation et de récupération. Tout ou rien ; STARTTLS exigé sur 587 (`SMTP_SECURE=false`) ou TLS implicite sur 465 (`true`). Sans SMTP : récupération administrée (« Comptes » → nouveau lien, remis après vérification d'identité), et l'interface ne prétend jamais qu'un e-mail est parti |
| `PASSWORD_RESET_TTL_MINUTES` | Validité d'une demande « mot de passe oublié » (60 par défaut) ; `ACCOUNT_LINK_TTL_HOURS` reste la validité des liens émis par une personne habilitée |

Puis, en `tesla` : `gpg --import cle-publique.asc` et `rclone config` (remotes `r2-backup`, `r2-backup-crypt`, `r2-files-ro`, voir [STORAGE_R2.md](STORAGE_R2.md) § 7). Ne jamais définir `DEMO_ACCOUNT_PASSWORD`. `NEXT_PUBLIC_API_URL` est intégrée au build : la modifier impose un redéploiement.

### Étape 6 — Premier déploiement (utilisateur `tesla`)

```bash
sudo -iu tesla
git -C /var/www/tesla/production/repo fetch --tags && git -C /var/www/tesla/production/repo checkout --detach <étiquette_validée>
/var/www/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette_validée>
```

Contrôles (utilisateur, configuration, 2 Gio libres) → release `git archive` → `npm ci` et build → **sauvegarde** → `prisma migrate deploy` → bascule atomique du lien `current` → redémarrage → contrôle de santé (60 s) → `HEALTHY`, ou retour automatique au code précédent et release marquée `FAILED`. Un échec avant la bascule supprime la release sans toucher au service.

### Étape 7 — Timers et supervision (root)

```bash
systemctl start tesla-daily@production.timer tesla-backup@production.timer tesla-healthcheck@production.timer
systemctl start tesla-backup@production && journalctl -u tesla-backup@production -n 30
systemctl start tesla-alert@tesla-healthcheck-production   # essai d'alerte : message reçu ?
```

Ajouter une **sonde externe** HTTPS sur `https://<domaine>/api/v1/health` (le VPS ne peut pas signaler sa propre panne totale).

### Étape 8 — Vérifications de sécurité

```bash
deploy/scripts/healthcheck.sh https://<domaine>
curl -sI https://<domaine>/ | grep -Ei 'strict-transport|content-security|x-frame|referrer'
curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/api/docs      # 404 attendu
ss -ltnp | grep -E ':(5432|3000|4000)'                                    # 127.0.0.1 uniquement
curl -sI https://<domaine>/inscription | grep -Ei 'referrer-policy: no-referrer|cache-control: no-store'
# IP usurpée : un X-Forwarded-For fourni par le client est écrasé par Nginx ($remote_addr) ;
# 4 demandes « mot de passe oublié » pour la même adresse → la 4e répond 429 avec Retry-After.
for i in 1 2 3 4; do curl -s -o /dev/null -w '%{http_code} ' -H 'X-Forwarded-For: 203.0.113.9' \
  -H 'x-tesla-csrf: 1' -H 'Content-Type: application/json' \
  -d '{"email":"essai-inexistant@example.org"}' https://<domaine>/api/v1/auth/password-reset/request; done
ufw status verbose ; systemctl --failed ; certbot renew --dry-run
```
Depuis une autre machine : `nc -zv <ip> 5432` doit échouer.

### Étape 9 — Premier administrateur (utilisateur `tesla`)

```bash
sudo -iu tesla /var/www/tesla/production/repo/deploy/scripts/exec.sh production \
  node dist/jobs/create-admin.js --email <adresse> --first-name <prénom> --last-name <nom>
```
`exec.sh` charge l'environnement de l'instance et le Node.js de TESLA (`TESLA_NODE_DIR`, [DEPLOYMENT_VERCEL_OVH.md](DEPLOYMENT_VERCEL_OVH.md) § 3 et § 9).
Le lien affiché est à usage unique (72 h) : le transmettre au titulaire par un canal personnel. Une seconde exécution est refusée ; `--recover` émet un lien de réinitialisation pour un administrateur existant (procédure de récupération sans e-mail). Aucun mot de passe ne passe par la ligne de commande.

### Étape 10 — Mise en service métier
L'administrateur crée les comptes de l'encadrement, puis désigne le **responsable plein**, l'adjoint et les assistants dans « Administration → Encadrement » (`/communaute`). Tant qu'aucun plein n'est en fonction, aucune décision officielle n'est possible. Le plein crée ensuite les fiches routiers (avec ou sans compte), puis approuve et publie les modules.

## 4. Mise à jour

```bash
sudo -iu tesla
git -C /var/www/tesla/production/repo fetch --tags && git -C /var/www/tesla/production/repo checkout --detach <étiquette>
/var/www/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette>
```
- Toujours déployer d'abord la **même étiquette** en préproduction.
- `migrate deploy` uniquement ; jamais `migrate reset` ni `db push`. Relire le SQL des nouvelles migrations ; une migration non additive exige un plan validé et une fenêtre de maintenance ([database.md](../.claude/rules/database.md)).
- Si les unités systemd, Nginx ou l'alerte ont changé dans la version, relancer `bootstrap.sh` (idempotent) depuis un clone à jour, en root.
- Appareils hors ligne : une mise à jour ne supprime jamais les opérations en attente (IndexedDB) ; l'API doit continuer d'accepter les écritures rejouables de la version précédente (contrats additifs, `x-tesla-operation-id`). Pendant le redémarrage, Nginx affiche une page de maintenance et les appareils conservent leurs saisies.

## 5. Retour arrière

- **Code** : `deploy/scripts/rollback.sh production` (release saine la plus récente) ou `rollback.sh production /var/www/tesla/production/releases/<dossier>` (en `tesla` ; verrou partagé avec `deploy.sh`). Sans rebuild ni migration.
- **Ce n'est pas un retour arrière de la base.** Les migrations de Tesla sont additives, l'ancien code fonctionne sur le schéma plus récent. Si une migration non additive a été appliquée, ou en cas de corruption : restauration ([BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 5).
- Les releases installées avant l'introduction du marqueur `HEALTHY` ne sont pas proposées automatiquement : les désigner explicitement.

## 6. Restauration après perte du VPS

1. Nouveau VPS, DNS, étapes 1, 2, 4 (le jeton applicatif R2 existe déjà).
2. Remplacer `MEDICAL_DATA_KEY` générée par **la clé d'origine** (coffre) et compléter `/etc/tesla/production.env` comme à l'étape 5.
3. Restaurer la dernière sauvegarde depuis R2 avec le jeton de restauration ([BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 5), dans `tesla_production` vide ou une nouvelle base pointée par `DATABASE_URL`.
4. Étape 6 avec l'étiquette en service avant l'incident, puis étapes 7 et 8.
5. Fichiers : ils restent dans leur compartiment R2 ; s'il est perdu, les recopier depuis la copie chiffrée ([BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 2, « Perte complète du VPS »).

## 7. Supervision

| Contrôle | Moyen |
| --- | --- |
| Disponibilité | `tesla-healthcheck@.timer` (5 min) ; échec → `tesla-alert@` → `ALERT_URL` ; sonde externe en complément |
| Sauvegarde, traitement quotidien | Échec → alerte ; réussite de sauvegarde → `BACKUP_HEARTBEAT_URL` ; stockage R2 actif sans copie des fichiers → échec signalé |
| Journaux | `journalctl -u tesla-api@production -u tesla-web@production --since today` ; Nginx : `/var/log/nginx/tesla-production.*.log` |
| Certificat | `certbot certificates` ; renouvellement automatique |
| Disque | Contrôle avant chaque déploiement (2 Gio) et chaque sauvegarde ; journald plafonné |
| Comptes et limitation (D165, D166) | `journalctl -u tesla-api@production | grep -E 'Échec d’envoi|429'` ; journal d'audit (`account.code_locked`, `account.password_reset_requested`, `account.password_reset`, `account.activated`) ; table `auth_throttles` (empreintes seulement, purgée chaque jour) : `SELECT count(*) FROM auth_throttles WHERE blocked_until > now();` — un nombre élevé et durable signale une attaque |
| Évaluations papier (D163) | Journal d'audit `evaluation_attempt.paper_batch_prepared`, `.transmitted`, `.switched_to_paper` ; erreurs PDF : `journalctl … | grep paper-batches` (5xx journalisés sans chaîne de requête) |
| Stockage objet | Journal de `tesla-daily@` (envois abandonnés purgés, fichiers par statut, fichiers sans référence) ; métriques R2 |
