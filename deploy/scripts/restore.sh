#!/usr/bin/env bash
# Restaure une sauvegarde chiffrée dans une NOUVELLE base (jamais par-dessus une base existante).
# La bascule de l'application vers cette base est une étape distincte, documentée dans
# docs/BACKUP_RESTORE.md (arrêt des services, DATABASE_URL, redémarrage, contrôles).
# Usage : restore.sh <fichier.dump.gpg> <nouvelle_base>
#   BACKUP_RESTORE_CHECK_URL  connexion de maintenance avec droit CREATEDB (base « postgres »)
#   RESTORE_OWNER             facultatif : rôle propriétaire de la nouvelle base (ex. tesla)
#   Clé privée de sauvegarde importée dans le trousseau GnuPG de l'opérateur.
set -euo pipefail
umask 077

file="${1:?Usage : restore.sh <fichier.dump.gpg> <nouvelle_base>}"
target="${2:?Usage : restore.sh <fichier.dump.gpg> <nouvelle_base>}"
: "${BACKUP_RESTORE_CHECK_URL:?BACKUP_RESTORE_CHECK_URL manquant}"
[[ "$target" =~ ^[a-z][a-z0-9_]{2,62}$ ]] || { echo "Nom de base invalide : ${target}" >&2; exit 1; }
admin_url="${BACKUP_RESTORE_CHECK_URL%%\?*}"

exists="$(psql --dbname="$admin_url" -qAtc "SELECT 1 FROM pg_database WHERE datname = '${target}'")"
[[ -z "$exists" ]] || { echo "Refus : la base ${target} existe déjà (aucun écrasement)." >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [[ -f "$file.sha256" ]]; then
  (cd "$(dirname "$file")" && sha256sum --check --status "$(basename "$file").sha256") ||
    { echo "ÉCHEC : empreinte SHA-256 différente" >&2; exit 1; }
else
  echo "AVERTISSEMENT : aucune empreinte ${file}.sha256 à comparer" >&2
fi
gpg --batch --quiet --output "$work/backup.dump" --decrypt "$file"

owner_clause=""
[[ -n "${RESTORE_OWNER:-}" ]] && owner_clause=" OWNER \"${RESTORE_OWNER}\""
psql --dbname="$admin_url" -qAtc "CREATE DATABASE \"${target}\"${owner_clause}" >/dev/null
target_url="${admin_url%/*}/${target}"
pg_restore --no-owner --no-privileges --exit-on-error \
  ${RESTORE_OWNER:+--role="$RESTORE_OWNER"} --dbname="$target_url" "$work/backup.dump"
echo "Base ${target} restaurée. Suite : docs/BACKUP_RESTORE.md § Bascule."
