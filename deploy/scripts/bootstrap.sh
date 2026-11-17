#!/usr/bin/env bash
# Installation d'une instance TESLA sur un VPS Ubuntu 24.04 LTS (exécuté en root, idempotent :
# chaque étape vérifie l'existant et ne remplace jamais une configuration ou un secret déjà en place).
# Le VPS peut héberger d'autres applications : rien n'est modifié hors de TESLA_DEPLOY_ROOT
# (/var/www/tesla), /etc/tesla, /var/backups/tesla et des fichiers « tesla » de systemd, Nginx et
# sudoers. Jamais de suppression de site Nginx, de changement de version de Node.js ou de
# PostgreSQL déjà installée, ni d'activation du pare-feu sans --enable-firewall.
# Node.js : TESLA utilise son propre dossier (TESLA_NODE_DIR, /opt/node22/bin par défaut), installé
# au préalable (docs/DEPLOYMENT_VERCEL_OVH.md § 3) ; /usr/bin/node n'est ni utilisé ni modifié.
#   1. contrôles   2. paquets (PostgreSQL 18, Nginx, Certbot, rclone ; Node.js 22 vérifié)
#   3. utilisateur « tesla » et arborescences   4. base et rôle PostgreSQL (écoute locale)
#   5. /etc/tesla/<instance>.env (secrets générés : base, MEDICAL_DATA_KEY ; le reste à compléter)
#   6. dépôt de code   7. systemd, sudoers, alertes
#   8. Nginx + certificat Let's Encrypt (vhost HTTP provisoire, certonly --webroot, puis HTTPS)
#   9. pare-feu (UFW déjà actif : ouverture de 80/443 seulement)
# Ne déploie aucune version : voir la fin du script pour les étapes suivantes (deploy.sh).
#
# Usage : bootstrap.sh <production|preproduction> <domaine> <e-mail_letsencrypt> [options]
#   <domaine>            domaine servi par ce VPS : celui de l'API (vercel, ovh) ou du site (local)
#   --web-url <url>      adresse publique du web sur Vercel (ex. https://tesla.vercel.app) : CORS_ORIGINS
#   --web-hosting <mode> vercel (défaut), ovh (web et API sur le VPS, Vercel simple proxy) ou local
#                        (mode historique : web servi par le VPS sous <domaine>, sans Vercel)
#   --origin-domain <d>  mode ovh : domaine technique de l'origine web relayée par Vercel
#                        (WEB_ORIGIN_DOMAIN ; celui du fichier d'instance existant fait foi)
#   --api-port <port>    port local de l'API (défaut 4000, préproduction 4100) ; doit être libre
#   --web-port <port>    port local du web en mode local (défaut 3000, préproduction 3100)
#   --pg-port <port>     port du cluster PostgreSQL 18 à utiliser (défaut 5432)
#   --repo <url>         dépôt Git (défaut : https://github.com/PaterneSeka1/tesla.git)
#   --node-dir <dossier> dossier de node, npm et npx de TESLA (défaut /opt/node22/bin, ≥ 22.12) ;
#                        commun aux deux instances (unités systemd partagées)
#   --no-tls             ne pas demander de certificat (DNS pas encore prêt) ; relancer ensuite
#   --no-firewall        ne rien faire sur UFW
#   --enable-firewall    activer UFW s'il est inactif (port SSH effectif, 80 et 443 autorisés) ;
#                        à éviter si d'autres applications écoutent sur d'autres ports
#   --with-journald      installer la rétention journald de TESLA (réglage GLOBAL du serveur)
set -euo pipefail
umask 022

