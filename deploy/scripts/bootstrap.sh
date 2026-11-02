#!/usr/bin/env bash
# Installation d'une instance TESLA sur un VPS Ubuntu 24.04 LTS (exécuté en root, idempotent :
# chaque étape vérifie l'existant et ne remplace jamais une configuration ou un secret déjà en place).
#   1. contrôles   2. paquets (Node 22, PostgreSQL 18, Nginx, Certbot, rclone, UFW)
#   3. utilisateur « tesla » et arborescences   4. base et rôle PostgreSQL (écoute locale)
#   5. /etc/tesla/<instance>.env (secrets générés : base, MEDICAL_DATA_KEY ; le reste à compléter)
#   6. dépôt de code   7. systemd, journald, logrotate, sudoers, alertes
#   8. Nginx + certificat Let's Encrypt (vhost HTTP provisoire, certonly --webroot, puis HTTPS)
#   9. pare-feu (port SSH effectif conservé)
# Ne déploie aucune version : voir la fin du script pour les étapes suivantes (deploy.sh).
#
# Usage : bootstrap.sh <production|preproduction> <domaine> <e-mail_letsencrypt> [options]
#   --repo <url>      dépôt Git (défaut : https://github.com/PaterneSeka1/tesla.git)
#   --no-firewall     ne pas configurer UFW
#   --no-tls          ne pas demander de certificat (DNS pas encore prêt) ; relancer ensuite
set -euo pipefail
umask 022

usage() { echo "Usage : bootstrap.sh <production|preproduction> <domaine> <e-mail> [--repo URL] [--no-firewall] [--no-tls]" >&2; exit 1; }
instance="${1:-}"; domain="${2:-}"; email="${3:-}"
[[ "$instance" =~ ^(production|preproduction)$ && -n "$domain" && -n "$email" ]] || usage
shift 3
repo_url="https://github.com/PaterneSeka1/tesla.git"; firewall=1; tls=1
while (( $# )); do
  case "$1" in
    --repo) repo_url="${2:?}"; shift 2 ;;
    --no-firewall) firewall=0; shift ;;
    --no-tls) tls=0; shift ;;
    *) usage ;;
  esac
