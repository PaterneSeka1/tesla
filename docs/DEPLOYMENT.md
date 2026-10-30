# Déploiement sur VPS (Ubuntu 24.04 LTS)

Procédures préparées et **non exécutées** sur un serveur : aucun accès SSH ni déploiement n'a eu lieu. Fichiers de référence : [`deploy/`](../deploy). Sauvegardes : [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Liste de contrôle : [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## 1. Architecture

```
Internet ── 443 ── Nginx ──┬── /api/*  → 127.0.0.1:4000  tesla-api@<instance>  (NestJS)
                           └── /*      → 127.0.0.1:3000  tesla-web@<instance>  (Next.js)
                                  PostgreSQL 18 : 127.0.0.1:5432 (jamais exposé)
```

- Un domaine par instance ; même origine pour le web et l'API (cookie de session, CSRF, CORS simplifiés).
- Deux instances isolées sur le même serveur ou sur deux serveurs : `production` (ports 3000/4000) et `preproduction` (3100/4100), chacune avec son domaine, sa base, son fichier `/etc/tesla/<instance>.env` et sa clé de sauvegarde. Les données réelles n'entrent jamais en préproduction.
- **systemd plutôt que PM2** : aucune dépendance npm globale, redémarrage et journaux natifs (journald), timers pour le traitement quotidien et les sauvegardes, durcissement (`ProtectSystem=strict`, `NoNewPrivileges`). Unités paramétrées par instance : `tesla-api@`, `tesla-web@`, `tesla-daily@` (+ timer), `tesla-backup@` (+ timer), `tesla-healthcheck@` (+ timer).
- Releases immuables : `/opt/tesla/<instance>/releases/<date>-<commit>/`, lien `current`, cinq versions conservées.

## 2. Prérequis

| Élément | Valeur |
| --- | --- |
| Système | Ubuntu 24.04 LTS, 2 vCPU, 4 Go de RAM, 40 Go de disque (indicatif, à confirmer en préproduction) |
| Node.js | 22 LTS (≥ 22.12, `.nvmrc`), paquet NodeSource |
| PostgreSQL | 18 (dépôt PGDG), écoute `localhost` uniquement |
| Paquets | `nginx`, `certbot`, `python3-certbot-nginx`, `git`, `gnupg`, `rclone`, `curl` |
| Réseau | DNS du domaine vers le VPS ; pare-feu : 22, 80, 443 |
| Hors VPS | Stockage distant chiffré au repos pour les sauvegardes ; clé privée GnuPG de sauvegarde conservée hors ligne par deux personnes |

## 3. Première installation (production)

Exécuter en `root` sauf mention contraire. Remplacer `<domaine>`.

1. **Système et pare-feu**
   ```bash
   apt update && apt full-upgrade -y
   ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
   ```
2. **Utilisateur de service** : `adduser --system --group --home /home/tesla --shell /bin/bash tesla`
3. **PostgreSQL** : installer la version 18, vérifier `listen_addresses = 'localhost'` dans `postgresql.conf`, puis
   ```bash
   sudo -u postgres createuser --pwprompt tesla        # rôle de l'application, non superutilisateur
   sudo -u postgres createdb --owner=tesla tesla
   sudo -u postgres psql -d tesla -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
   ```
   L'extension `btree_gist` est créée par la migration de l'application si le rôle en a le droit ; la créer en amont évite de donner ce droit.
4. **Code** (en `tesla`) :
   ```bash
   mkdir -p /opt/tesla/production/releases && cd /opt/tesla/production
   git clone https://github.com/PaterneSeka1/tesla.git repo
   ```
5. **Configuration** : copier `deploy/env/production.env.example` en `/etc/tesla/production.env`, compléter, `chown root:tesla`, `chmod 0640`. Ne jamais définir `DEMO_ACCOUNT_PASSWORD`.
6. **Clé de sauvegarde** : importer la **clé publique** dans le trousseau de `tesla` (`sudo -u tesla gpg --import cle-publique.asc`) et reporter son empreinte dans `BACKUP_GPG_RECIPIENT`. Configurer le distant rclone (`sudo -u tesla rclone config`). Créer `/var/backups/tesla/production` (propriétaire `tesla`, mode 0700).
7. **Unités et outils** :
   ```bash
   cp deploy/systemd/* /etc/systemd/system/ && systemctl daemon-reload
   cp deploy/logrotate/tesla /etc/logrotate.d/tesla
   mkdir -p /etc/systemd/journald.conf.d && cp deploy/journald/tesla.conf /etc/systemd/journald.conf.d/
   systemctl restart systemd-journald
   cp deploy/sudoers/tesla /etc/sudoers.d/tesla && visudo -cf /etc/sudoers.d/tesla
   ```