usage() { sed -n '/^# Usage/,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//' >&2; exit 1; }
instance="${1:-}"; domain="${2:-}"; email="${3:-}"
[[ "$instance" =~ ^(production|preproduction)$ && -n "$domain" && -n "$email" ]] || usage
shift 3
repo_url="https://github.com/PaterneSeka1/tesla.git"; firewall=check; tls=1; journald=0
hosting=vercel; web_url=""; api_port=""; web_port=""; pg_port=5432; node_dir=""; origin_domain=""
while (( $# )); do
  case "$1" in
    --web-url) web_url="${2:?}"; shift 2 ;;
    --web-hosting) hosting="${2:?}"; shift 2 ;;
    --origin-domain) origin_domain="${2:?}"; shift 2 ;;
    --api-port) api_port="${2:?}"; shift 2 ;;
    --web-port) web_port="${2:?}"; shift 2 ;;
    --pg-port) pg_port="${2:?}"; shift 2 ;;
    --repo) repo_url="${2:?}"; shift 2 ;;
    --node-dir) node_dir="${2:?}"; shift 2 ;;
    --no-tls) tls=0; shift ;;
    --no-firewall) firewall=skip; shift ;;
    --enable-firewall) firewall=enable; shift ;;
    --with-journald) journald=1; shift ;;
    *) usage ;;
  esac