done
[[ "$domain" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "Domaine invalide : ${domain}" >&2; exit 1; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$(cd "$here/../.." && pwd)"   # copie du dépôt qui contient ce script
root="/opt/tesla/${instance}"
env_file="/etc/tesla/${instance}.env"
if [[ "$instance" == production ]]; then web_port=3000; api_port=4000; else web_port=3100; api_port=4100; fi
db_name="tesla_${instance}"; db_role="tesla_${instance}"
log() { printf '\n== %s\n' "$*"; }
warn() { printf 'ATTENTION : %s\n' "$*" >&2; }

# 1. Contrôles ------------------------------------------------------------------------------------
[[ "$(id -u)" == 0 ]] || { echo "À exécuter en root." >&2; exit 1; }
. /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || warn "Système ${PRETTY_NAME:-inconnu} : script prévu pour Ubuntu 24.04."
[[ -f "$src/deploy/env/production.env.example" ]] || { echo "Lancer depuis une copie du dépôt (deploy/ introuvable)." >&2; exit 1; }

# 2. Paquets --------------------------------------------------------------------------------------
log "Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git nginx certbot rclone ufw postgresql-common openssl
install -d -m 0755 /etc/apt/keyrings
if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
fi
if ! ls /etc/apt/sources.list.d/pgdg* > /dev/null 2>&1; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
fi
apt-get update -q
apt-get install -y -q nodejs postgresql-18
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a===22&&b>=12?0:1)' ||
  { echo "Node.js 22.12 ou plus requis (trouvé $(node -v))." >&2; exit 1; }

# 3. Utilisateur et arborescences -----------------------------------------------------------------
log "Utilisateur tesla et répertoires"
id tesla > /dev/null 2>&1 || adduser --system --group --home /home/tesla --shell /bin/bash tesla
install -d -o tesla -g tesla -m 0750 /opt/tesla "$root" "$root/releases"
install -d -o root -g tesla -m 0750 /etc/tesla
install -d -o tesla -g tesla -m 0700 "/var/backups/tesla/${instance}" /home/tesla/.gnupg
install -d -o root -g root -m 0755 /var/www/letsencrypt /var/www/tesla
install -m 0644 "$src/deploy/nginx/maintenance.html" /var/www/tesla/maintenance.html

# 4. PostgreSQL -----------------------------------------------------------------------------------
log "PostgreSQL 18 : base ${db_name}"
systemctl enable --now postgresql
listen="$(sudo -u postgres psql -tAc 'SHOW listen_addresses')"
[[ "$listen" == localhost || "$listen" == 127.0.0.1 ]] ||
  warn "listen_addresses = '${listen}' : PostgreSQL doit écouter en local uniquement."
db_password=""
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${db_role}'")" != 1 ]]; then
  db_password="$(openssl rand -hex 24)"
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 \
    -c "CREATE ROLE ${db_role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${db_password}'"
fi
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${db_name}'")" != 1 ]]; then
  sudo -u postgres createdb --owner="$db_role" "$db_name"
fi
# Extension requise par les migrations, créée ici pour ne pas donner ce droit à l'application.
sudo -u postgres psql -q -d "$db_name" -c 'CREATE EXTENSION IF NOT EXISTS btree_gist'

# 5. Configuration de l'instance ------------------------------------------------------------------
log "Configuration ${env_file}"
if [[ ! -f "$env_file" ]]; then
  [[ -n "$db_password" ]] || { echo "Rôle ${db_role} déjà existant mais ${env_file} absent : renseigner DATABASE_URL à la main." >&2; exit 1; }
  medical_key="$(openssl rand -base64 32)"
  sed -e "s#<domaine>#${domain}#g" \
      -e "s#^API_PORT=.*#API_PORT=${api_port}#" \
      -e "s#^WEB_PORT=.*#WEB_PORT=${web_port}#" \
      -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://${db_role}:${db_password}@127.0.0.1:5432/${db_name}?schema=public#" \
      -e "s#^MEDICAL_DATA_KEY=.*#MEDICAL_DATA_KEY=${medical_key}#" \
      -e "s#tesla-files-production#tesla-files-${instance}#g" \
      -e "s#^R2_KEY_PREFIX=.*#R2_KEY_PREFIX=${instance}#" \
      -e "s#/var/backups/tesla/production#/var/backups/tesla/${instance}#" \
      -e "s#tesla-backups/production#tesla-backups/${instance}#" \
      -e "s#:production-files#:${instance}-files#" \
      "$src/deploy/env/production.env.example" > "$env_file"
  chown root:tesla "$env_file"; chmod 0640 "$env_file"
  warn "MEDICAL_DATA_KEY générée dans ${env_file} : copiez-la MAINTENANT dans le coffre de l'association (hors VPS). Sans elle, les fiches médicales restaurées sont illisibles."
else
  echo "Fichier existant conservé."
fi

# 6. Code -----------------------------------------------------------------------------------------
log "Dépôt ${repo_url}"
if [[ ! -d "$root/repo/.git" ]]; then
  sudo -u tesla git clone --quiet "$repo_url" "$root/repo" ||
    { echo "Clonage impossible (dépôt privé ? ajouter une clé de déploiement pour tesla)." >&2; exit 1; }
fi

# 7. systemd, journaux, sudoers, alertes ----------------------------------------------------------
log "Unités systemd et outils"
install -m 0644 "$src"/deploy/systemd/*.service "$src"/deploy/systemd/*.timer /etc/systemd/system/
install -m 0755 "$src/deploy/scripts/alert.sh" /usr/local/bin/tesla-alert
install -m 0644 "$src/deploy/logrotate/tesla" /etc/logrotate.d/tesla
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 "$src/deploy/journald/tesla.conf" /etc/systemd/journald.conf.d/tesla.conf
systemctl restart systemd-journald
sudoers_tmp="$(mktemp)"; cp "$src/deploy/sudoers/tesla" "$sudoers_tmp"
visudo -cqf "$sudoers_tmp" && install -m 0440 "$sudoers_tmp" /etc/sudoers.d/tesla; rm -f "$sudoers_tmp"
systemctl daemon-reload
systemctl enable "tesla-api@${instance}" "tesla-web@${instance}" \
  "tesla-daily@${instance}.timer" "tesla-backup@${instance}.timer" "tesla-healthcheck@${instance}.timer"

# 8. Nginx et TLS ---------------------------------------------------------------------------------
log "Nginx et certificat pour ${domain}"
[[ -L /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default
site="/etc/nginx/sites-available/tesla-${instance}"
cert="/etc/letsencrypt/live/${domain}/fullchain.pem"
if [[ ! -f "$cert" ]]; then
  sed "s/DOMAINE/${domain}/g" "$src/deploy/nginx/tesla-acme.conf" > "${site}-acme"
  ln -sfn "${site}-acme" "/etc/nginx/sites-enabled/tesla-${instance}"
  nginx -t && systemctl reload nginx
  if (( tls )); then
    certbot certonly --webroot -w /var/www/letsencrypt -d "$domain" --email "$email" \
      --agree-tos --non-interactive --deploy-hook 'systemctl reload nginx'
  else
    warn "Certificat non demandé (--no-tls) : relancer ce script quand le DNS pointe vers ce serveur."
  fi
fi
if [[ -f "$cert" ]]; then
  sed -e "s/DOMAINE/${domain}/g" -e "s/INSTANCE/${instance}/g" \
      -e "s/API_PORT/${api_port}/" -e "s/WEB_PORT/${web_port}/" \
      "$src/deploy/nginx/tesla.conf" > "$site"
  ln -sfn "$site" "/etc/nginx/sites-enabled/tesla-${instance}"
  rm -f "${site}-acme"
  nginx -t && systemctl reload nginx
fi

# 9. Pare-feu -------------------------------------------------------------------------------------
if (( firewall )); then
  log "Pare-feu UFW"
  # Port(s) SSH réellement utilisés : jamais modifiés, toujours autorisés avant l'activation.
  for port in $(sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }'); do ufw allow "${port}/tcp" > /dev/null; done
  ufw allow 80/tcp > /dev/null; ufw allow 443/tcp > /dev/null
  ufw --force enable > /dev/null
  ufw status verbose | sed -n '1,20p'
fi
if ss -ltnH | awk '{ print $4 }' | grep -Eq '^(0\.0\.0\.0|\[::\]|\*):5432$'; then
  warn "PostgreSQL écoute sur toutes les interfaces : corriger listen_addresses."
fi

# Bilan -------------------------------------------------------------------------------------------
log "Valeurs restant à compléter dans ${env_file}"
grep -nE '^[A-Z0-9_]+=.*<' "$env_file" | sed 's/=.*/=…/' || echo "Aucune."
cat <<EOF

Étapes suivantes (docs/DEPLOYMENT.md) :
  1. Compléter ${env_file} (R2, sauvegardes, ALERT_URL) ; importer la clé PUBLIQUE GnuPG :
       sudo -u tesla gpg --import cle-publique.asc
     et configurer rclone pour tesla : sudo -u tesla rclone config
  2. Premier déploiement :  sudo -iu tesla ${root}/repo/deploy/scripts/deploy.sh ${instance} main
  3. Timers :  systemctl start tesla-daily@${instance}.timer tesla-backup@${instance}.timer tesla-healthcheck@${instance}.timer
  4. Premier administrateur : voir docs/DEPLOYMENT.md § 3, étape 9.
EOF
