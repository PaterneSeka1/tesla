#!/usr/bin/env bash
# Retour arrière du code vers une version précédente déjà installée (sans rebuild ni migration).
# Les migrations de TESLA sont additives : l'ancien code fonctionne sur le schéma plus récent.
# Si une migration non additive a été appliquée, suivre docs/BACKUP_RESTORE.md (restauration).
# Usage : rollback.sh <production|preproduction> [dossier_de_release]
set -euo pipefail

instance="${1:?Usage : rollback.sh <production|preproduction> [release]}"
[[ "$instance" =~ ^(production|preproduction)$ ]] || { echo "Instance inconnue : ${instance}" >&2; exit 1; }
root="/opt/tesla/${instance}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
current="$(readlink -f "$root/current")"
target="${2:-}"
if [[ -z "$target" ]]; then
  target="$(ls -1dt "$root"/releases/*/ | sed 's#/$##' | grep -vxF "$current" | head -1)"
fi
[[ -d "$target" && "$target" == "$root/releases/"* ]] || { echo "Release introuvable : ${target}" >&2; exit 1; }

echo "Retour de $(cat "$current/REVISION") vers $(cat "$target/REVISION")"
ln -sfn "$target" "$root/current.next" && mv -Tf "$root/current.next" "$root/current"
sudo /usr/bin/systemctl restart "tesla-api@${instance}" "tesla-web@${instance}"
set -a; # shellcheck disable=SC1090
source "/etc/tesla/${instance}.env"; set +a
for attempt in $(seq 1 30); do
  "$here/healthcheck.sh" "$PUBLIC_URL" && exit 0
  sleep 2
done
echo "Contrôle de santé en échec après retour arrière : voir journalctl -u tesla-api@${instance}" >&2
exit 1