done
[[ "$domain" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "Domaine invalide : ${domain}" >&2; exit 1; }
[[ "$hosting" =~ ^(vercel|ovh|local)$ ]] || { echo "--web-hosting : vercel, ovh ou local." >&2; exit 1; }
[[ -z "$web_url" || "$web_url" =~ ^https://[a-z0-9.-]+\.[a-z]{2,}$ ]] ||
  { echo "--web-url : origine https sans chemin ni barre finale attendue (${web_url})." >&2; exit 1; }
for port in "$api_port" "$web_port" "$pg_port"; do
  [[ -z "$port" || ( "$port" =~ ^[0-9]{2,5}$ && "$port" -ge 1024 && "$port" -le 65535 ) ]] ||
    { echo "Port invalide : ${port} (1024–65535)." >&2; exit 1; }
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$(cd "$here/../.." && pwd)"   # copie du dépôt qui contient ce script
# shellcheck source=deploy/scripts/common.sh
. "$here/common.sh"
deploy_root="$(tesla_deploy_root)"
root="${deploy_root}/${instance}"
env_file="${TESLA_CONFIG_DIR}/${instance}.env"
db_name="tesla_${instance}"; db_role="tesla_${instance}"
log() { printf '\n== %s\n' "$*"; }
warn() { printf 'ATTENTION : %s\n' "$*" >&2; }
port_busy() { [[ -n "$(ss -ltnH "sport = :${1}")" ]]; }
env_value() { sed -n "s/^${1}=//p" "${2:-$env_file}" | tail -1; }

# 1. Contrôles ------------------------------------------------------------------------------------
[[ "$(id -u)" == 0 ]] || { echo "À exécuter en root." >&2; exit 1; }
. /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || warn "Système ${PRETTY_NAME:-inconnu} : script prévu pour Ubuntu 24.04."
[[ -f "$src/deploy/env/production.env.example" ]] || { echo "Lancer depuis une copie du dépôt (deploy/ introuvable)." >&2; exit 1; }
# La racine de déploiement n'est jamais elle-même un clone : le dépôt de travail de l'instance est
# ${root}/repo (propriété de tesla) ; la copie d'installation est ailleurs (ex. ~ubuntu/tesla).
[[ ! -e "${deploy_root}/.git" ]] ||
  { echo "${deploy_root} est un clone Git : cloner ailleurs (ex. ~/tesla), voir docs/DEPLOYMENT_VERCEL_OVH.md § 4." >&2; exit 1; }

# Ports : ceux d'un fichier d'instance existant font foi ; sinon valeur demandée ou défaut, libre.
if [[ -f "$env_file" ]]; then
  api_port="$(env_value API_PORT)"; hosting="$(env_value WEB_HOSTING)"; hosting="${hosting:-local}"
  [[ "$hosting" =~ ^(vercel|ovh|local)$ ]] || { echo "WEB_HOSTING invalide dans ${env_file} : ${hosting}." >&2; exit 1; }
  [[ "$hosting" != vercel ]] && web_port="$(env_value WEB_PORT)"
  if [[ "$hosting" == ovh ]]; then
    configured_origin="$(env_value WEB_ORIGIN_DOMAIN)"
    [[ -z "$origin_domain" || -z "$configured_origin" || "$origin_domain" == "$configured_origin" ]] ||
      { echo "--origin-domain ${origin_domain} différent de ${env_file} (${configured_origin})." >&2; exit 1; }
    origin_domain="${configured_origin:-$origin_domain}"
    [[ "$web_port" =~ ^[0-9]+$ ]] || { echo "WEB_PORT illisible dans ${env_file} (WEB_HOSTING=ovh)." >&2; exit 1; }
    # Passage d'une instance existante au mode ovh : le port du web ne doit pas appartenir à une
    # autre application du VPS (tesla-web@ déjà actif : port déjà le sien).
    if ! systemctl is-active --quiet "tesla-web@${instance}" 2> /dev/null && port_busy "$web_port"; then
      echo "Port ${web_port} (WEB_PORT) déjà utilisé sur ce VPS : choisir un autre port dans ${env_file}." >&2; exit 1
    fi
  fi
else
  if [[ "$instance" == production ]]; then api_port="${api_port:-4000}"; web_port="${web_port:-3000}"
  else api_port="${api_port:-4100}"; web_port="${web_port:-3100}"; fi
  port_busy "$api_port" && { echo "Port ${api_port} déjà utilisé sur ce VPS : choisir --api-port." >&2; exit 1; }
  if [[ "$hosting" != vercel ]] && port_busy "$web_port"; then
    echo "Port ${web_port} déjà utilisé sur ce VPS : choisir --web-port." >&2; exit 1
  fi
fi
[[ "$api_port" =~ ^[0-9]+$ ]] || { echo "API_PORT illisible dans ${env_file}." >&2; exit 1; }
if [[ "$hosting" == ovh ]]; then
  [[ "$origin_domain" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ && "$origin_domain" != "$domain" ]] ||
    { echo "Mode ovh : --origin-domain (ou WEB_ORIGIN_DOMAIN) requis, distinct de ${domain}." >&2; exit 1; }
fi

# Node.js de TESLA : celui d'un fichier d'instance existant fait foi (défaut sinon) ; les unités
# systemd étant communes, les deux instances doivent utiliser le même dossier.
if [[ -f "$env_file" ]]; then
  configured="$(TESLA_NODE_DIR="$(env_value TESLA_NODE_DIR)" tesla_node_dir)"
  [[ -z "$node_dir" || "${node_dir%/}" == "$configured" ]] ||
    { echo "--node-dir ${node_dir} différent de ${env_file} (${configured}) : modifier TESLA_NODE_DIR dans ce fichier." >&2; exit 1; }
  node_dir="$configured"
else
  node_dir="$(TESLA_NODE_DIR="$node_dir" tesla_node_dir)"
fi
for other in production preproduction; do
  other_env="${TESLA_CONFIG_DIR}/${other}.env"
  [[ "$other" == "$instance" || ! -f "$other_env" ]] && continue
  other_dir="$(TESLA_NODE_DIR="$(env_value TESLA_NODE_DIR "$other_env")" tesla_node_dir)"
  [[ "$other_dir" == "$node_dir" ]] ||
    { echo "L'instance ${other} utilise ${other_dir} : même TESLA_NODE_DIR requis (unités systemd communes)." >&2; exit 1; }
done
tesla_check_node "$node_dir"
system_node="$( [[ -x /usr/bin/node ]] && /usr/bin/node --version 2> /dev/null || echo absent)"
echo "Node.js de TESLA : ${node_dir}/node $("${node_dir}/node" --version) ; /usr/bin/node (${system_node}) non utilisé ni modifié."

# 2. Paquets --------------------------------------------------------------------------------------
log "Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git nginx certbot rclone postgresql-common openssl util-linux
# Aucun paquet nodejs : le Node.js système (et les applications qui en dépendent) n'est pas touché.
# PostgreSQL : le cluster du port choisi doit être en version 18 (contraintes WITHOUT OVERLAPS) ; un
# cluster d'une autre version n'est jamais modifié.
if ! ls /etc/apt/sources.list.d/pgdg* > /dev/null 2>&1; then
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
fi
cluster="$(pg_lsclusters -h 2>/dev/null | awk -v p="$pg_port" '$3 == p { print $1 " " $2 }')"
if [[ -z "$cluster" ]]; then
  if [[ -n "$(pg_lsclusters -h 2>/dev/null)" ]]; then
    echo "Aucun cluster PostgreSQL sur le port ${pg_port}, mais d'autres existent : préciser --pg-port d'un cluster 18 (pg_lsclusters)." >&2; exit 1
  fi
  apt-get install -y -q postgresql-18
  cluster="$(pg_lsclusters -h | awk -v p="$pg_port" '$3 == p { print $1 " " $2 }')"
fi
[[ "${cluster%% *}" == 18 ]] ||
  { echo "Le cluster PostgreSQL du port ${pg_port} est en version ${cluster%% *} : 18 requise (--pg-port)." >&2; exit 1; }
apt-get install -y -q postgresql-client-18
psql_admin() { sudo -u postgres psql -p "$pg_port" "$@"; }

# 3. Utilisateur et arborescences -----------------------------------------------------------------
log "Utilisateur tesla et répertoires sous ${deploy_root}"
id tesla > /dev/null 2>&1 || adduser --system --group --home /home/tesla --shell /bin/bash tesla
# Racine commune root:root 0755 (Nginx y lit acme/ et maintenance/) ; chaque instance tesla:tesla
# 0750 (illisible par www-data et les autres comptes). Aucun droit modifié hors de ces dossiers.
install -d -o root -g root -m 0755 "$deploy_root" "$deploy_root/acme" "$deploy_root/maintenance"
install -d -o tesla -g tesla -m 0750 "$root" "$root/releases" "$root/shared"
install -m 0644 "$src/deploy/nginx/maintenance.html" "$deploy_root/maintenance/maintenance.html"
install -d -o root -g tesla -m 0750 "$TESLA_CONFIG_DIR"
install -d -o tesla -g tesla -m 0700 "/var/backups/tesla/${instance}" /home/tesla/.gnupg

# 4. PostgreSQL -----------------------------------------------------------------------------------
log "PostgreSQL 18 (port ${pg_port}) : base ${db_name}"
systemctl enable --now postgresql
listen="$(psql_admin -tAc 'SHOW listen_addresses')"
[[ "$listen" == localhost || "$listen" == 127.0.0.1 ]] ||
  warn "listen_addresses = '${listen}' : PostgreSQL doit écouter en local uniquement."
db_password=""
if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${db_role}'")" != 1 ]]; then
  db_password="$(openssl rand -hex 24)"
  psql_admin -q -v ON_ERROR_STOP=1 \
    -c "CREATE ROLE ${db_role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${db_password}'"
fi
if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '${db_name}'")" != 1 ]]; then
  sudo -u postgres createdb -p "$pg_port" --owner="$db_role" "$db_name"
fi
# Extension requise par les migrations, créée ici pour ne pas donner ce droit à l'application.
psql_admin -q -d "$db_name" -c 'CREATE EXTENSION IF NOT EXISTS btree_gist'

# 5. Configuration de l'instance ------------------------------------------------------------------
log "Configuration ${env_file}"
if [[ ! -f "$env_file" ]]; then
  [[ -n "$db_password" ]] || { echo "Rôle ${db_role} déjà existant mais ${env_file} absent : renseigner DATABASE_URL à la main." >&2; exit 1; }
  medical_key="$(openssl rand -base64 32)"
  if [[ "$hosting" == vercel ]]; then
    origin="${web_url:-https://<projet>.vercel.app}"
    mode_edits=(-e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=${origin}#"
                -e "s%^# PUBLIC_APP_URL=.*%# PUBLIC_APP_URL=${origin}%")
  elif [[ "$hosting" == ovh ]]; then
    origin="${web_url:-https://<projet>.vercel.app}"
    mode_edits=(-e "s#^WEB_HOSTING=.*#WEB_HOSTING=ovh#"
                -e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=${origin}#"
                -e "s%^# PUBLIC_APP_URL=.*%# PUBLIC_APP_URL=${origin}%"
                -e "s%^# WEB_PORT=.*%WEB_PORT=${web_port}%"
                -e "s%^# NEXT_PUBLIC_API_URL=.*%NEXT_PUBLIC_API_URL=/api/v1%"
                -e "s%^# WEB_ORIGIN_DOMAIN=.*%WEB_ORIGIN_DOMAIN=${origin_domain}%")
  else
    mode_edits=(-e "s#^WEB_HOSTING=.*#WEB_HOSTING=local#"
                -e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=https://${domain}#"
                -e "s%^# PUBLIC_APP_URL=.*%# PUBLIC_APP_URL=https://${domain}%"
                -e "s%^# WEB_PORT=.*%WEB_PORT=${web_port}%"
                -e "s%^# NEXT_PUBLIC_API_URL=.*%NEXT_PUBLIC_API_URL=https://${domain}/api/v1%")
  fi
  sed -e "s#<domaine_api>#${domain}#g" -e "s#<domaine>#${domain}#g" \
      -e "s#^TESLA_DEPLOY_ROOT=.*#TESLA_DEPLOY_ROOT=${deploy_root}#" \
      -e "s#^TESLA_NODE_DIR=.*#TESLA_NODE_DIR=${node_dir}#" \
      -e "s#^API_PORT=.*#API_PORT=${api_port}#" \
      -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://${db_role}:${db_password}@127.0.0.1:${pg_port}/${db_name}?schema=public#" \
      -e "s#^MEDICAL_DATA_KEY=.*#MEDICAL_DATA_KEY=${medical_key}#" \
      -e "s#tesla-files-production#tesla-files-${instance}#g" \
      -e "s#^R2_KEY_PREFIX=.*#R2_KEY_PREFIX=${instance}#" \
      -e "s#/var/backups/tesla/production#/var/backups/tesla/${instance}#" \
      -e "s#tesla-backups/production#tesla-backups/${instance}#" \
      -e "s#:production-files#:${instance}-files#" \
      -e "s#5432/postgres#${pg_port}/postgres#" \
      "${mode_edits[@]}" \
      "$src/deploy/env/production.env.example" > "$env_file"
  chown root:tesla "$env_file"; chmod 0640 "$env_file"
  warn "MEDICAL_DATA_KEY générée dans ${env_file} : copiez-la MAINTENANT dans le coffre de l'association (hors VPS). Sans elle, les fiches médicales restaurées sont illisibles."
else
  echo "Fichier existant conservé (WEB_HOSTING=${hosting}, API_PORT=${api_port}, TESLA_NODE_DIR=${node_dir})."
fi

# 6. Code -----------------------------------------------------------------------------------------
log "Dépôt ${root}/repo"
if [[ ! -d "$root/repo/.git" ]]; then
  sudo -u tesla git clone --quiet "$repo_url" "$root/repo" ||
    { echo "Clonage impossible (dépôt privé ? ajouter une clé de déploiement pour tesla)." >&2; exit 1; }
elif [[ "$(stat -c %U "$root/repo")" != tesla ]]; then
  # Clone initial fait par un autre compte (ex. ubuntu) à cet emplacement : rendu à tesla, et à lui
  # seul (aucun autre chemin touché), pour que deploy.sh puisse le mettre à jour.
  chown -R tesla:tesla -- "$root/repo"
  warn "Propriété de ${root}/repo rendue à tesla."
fi

# 7. systemd, sudoers, alertes, journaux ----------------------------------------------------------
log "Unités systemd et outils"
for unit in "$src"/deploy/systemd/*.service "$src"/deploy/systemd/*.timer; do
  tesla_render_unit "$unit" "$deploy_root" "$node_dir" > "/etc/systemd/system/${unit##*/}"
  chmod 0644 "/etc/systemd/system/${unit##*/}"
