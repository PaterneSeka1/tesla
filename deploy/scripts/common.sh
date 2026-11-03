# shellcheck shell=bash
# Fonctions communes des scripts d'exploitation (sourcé, jamais exécuté seul).
# Arborescence d'une instance (docs/DEPLOYMENT_VERCEL_OVH.md § 2) :
#   ${TESLA_DEPLOY_ROOT}/<instance>/{repo,releases/<AAAAMMJJhhmmss>-<sha12>,current,shared}
# TESLA_DEPLOY_ROOT : /var/www/tesla par défaut (variable d'environnement ou fichier d'instance).
# TESLA_CONFIG_DIR  : /etc/tesla par défaut ; autre valeur réservée aux tests locaux.
# TESLA_NODE_DIR    : dossier de node, npm et npx propres à TESLA (/opt/node22/bin par défaut,
#                     fichier d'instance) ; le Node.js système (/usr/bin/node) n'est jamais utilisé.
# TESLA_SYSTEMD_DIR : /etc/systemd/system par défaut ; autre valeur réservée aux tests locaux.

TESLA_CONFIG_DIR="${TESLA_CONFIG_DIR:-/etc/tesla}"
TESLA_SYSTEMD_DIR="${TESLA_SYSTEMD_DIR:-/etc/systemd/system}"
TESLA_NODE_DEFAULT_DIR=/opt/node22/bin

tesla_check_instance() {
  [[ "${1:-}" =~ ^(production|preproduction)$ ]] || { echo "Instance inconnue : ${1:-}" >&2; exit 1; }
}

# Racine de déploiement validée : chemin absolu, sans « .. » ni répertoire système ou partagé
# (jamais /var/www lui-même, qui héberge d'autres applications).
tesla_deploy_root() {
  local root="${TESLA_DEPLOY_ROOT:-/var/www/tesla}"
  root="${root%/}"
  if [[ ! "$root" =~ ^(/[A-Za-z0-9._-]+)+$ || "$root" =~ /\.\.?(/|$) ]]; then
    echo "TESLA_DEPLOY_ROOT invalide : ${root}" >&2; exit 1
  fi
  case "$root" in
    /bin | /boot | /dev | /etc | /home | /lib | /opt | /proc | /root | /run | /sbin | /srv | /sys | /tmp | \
      /usr | /var | /var/www | /var/lib | /var/log | /var/backups)
      echo "TESLA_DEPLOY_ROOT refusé (répertoire partagé) : ${root}" >&2; exit 1 ;;
  esac
  printf '%s\n' "$root"
}

tesla_load_env() {
  local env_file="${TESLA_CONFIG_DIR}/${1}.env"
  [[ -r "$env_file" ]] || { echo "Configuration absente : ${env_file}" >&2; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

# Hébergement du web : « vercel » (API seule sur le VPS) ou « local » (mode historique, Next.js
# servi par tesla-web@ derrière le même Nginx).
tesla_web_hosting() {
  case "${WEB_HOSTING:-local}" in
    vercel | local) printf '%s\n' "${WEB_HOSTING:-local}" ;;
    *) echo "WEB_HOSTING invalide : ${WEB_HOSTING} (vercel ou local)" >&2; exit 1 ;;
  esac
}

# Unités applicatives à redémarrer selon le mode (mêmes arguments que dans deploy/sudoers/tesla).
tesla_units() {
  if [[ "$(tesla_web_hosting)" == vercel ]]; then
    printf '%s\n' "tesla-api@${1}"
  else
    printf '%s\n' "tesla-api@${1}" "tesla-web@${1}"
  fi
}

# Un seul déploiement ou retour arrière à la fois par instance.
tesla_lock() {
  install -d -m 0750 "${1}/shared"
  exec 9> "${1}/shared/deploy.lock"
  flock -n 9 || { echo "Déploiement ou retour arrière déjà en cours sur ${1}." >&2; exit 1; }
}

# Suppression d'une release : uniquement un dossier daté de <instance>/releases, jamais « current ».
tesla_remove_release() {
  local instance_root="$1" dir="$2"
  [[ "${dir%/*}" == "${instance_root}/releases" && "${dir##*/}" =~ ^[0-9]{14}-[0-9a-f]{12}$ ]] ||
    { echo "Refus de supprimer ${dir} : hors de ${instance_root}/releases." >&2; return 1; }
  [[ "$(readlink -f "${instance_root}/current" 2>/dev/null)" != "$dir" ]] ||
    { echo "Refus de supprimer la release en service : ${dir}." >&2; return 1; }
  rm -rf -- "$dir"
}

# Bascule atomique du lien « current ».
tesla_switch_current() {
  ln -sfn "$2" "${1}/current.next" && mv -Tf "${1}/current.next" "${1}/current"
}

# Dossier Node.js de TESLA validé : chemin absolu sans « .. », hors /home et /root (invisibles des
# services systemd, ProtectHome=true).
tesla_node_dir() {
  local dir="${TESLA_NODE_DIR:-$TESLA_NODE_DEFAULT_DIR}"
  dir="${dir%/}"
  if [[ ! "$dir" =~ ^(/[A-Za-z0-9._-]+)+$ || "$dir" =~ /\.\.?(/|$) || "$dir" =~ ^/(home|root)(/|$) ]]; then
    echo "TESLA_NODE_DIR invalide : ${dir} (chemin absolu hors /home et /root)" >&2; exit 1
  fi
  printf '%s\n' "$dir"
}

# node (≥ 22.12, cf. package.json « engines »), npm et npx présents dans le dossier donné.
tesla_check_node() {
  local dir="$1" version major minor
  version="$("${dir}/node" --version 2> /dev/null || true)"
  IFS=. read -r major minor _ <<< "${version#v}"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] && (( major > 22 || (major == 22 && minor >= 12) )) ||
    { echo "Node.js ≥ 22.12 requis dans ${dir} (trouvé : ${version:-aucun}). Voir docs/DEPLOYMENT_VERCEL_OVH.md § 3." >&2; exit 1; }
  [[ -x "${dir}/npm" && -x "${dir}/npx" ]] || { echo "npm ou npx absent de ${dir}." >&2; exit 1; }
}

# Node.js de TESLA placé en tête du PATH du script courant (npm, npx, Prisma, Nest, tsx et les
# scripts « #!/usr/bin/env node » l'utilisent) ; aucun réglage global du serveur.
tesla_use_node() {
  local dir
  dir="$(tesla_node_dir)"
  tesla_check_node "$dir"
  export PATH="${dir}:${PATH}"
  hash -r
}

# Unité systemd rendue pour ce serveur : racine de déploiement et dossier Node.js de TESLA.
tesla_render_unit() {
  sed -e "s#/var/www/tesla#${2}#g" -e "s#${TESLA_NODE_DEFAULT_DIR}#${3}#g" "$1"
}

# Les unités installées qui exécutent node doivent utiliser le même dossier que le build ;
# sinon (ex. unités antérieures sur /usr/bin/node) : relancer bootstrap.sh.
tesla_check_units() {
  local node_dir="$1" unit file
  shift
  for unit in "$@"; do
    file="${TESLA_SYSTEMD_DIR}/${unit}"
    [[ ! -f "$file" ]] || grep -qF "ExecStart=${node_dir}/node " "$file" ||
      { echo "${file} n'exécute pas ${node_dir}/node : relancer bootstrap.sh avant de déployer." >&2; exit 1; }
  done
}
