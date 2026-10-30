#!/usr/bin/env bash
# Sauvegarde PostgreSQL de TESLA : dump « custom », contrôle, chiffrement GnuPG (clé publique seule
# sur le serveur), empreinte SHA-256, copie hors du VPS (rclone) et rétention locale.
# Variables (fichier /etc/tesla/<instance>.env) :
#   DATABASE_URL            connexion de l'application (le paramètre ?schema= est ignoré)
#   BACKUP_DIR              répertoire local des sauvegardes chiffrées (ex. /var/backups/tesla/production)
#   BACKUP_GPG_RECIPIENT    empreinte de la clé publique de sauvegarde (clé privée conservée hors VPS)
#   BACKUP_REMOTE           facultatif : destination rclone hors VPS (ex. offsite:tesla/production)
#   BACKUP_RETENTION_DAYS   facultatif : rétention locale en jours (défaut 14)
#   BACKUP_RESTORE_CHECK_URL facultatif : connexion de maintenance (droit CREATEDB) pour une
#                           restauration d'essai complète avant chiffrement (verify-backup.sh)
set -euo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${BACKUP_DIR:?BACKUP_DIR manquant}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT manquant}"
retention="${BACKUP_RETENTION_DAYS:-14}"
db_url="${DATABASE_URL%%\?*}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="tesla-${stamp}.dump"
work="$(mktemp -d "${BACKUP_DIR}/.work.XXXXXX")"
trap 'rm -rf "$work"' EXIT

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "Sauvegarde ${name} : dump"
pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --dbname="$db_url" --file="$work/$name"

# Contrôle minimal : archive lisible et contenant la table des migrations.
if ! pg_restore --list "$work/$name" | grep -q '_prisma_migrations'; then
  log "ÉCHEC : archive illisible ou incomplète" >&2
  exit 1
fi
if [[ -n "${BACKUP_RESTORE_CHECK_URL:-}" ]]; then
  log "Restauration d'essai complète"
  "$here/verify-backup.sh" "$work/$name"
fi

log "Chiffrement pour ${BACKUP_GPG_RECIPIENT}"
gpg --batch --yes --quiet --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" \
  --output "$work/$name.gpg" --encrypt "$work/$name"
(cd "$work" && sha256sum "$name.gpg" > "$name.gpg.sha256")
mv "$work/$name.gpg" "$work/$name.gpg.sha256" "$BACKUP_DIR/"

if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  log "Copie hors VPS vers ${BACKUP_REMOTE}"
  rclone copy --immutable "$BACKUP_DIR/$name.gpg" "$BACKUP_REMOTE/"
  rclone copy --immutable "$BACKUP_DIR/$name.gpg.sha256" "$BACKUP_REMOTE/"
  rclone check --one-way --include "$name.gpg*" "$BACKUP_DIR" "$BACKUP_REMOTE"
else
  log "AVERTISSEMENT : BACKUP_REMOTE absent, sauvegarde conservée sur le VPS seulement" >&2
fi

# Rétention locale : seuls les fichiers produits par ce script sont concernés.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'tesla-*.dump.gpg' -o -name 'tesla-*.dump.gpg.sha256' \) \
  -mtime +"$retention" -print -delete

log "Terminé : ${BACKUP_DIR}/${name}.gpg ($(du -h "$BACKUP_DIR/$name.gpg" | cut -f1))"