done
install -m 0755 "$src/deploy/scripts/alert.sh" /usr/local/bin/tesla-alert
if (( journald )); then
  install -d -m 0755 /etc/systemd/journald.conf.d
  install -m 0644 "$src/deploy/journald/tesla.conf" /etc/systemd/journald.conf.d/tesla.conf
  systemctl restart systemd-journald
fi
sudoers_tmp="$(mktemp)"; cp "$src/deploy/sudoers/tesla" "$sudoers_tmp"
visudo -cqf "$sudoers_tmp" && install -m 0440 "$sudoers_tmp" /etc/sudoers.d/tesla; rm -f "$sudoers_tmp"
systemctl daemon-reload
systemctl enable "tesla-api@${instance}" \
  "tesla-daily@${instance}.timer" "tesla-backup@${instance}.timer" "tesla-healthcheck@${instance}.timer"
if [[ "$hosting" != vercel ]]; then
  # Activé pour le démarrage automatique, jamais démarré ici : deploy.sh le démarre avec un build.
  systemctl enable "tesla-web@${instance}"
elif systemctl is-enabled --quiet "tesla-web@${instance}" 2> /dev/null; then
  # Passage du mode historique à Vercel : le web n'est plus servi par ce VPS.
  systemctl disable --now "tesla-web@${instance}"
  warn "tesla-web@${instance} désactivé (WEB_HOSTING=vercel)."
