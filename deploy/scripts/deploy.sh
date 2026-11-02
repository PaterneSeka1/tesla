#!/usr/bin/env bash
# Mise en service d'une version de TESLA sur une instance (production ou préproduction), exécutée
# sur le serveur par l'utilisateur « tesla ». Aucune action n'est faite sur une autre instance.
#   1. contrôles préalables  2. release immuable (git archive)  3. npm ci + build
#   4. sauvegarde vérifiée   5. migrations (deploy)              6. bascule du lien « current »
#   7. redémarrage           8. contrôle de santé ; échec → retour automatique au code précédent
# Une release n'est marquée saine (fichier HEALTHY) qu'après un contrôle de santé réussi : seules
# ces releases servent au retour arrière. Build en échec → release supprimée ; santé en échec →
# release marquée FAILED (conservée pour diagnostic, jamais choisie par rollback.sh).
# Usage : deploy.sh <production|preproduction> <commit|étiquette>
set -euo pipefail
umask 027

instance="${1:?Usage : deploy.sh <production|preproduction> <commit|étiquette>}"
ref="${2:?Usage : deploy.sh <production|preproduction> <commit|étiquette>}"
[[ "$instance" =~ ^(production|preproduction)$ ]] || { echo "Instance inconnue : ${instance}" >&2; exit 1; }
root="/opt/tesla/${instance}"
env_file="/etc/tesla/${instance}.env"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log() { printf '%s [%s] %s\n' "$(date -u +%FT%TZ)" "$instance" "$*"; }

[[ "$(id -un)" == "tesla" ]] || { echo "À exécuter en tant qu'utilisateur tesla." >&2; exit 1; }
[[ -r "$env_file" ]] || { echo "Configuration absente : ${env_file}" >&2; exit 1; }
set -a; # shellcheck disable=SC1090
source "$env_file"; set +a
for var in DATABASE_URL PUBLIC_URL NEXT_PUBLIC_API_URL CORS_ORIGINS BACKUP_DIR BACKUP_GPG_RECIPIENT; do
  [[ -n "${!var:-}" ]] || { echo "Variable manquante dans ${env_file} : ${var}" >&2; exit 1; }
done
free_kb="$(df --output=avail -k "$root" | tail -1)"
(( free_kb > 2 * 1024 * 1024 )) || { echo "Moins de 2 Gio libres sur ${root}." >&2; exit 1; }

log "Préparation de ${ref}"
git -C "$root/repo" fetch --quiet --tags origin
sha="$(git -C "$root/repo" rev-parse --verify "${ref}^{commit}")"
release="$root/releases/$(date -u +%Y%m%d%H%M%S)-${sha:0:12}"
mkdir -p "$release"
# Toute erreur avant la bascule supprime la release incomplète (le service n'est pas touché).
trap 'rm -rf "$release"; log "ÉCHEC avant la bascule : release supprimée, version en service inchangée." >&2' ERR
git -C "$root/repo" archive "$sha" | tar -x -C "$release"
echo "$sha" > "$release/REVISION"

log "Installation et build"
(cd "$release" && npm ci --include=dev --no-audit --no-fund && npm run build)
# Cache de compilation Next (~600 Mo) inutile à l'exécution : jamais conservé dans une release.
rm -rf "$release/apps/web/.next/cache"

log "Sauvegarde avant migration"
"$here/backup.sh"

log "Migrations"
(cd "$release/apps/api" && npx prisma migrate deploy)

trap - ERR
previous="$(readlink -f "$root/current" 2>/dev/null || true)"
ln -sfn "$release" "$root/current.next" && mv -Tf "$root/current.next" "$root/current"
log "Redémarrage"
sudo /usr/bin/systemctl restart "tesla-api@${instance}" "tesla-web@${instance}"

for _ in $(seq 1 30); do
  if "$here/healthcheck.sh" "$PUBLIC_URL" > /dev/null 2>&1; then
    date -u +%FT%TZ > "$release/HEALTHY"
    log "Version ${sha:0:12} en service."
    # Conservation des cinq dernières versions saines (retour arrière rapide) ; les releases en
    # échec, conservées pour diagnostic, sont supprimées au-delà des deux plus récentes. La version en service n'est jamais
    # supprimée.
    current_dir="$(readlink -f "$root/current")"
    healthy=0; other=0
    for dir in $(ls -1dt "$root"/releases/*/ | sed 's#/$##'); do
      [[ "$dir" == "$current_dir" ]] && continue
      if [[ -f "$dir/HEALTHY" ]]; then
        healthy=$((healthy + 1)); (( healthy > 5 )) && rm -rf "$dir"
      else
        other=$((other + 1)); (( other > 2 )) && rm -rf "$dir"
      fi
    done
    exit 0
  fi
  sleep 2
done

log "ÉCHEC du contrôle de santé : retour au code précédent" >&2
date -u +%FT%TZ > "$release/FAILED"
if [[ -n "$previous" && -d "$previous" ]]; then
  ln -sfn "$previous" "$root/current.next" && mv -Tf "$root/current.next" "$root/current"
  sudo /usr/bin/systemctl restart "tesla-api@${instance}" "tesla-web@${instance}"
  log "Code précédent rétabli ($(cat "$previous/REVISION" 2>/dev/null || echo inconnu)). Les migrations, additives, restent appliquées." >&2
fi
exit 1
