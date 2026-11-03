# shellcheck shell=bash
# Fonctions communes des scripts d'exploitation (sourcé, jamais exécuté seul).
# Arborescence d'une instance (docs/DEPLOYMENT_VERCEL_OVH.md § 2) :
#   ${TESLA_DEPLOY_ROOT}/<instance>/{repo,releases/<AAAAMMJJhhmmss>-<sha12>,current,shared}
# TESLA_DEPLOY_ROOT : /var/www/tesla par défaut (variable d'environnement ou fichier d'instance).
# TESLA_CONFIG_DIR  : /etc/tesla par défaut ; autre valeur réservée aux tests locaux.

TESLA_CONFIG_DIR="${TESLA_CONFIG_DIR:-/etc/tesla}"

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
