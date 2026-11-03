#!/usr/bin/env bash
# Retour arrière du code vers une version précédente déjà installée (sans rebuild ni migration).
# Les migrations de TESLA sont additives : l'ancien code fonctionne sur le schéma plus récent.
# Si une migration non additive a été appliquée, suivre docs/BACKUP_RESTORE.md (restauration).
# Avec WEB_HOSTING=vercel, ne concerne que l'API : le web se ramène par « Instant Rollback » Vercel.
# Usage : rollback.sh <production|preproduction> [dossier_de_release]
set -euo pipefail

instance="${1:?Usage : rollback.sh <production|preproduction> [release]}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/common.sh
. "$here/common.sh"
tesla_check_instance "$instance"
[[ "$(id -un)" == "tesla" ]] || { echo "À exécuter en tant qu'utilisateur tesla." >&2; exit 1; }
tesla_load_env "$instance"
root="$(tesla_deploy_root)/${instance}"
mapfile -t units < <(tesla_units "$instance")
tesla_lock "$root"
current="$(readlink -f "$root/current")"
target="${2:-}"
if [[ -z "$target" ]]; then
  # Release saine la plus récente (contrôle de santé réussi lors de sa mise en service).
  for dir in $(ls -1dt "$root"/releases/*/ | sed 's#/$##'); do
    [[ "$dir" != "$current" && -f "$dir/HEALTHY" && ! -f "$dir/FAILED" ]] && { target="$dir"; break; }
  done
else
  target="$(readlink -f "$target" || true)"
fi
[[ -n "$target" && -d "$target" && "${target%/*}" == "$root/releases" ]] ||
  { echo "Release saine introuvable : ${target:-aucune}" >&2; exit 1; }
[[ -f "$target/FAILED" ]] && { echo "Release marquée en échec : ${target}" >&2; exit 1; }

echo "Retour de $(cat "$current/REVISION") vers $(cat "$target/REVISION")"
tesla_switch_current "$root" "$target"
sudo /usr/bin/systemctl restart "${units[@]}"
for _ in $(seq 1 30); do
  "$here/healthcheck.sh" "$PUBLIC_URL" && exit 0
  sleep 2
done
echo "Contrôle de santé en échec après retour arrière : voir journalctl -u tesla-api@${instance}" >&2
exit 1
