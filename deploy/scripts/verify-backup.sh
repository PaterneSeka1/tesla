#!/usr/bin/env bash
# Restauration d'essai d'une sauvegarde dans une base jetable, contrôles, puis suppression de cette
# seule base jetable (préfixe tesla_restore_check_). Ne touche jamais la base de l'application.
# Usage : verify-backup.sh <fichier.dump | fichier.dump.gpg>
#   BACKUP_RESTORE_CHECK_URL  connexion de maintenance avec droit CREATEDB (base « postgres »)
#   Pour un fichier .gpg : clé privée de sauvegarde disponible (poste d'administration, pas le VPS).
set -euo pipefail
umask 077

file="${1:?Usage : verify-backup.sh <fichier.dump|fichier.dump.gpg>}"
: "${BACKUP_RESTORE_CHECK_URL:?BACKUP_RESTORE_CHECK_URL manquant}"
admin_url="${BACKUP_RESTORE_CHECK_URL%%\?*}"
work="$(mktemp -d)"
check_db="tesla_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
cleanup() {
  psql --dbname="$admin_url" -qAtc "DROP DATABASE IF EXISTS \"${check_db}\"" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

if [[ "$file" == *.gpg ]]; then
  if [[ -f "$file.sha256" ]]; then
    (cd "$(dirname "$file")" && sha256sum --check --status "$(basename "$file").sha256") ||
      { echo "ÉCHEC : empreinte SHA-256 différente" >&2; exit 1; }
  fi
  gpg --batch --quiet --output "$work/backup.dump" --decrypt "$file"
  file="$work/backup.dump"
fi

psql --dbname="$admin_url" -qAtc "CREATE DATABASE \"${check_db}\"" >/dev/null
check_url="${admin_url%/*}/${check_db}"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$check_url" "$file"

query() { psql --dbname="$check_url" -qAtc "$1"; }
migrations="$(query "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")"
last="$(query "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 1")"
echo "Migrations appliquées : ${migrations} (dernière : ${last})"
for table in users scout_profiles teams evaluation_attempts leadership_mandates audit_logs; do
  printf '%-22s %s lignes\n' "$table" "$(query "SELECT count(*) FROM ${table}")"
done
[[ "$migrations" -gt 0 ]] || { echo "ÉCHEC : aucune migration dans la sauvegarde" >&2; exit 1; }
echo "Restauration d'essai réussie."
