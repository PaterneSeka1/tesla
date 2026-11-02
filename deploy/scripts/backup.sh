#!/usr/bin/env bash
# Sauvegarde PostgreSQL de TESLA : dump « custom », contrôle, chiffrement GnuPG (clé publique seule
# sur le serveur), empreinte SHA-256, copie hors du VPS (rclone, Cloudflare R2 en production, D144)
# et rétention locale. Optionnellement, copie chiffrée des fichiers applicatifs (compartiment R2).
# Variables (fichier /etc/tesla/<instance>.env) :
#   DATABASE_URL            connexion de l'application (le paramètre ?schema= est ignoré)
#   BACKUP_DIR              répertoire local des sauvegardes chiffrées (ex. /var/backups/tesla/production)
#   BACKUP_GPG_RECIPIENT    empreinte de la clé publique de sauvegarde (clé privée conservée hors VPS)
#   BACKUP_REMOTE           facultatif : destination rclone hors VPS (ex. r2-backup:tesla-backups/production)
#   BACKUP_RETENTION_DAYS   facultatif : rétention locale en jours (défaut 14). 0 = copie locale
#                           supprimée dès que la copie distante est vérifiée (exige BACKUP_REMOTE).
#   BACKUP_MIN_FREE_MB      facultatif : espace libre minimal avant le dump (défaut 1024 Mo)
#   BACKUP_RESTORE_CHECK_URL facultatif : connexion de maintenance (droit CREATEDB) pour une
#                           restauration d'essai complète avant chiffrement (verify-backup.sh)
#   FILES_BACKUP_SOURCE     facultatif : compartiment des fichiers applicatifs, en lecture seule
#                           (ex. r2-files-ro:tesla-files-production)
#   FILES_BACKUP_REMOTE     facultatif : destination chiffrée (remote rclone « crypt »,
#                           ex. r2-backup-crypt:production-files) ; ajout seul, jamais de suppression
#   BACKUP_ALERT_URL        facultatif : URL appelée (POST) en cas d'échec (supervision, ntfy…)
#   BACKUP_HEARTBEAT_URL    facultatif : URL appelée (GET) après une réussite (détecte l'absence
#                           de sauvegarde, pas seulement les échecs)
set -Eeuo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${BACKUP_DIR:?BACKUP_DIR manquant}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT manquant}"
retention="${BACKUP_RETENTION_DAYS:-14}"
[[ "$retention" =~ ^[0-9]+$ ]] || { echo "BACKUP_RETENTION_DAYS invalide : ${retention}" >&2; exit 1; }
if [[ "$retention" -eq 0 && -z "${BACKUP_REMOTE:-}" ]]; then
  echo "BACKUP_RETENTION_DAYS=0 exige BACKUP_REMOTE (la seule copie serait supprimée)." >&2
  exit 1
fi
db_url="${DATABASE_URL%%\?*}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# Alerte sur toute erreur (jamais de secret ni d'URL de base dans le message).
alert() {
  local status=$?
  if [[ -n "${BACKUP_ALERT_URL:-}" ]]; then
    curl -fsS --max-time 10 --retry 2 -o /dev/null \
      --data "TESLA : échec de la sauvegarde $(hostname) (code ${status}, $(date -u +%FT%TZ))" \
      "$BACKUP_ALERT_URL" || log "Alerte non transmise" >&2
  fi
}
trap alert ERR

mkdir -p "$BACKUP_DIR"
free_mb="$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
if [[ "$free_mb" -lt "${BACKUP_MIN_FREE_MB:-1024}" ]]; then
  log "ÉCHEC : espace disque insuffisant (${free_mb} Mo libres dans ${BACKUP_DIR})" >&2
  false
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="tesla-${stamp}.dump"
work="$(mktemp -d "${BACKUP_DIR}/.work.XXXXXX")"
trap 'rm -rf "$work"' EXIT

log "Sauvegarde ${name} : dump"
pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --dbname="$db_url" --file="$work/$name"

# Contrôle minimal : archive lisible et contenant la table des migrations. `grep -c` lit toute la
# liste : `grep -q` fermerait le tube au premier résultat (SIGPIPE, échec sous pipefail).
if ! pg_restore --list "$work/$name" | grep -c '_prisma_migrations' >/dev/null; then
  log "ÉCHEC : archive illisible ou incomplète" >&2
  false
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

size="$(du -h "$BACKUP_DIR/$name.gpg" | cut -f1)"
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  # Aucune suppression ni écrasement distant : la rétention distante relève du cycle de vie du
  # compartiment (règles R2), hors de portée des identifiants de ce serveur.
  log "Copie hors VPS vers ${BACKUP_REMOTE}"
  rclone copy --immutable "$BACKUP_DIR/$name.gpg" "$BACKUP_REMOTE/"
  rclone copy --immutable "$BACKUP_DIR/$name.gpg.sha256" "$BACKUP_REMOTE/"
  # Contrôle par relecture : contenu distant comparé octet à octet à la copie locale.
  rclone check --one-way --download --include "$name.gpg*" "$BACKUP_DIR" "$BACKUP_REMOTE"
  if [[ "$retention" -eq 0 ]]; then
    rm -f "$BACKUP_DIR/$name.gpg" "$BACKUP_DIR/$name.gpg.sha256"
    log "Copie locale supprimée après vérification de la copie distante"
  fi
else
  log "AVERTISSEMENT : BACKUP_REMOTE absent, sauvegarde conservée sur le VPS seulement" >&2
fi

# Rétention locale : seuls les fichiers produits par ce script sont concernés.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'tesla-*.dump.gpg' -o -name 'tesla-*.dump.gpg.sha256' \) \
  -mtime +"$retention" -print -delete

# Fichiers applicatifs : objets immuables (clés jamais réutilisées), copie incrémentale chiffrée
# par le remote « crypt », sans propagation des suppressions (aucun --delete).
if [[ -n "${FILES_BACKUP_SOURCE:-}" && -n "${FILES_BACKUP_REMOTE:-}" ]]; then
  log "Copie des fichiers applicatifs vers ${FILES_BACKUP_REMOTE}"
  rclone copy --immutable --checksum "$FILES_BACKUP_SOURCE" "$FILES_BACKUP_REMOTE"
  rclone cryptcheck --one-way "$FILES_BACKUP_SOURCE" "$FILES_BACKUP_REMOTE"
fi

log "Terminé : ${name}.gpg (${size})"
if [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]]; then
  curl -fsS --max-time 10 --retry 2 -o /dev/null "$BACKUP_HEARTBEAT_URL" ||
    log "AVERTISSEMENT : signal de réussite non transmis" >&2
fi