8. **Premier déploiement** (en `tesla`) : `repo/deploy/scripts/deploy.sh production main` (le premier contrôle de santé échoue tant que Nginx n'est pas configuré : terminer les étapes 9–10 puis relancer `systemctl restart tesla-api@production tesla-web@production`).
9. **Nginx** : copier `deploy/nginx/tesla.conf` dans `/etc/nginx/sites-available/tesla`, remplacer `DOMAINE`, lier dans `sites-enabled`, `nginx -t && systemctl reload nginx`.
10. **TLS** : `certbot --nginx -d <domaine>` ; vérifier `systemctl list-timers certbot.timer` et `certbot renew --dry-run`.
11. **Services et timers** :
    ```bash
    systemctl enable --now tesla-api@production tesla-web@production
    systemctl enable --now tesla-daily@production.timer tesla-backup@production.timer tesla-healthcheck@production.timer
    ```
12. **Premier administrateur** (en `tesla`, aucun mot de passe sur la ligne de commande) :
    ```bash
    cd /opt/tesla/production/current/apps/api
    set -a; . /etc/tesla/production.env; set +a
    node dist/jobs/create-admin.js --email <adresse> --first-name <prénom> --last-name <nom>
    ```
    Le lien affiché est à usage unique (72 h) : le transmettre au titulaire par un canal personnel. Une seconde exécution est refusée ; `--recover` émet un lien de réinitialisation pour un administrateur existant.
13. **Mise en service métier** : déclarer l'année scoute et consigner le responsable plein (`/mandats`) ; tant que ce n'est pas fait, aucune décision officielle n'est possible (D107). Le plein crée ensuite les comptes routiers depuis les fiches.
14. **Vérifications** : `deploy/scripts/healthcheck.sh https://<domaine>`, première sauvegarde (`systemctl start tesla-backup@production`, puis restauration d'essai hors VPS : [BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 4), en-têtes (`curl -I`), `systemctl --failed`.

## 4. Mise à jour

```bash
sudo -iu tesla
git -C /opt/tesla/production/repo pull --ff-only
/opt/tesla/production/repo/deploy/scripts/deploy.sh production <étiquette|commit>
```

Le script : contrôles préalables (utilisateur, configuration, 2 Gio libres) → release immuable (`git archive`) → `npm ci --include=dev` et build → **sauvegarde** → `prisma migrate deploy` → bascule du lien `current` → redémarrage → contrôle de santé (60 s) → retour automatique au code précédent en cas d'échec.

Règles :
- Toujours déployer d'abord en préproduction la même étiquette.
- Migrations : `migrate deploy` uniquement ; jamais `migrate reset` ni `db push`. Relire le SQL de chaque nouvelle migration ; une migration non additive exige un plan validé ([database.md](../.claude/rules/database.md)).
- `NEXT_PUBLIC_API_URL` est intégrée au build : la modifier impose un nouveau déploiement.
- Compatibilité hors ligne : une mise à jour ne supprime jamais les opérations en attente des appareils (IndexedDB) ; l'API doit continuer d'accepter les écritures rejouables de la version précédente (contrats additifs, `x-tesla-operation-id`).

## 5. Retour arrière

- **Code** : `deploy/scripts/rollback.sh production` (version précédente) ou `rollback.sh production /opt/tesla/production/releases/<dossier>`. Sans rebuild ni migration ; les migrations de Tesla étant additives, l'ancien code fonctionne sur le schéma plus récent.
- **Données** (migration défectueuse, corruption) : restauration dans une nouvelle base puis bascule, [BACKUP_RESTORE.md](BACKUP_RESTORE.md) § 5.

## 6. Supervision

| Contrôle | Moyen |
| --- | --- |
| Disponibilité | `tesla-healthcheck@.timer` (5 min) : `/api/v1/health` (base comprise) et `/connexion` ; à doubler par une sonde externe (HTTPS) |
| Échecs | `systemctl --failed` (sauvegarde, traitement quotidien, contrôle de santé) |
| Journaux | `journalctl -u tesla-api@production -u tesla-web@production --since today` ; Nginx : `/var/log/nginx/tesla.*.log` |
| Certificat | `certbot certificates` ; renouvellement automatique par `certbot.timer`, Nginx rechargé par le plugin |
| Disque | Sauvegardes locales (14 jours), journaux (journald plafonné à 1 Go) |

Alerte e-mail ou messagerie : non configurée (aucun service externe choisi) ; à brancher sur `systemctl --failed` ou sur la sonde externe.

## 7. Non vérifié

Aucune de ces procédures n'a été exécutée sur un VPS ; `nginx -t` n'a pas été exécuté (Nginx absent de l'environnement) ; les unités systemd n'ont pas été chargées par systemd. Seuls les scripts de sauvegarde, de restauration d'essai et de restauration ont été exécutés (base `tesla_test`, outils PostgreSQL 18 du conteneur, clé GnuPG jetable). À valider en préproduction avec [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