fi

# 8. Nginx et TLS ---------------------------------------------------------------------------------
# Seuls les fichiers « tesla-<instance> » sont créés ; nginx -t en échec → fichier précédent rétabli,
# pour ne jamais laisser une configuration qui empêcherait le rechargement des autres sites.
log "Nginx et certificat pour ${domain}"
enable_site() {
  local target="$1" enabled="$2" previous=""
  previous="$(readlink "$enabled" 2> /dev/null || true)"
  ln -sfn "$target" "$enabled"
  if ! nginx -t; then
    if [[ -n "$previous" ]]; then ln -sfn "$previous" "$enabled"; else rm -f "$enabled"; fi
    echo "Configuration Nginx refusée : version précédente rétablie, aucun rechargement." >&2
    exit 1
  fi
  systemctl reload nginx
}
# render <gabarit> <domaine du vhost>
render() {
  sed -e "s/DOMAINE/${2}/g" -e "s/INSTANCE/${instance}/g" -e "s#TESLA_ROOT#${deploy_root}#g" \
      -e "s/PUBLIC_HOST/${public_host:-}/g" \
      -e "s/API_PORT/${api_port}/" -e "s/WEB_PORT/${web_port}/" "$1"
}
# install_site <nom> <domaine> <gabarit> : vhost HTTP provisoire et certificat si absent, puis
# vhost définitif ; nginx -t en échec → fichier précédent rétabli, aucun rechargement.
install_site() {
  local name="$1" vhost_domain="$2" template="$3"
  local site="/etc/nginx/sites-available/${name}" enabled="/etc/nginx/sites-enabled/${name}"
  local cert="/etc/letsencrypt/live/${vhost_domain}/fullchain.pem"
  if [[ ! -f "$cert" ]]; then
    render "$src/deploy/nginx/tesla-acme.conf" "$vhost_domain" > "${site}-acme"
    enable_site "${site}-acme" "$enabled"
    if (( tls )); then
      certbot certonly --webroot -w "$deploy_root/acme" -d "$vhost_domain" --email "$email" \
        --agree-tos --non-interactive --deploy-hook 'systemctl reload nginx'
    else
      warn "Certificat non demandé pour ${vhost_domain} (--no-tls) : relancer ce script quand le DNS pointe vers ce serveur."
    fi
  fi
  if [[ -f "$cert" ]]; then
    render "$template" "$vhost_domain" > "${site}.new"
    [[ -f "$site" ]] && cp -p "$site" "${site}.previous"
    mv -f "${site}.new" "$site"
    if ! (enable_site "$site" "$enabled"); then
      if [[ -f "${site}.previous" ]]; then mv -f "${site}.previous" "$site"; else rm -f "$site"; fi
      exit 1
    fi
    rm -f "${site}-acme" "${site}.previous"
  fi
}
if [[ "$hosting" != local ]]; then
  # Secret partagé avec le proxy Vercel (TESLA_PROXY_SECRET) : généré une fois, lisible par root seul.
  proxy_conf="/etc/nginx/tesla/${instance}-proxy.conf"
  install -d -o root -g root -m 0750 /etc/nginx/tesla
  if [[ ! -f "$proxy_conf" ]]; then
    (umask 077; printf '# Secret du proxy Vercel (TESLA_PROXY_SECRET) — ne jamais versionner.\nmap $http_x_tesla_proxy_secret $tesla_proxied_%s {\n    default 0;\n    "%s" 1;\n}\n' \
      "$instance" "$(openssl rand -hex 16)" > "$proxy_conf")
  fi
  # Vhost API conservé en mode ovh : il porte le secret et sert l'ancien web Vercel (retour arrière).
  install_site "tesla-${instance}" "$domain" "$src/deploy/nginx/tesla-api.conf"
else
  install_site "tesla-${instance}" "$domain" "$src/deploy/nginx/tesla.conf"
fi
if [[ "$hosting" == ovh ]]; then
  # Hôte public (domaine Vercel) : celui de CORS_ORIGINS (une seule origine attendue).
  cors="$(env_value CORS_ORIGINS)"
  public_host="${cors#https://}"
  [[ "$cors" == https://* && "$public_host" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] ||
    { echo "Mode ovh : CORS_ORIGINS doit être l'unique origine https du domaine Vercel (${cors})." >&2; exit 1; }
  [[ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]] ||
    { echo "Vhost API absent (certificat de ${domain}) : l'origine web en dépend, relancer après son obtention." >&2; exit 1; }
  log "Nginx et certificat de l'origine web ${origin_domain} (hôte public ${public_host})"
  install_site "tesla-${instance}-origin" "$origin_domain" "$src/deploy/nginx/tesla-origin.conf"
fi

# 9. Pare-feu -------------------------------------------------------------------------------------
if [[ "$firewall" != skip ]]; then
  log "Pare-feu UFW"
  if ufw status | grep -q '^Status: active'; then
    ufw allow 80/tcp > /dev/null; ufw allow 443/tcp > /dev/null
  elif [[ "$firewall" == enable ]]; then
    # Port(s) SSH réellement utilisés : jamais modifiés, toujours autorisés avant l'activation.
    for port in $(sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }'); do ufw allow "${port}/tcp" > /dev/null; done
    ufw allow 80/tcp > /dev/null; ufw allow 443/tcp > /dev/null
    ufw --force enable > /dev/null
  else
    warn "UFW inactif : laissé tel quel (d'autres applications du VPS peuvent écouter sur d'autres ports ; --enable-firewall pour l'activer)."
  fi
  ufw status verbose | sed -n '1,20p'
fi
if ss -ltnH | awk '{ print $4 }' | grep -Eq "^(0\.0\.0\.0|\[::\]|\*):${pg_port}$"; then
  warn "PostgreSQL écoute sur toutes les interfaces : corriger listen_addresses."
fi

# Bilan -------------------------------------------------------------------------------------------
log "Valeurs restant à compléter dans ${env_file}"
grep -nE '^[A-Z0-9_]+=.*<' "$env_file" | sed 's/=.*/=…/' || echo "Aucune."
cat <<EOF

Étapes suivantes (docs/DEPLOYMENT_VERCEL_OVH.md) :
  1. Compléter ${env_file} (R2, sauvegardes, ALERT_URL, CORS_ORIGINS) ; importer la clé PUBLIQUE GnuPG :
       sudo -u tesla gpg --import cle-publique.asc
     et configurer rclone pour tesla : sudo -u tesla rclone config
  2. Premier déploiement :  sudo -iu tesla ${root}/repo/deploy/scripts/deploy.sh ${instance} <étiquette>
  3. Timers :  systemctl start tesla-daily@${instance}.timer tesla-backup@${instance}.timer tesla-healthcheck@${instance}.timer
EOF
if [[ "$hosting" == ovh ]]; then
  cat <<EOF
  4. Vercel, simple proxy (docs/migration-ovh/07-bascule-vercel.md) : destination
     https://${origin_domain} dans deploy/vercel-proxy/vercel.json et variable sensible
       TESLA_PROXY_SECRET=<valeur entre guillemets dans : sudo cat /etc/nginx/tesla/${instance}-proxy.conf>
  5. Premier administrateur (instance neuve) : docs/DEPLOYMENT_VERCEL_OVH.md § 9.
EOF
elif [[ "$hosting" == vercel ]]; then
  cat <<EOF
  4. Vercel (projet, variables d'environnement « Production ») :
       NEXT_PUBLIC_API_URL=/api/v1   TESLA_API_ORIGIN=https://${domain}
       TESLA_PROXY_SECRET=<valeur entre guillemets dans : sudo cat /etc/nginx/tesla/${instance}-proxy.conf>
  5. Premier administrateur : docs/DEPLOYMENT_VERCEL_OVH.md § 9.
EOF
else
  echo "  4. Premier administrateur : docs/DEPLOYMENT.md § 3, étape 9."
fi
