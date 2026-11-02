#!/usr/bin/env bash
# Test des scripts de sauvegarde et de restauration (D144), sans réseau ni Cloudflare : rclone et
# curl sont remplacés par des doubles locaux ; PostgreSQL, pg_dump/pg_restore et GnuPG sont réels.
# Usage : TEST_DATABASE_URL=postgresql://…/tesla_test deploy/scripts/tests/backup-scripts.test.sh
#   TEST_DATABASE_URL  base « *_test » sauvegardée (jamais modifiée) ; son rôle doit avoir CREATEDB
#                      pour la restauration d'essai et la restauration isolée (bases créées puis
#                      supprimées par le test, préfixe tesla_restore_).
# Exige pg_dump, pg_restore, psql (PostgreSQL 18), gpg et sha256sum dans le PATH.
set -Eeuo pipefail
umask 077

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL manquant}"
db_url="${TEST_DATABASE_URL%%\?*}"
[[ "${db_url##*/}" == *_test ]] || { echo "Refus : la base doit se terminer par _test" >&2; exit 1; }
scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(mktemp -d "${TMPDIR:-/tmp}/tesla-backup-test.XXXXXX")"
admin_url="${db_url%/*}/postgres"
restored="tesla_restore_test_$$"
cleanup() {
  psql --dbname="$admin_url" -qAtc "DROP DATABASE IF EXISTS \"${restored}\"" >/dev/null 2>&1 || true
  rm -rf "$root"
}
trap cleanup EXIT

passed=0
ok() { passed=$((passed + 1)); printf 'ok %d - %s\n' "$passed" "$1"; }
fail() { printf 'ÉCHEC - %s\n' "$1" >&2; exit 1; }

# Doubles : « remote:chemin » → répertoire local ; FAKE_NETWORK_DOWN=1 simule une coupure.
mkdir -p "$root/bin" "$root/remote" "$root/backups"
cat > "$root/bin/rclone" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
[[ "${FAKE_NETWORK_DOWN:-0}" == 1 ]] && { echo "rclone: dial tcp: network unreachable" >&2; exit 1; }
map() { if [[ "$1" == *:* ]]; then echo "$FAKE_REMOTE_ROOT/${1#*:}"; else echo "$1"; fi; }
cmd="$1"; shift
args=(); include=""
while (($#)); do
  case "$1" in
    --include) include="$2"; shift 2 ;;
    --*) shift ;;
    *) args+=("$(map "$1")"); shift ;;
  esac
done
case "$cmd" in
  copy)
    mkdir -p "${args[1]}"
    if [[ -f "${args[0]}" ]]; then
      target="${args[1]%/}/$(basename "${args[0]}")"
      [[ -e "$target" ]] && { echo "immutable: exists" >&2; exit 1; }
      cp "${args[0]}" "$target"
    else
      cp -rn "${args[0]}/." "${args[1]}/"
    fi ;;
  check|cryptcheck)
    for file in "${args[0]}"/${include:-*}; do
      cmp -s "$file" "${args[1]}/$(basename "$file")" || { echo "différence : $file" >&2; exit 1; }
    done ;;
  *) echo "commande non simulée : $cmd" >&2; exit 2 ;;
esac
FAKE
cat > "$root/bin/curl" <<'FAKE'
#!/usr/bin/env bash
printf '%s\n' "${@: -1}" >> "$FAKE_CURL_LOG"
FAKE
chmod +x "$root/bin/rclone" "$root/bin/curl"
export PATH="$root/bin:$PATH" FAKE_REMOTE_ROOT="$root/remote" FAKE_CURL_LOG="$root/curl.log"
touch "$FAKE_CURL_LOG"

# Clé de sauvegarde jetable (aucune phrase secrète) ; trousseau distinct pour la « mauvaise clé ».
export GNUPGHOME="$root/gnupg"
mkdir -p "$GNUPGHOME" "$root/gnupg-other"
chmod 700 "$GNUPGHOME" "$root/gnupg-other"
gpg --batch --quiet --passphrase '' --quick-gen-key 'Sauvegarde TESLA test <test@example.test>' \
  default default never 2>/dev/null
recipient="$(gpg --batch --list-keys --with-colons | awk -F: '/^fpr/ {print $10; exit}')"
GNUPGHOME="$root/gnupg-other" gpg --batch --quiet --passphrase '' \
  --quick-gen-key 'Autre clé <autre@example.test>' default default never 2>/dev/null

common=(DATABASE_URL="$db_url" BACKUP_DIR="$root/backups" BACKUP_GPG_RECIPIENT="$recipient"
  BACKUP_REMOTE="fake:tesla-backups/test" BACKUP_ALERT_URL="https://alert.example.test/echec"
  BACKUP_HEARTBEAT_URL="https://alert.example.test/ok" BACKUP_MIN_FREE_MB=1)

# 1. Sauvegarde réussie avec restauration d'essai, copie vérifiée, copie locale supprimée.
env "${common[@]}" BACKUP_RETENTION_DAYS=0 BACKUP_RESTORE_CHECK_URL="$admin_url" \
  "$scripts/backup.sh" > "$root/run1.log" 2>&1 || { cat "$root/run1.log"; fail "sauvegarde réussie"; }
remote_file="$(find "$root/remote/tesla-backups/test" -name 'tesla-*.dump.gpg' | head -1)"
[[ -n "$remote_file" && -f "$remote_file.sha256" ]] || fail "copie distante absente"
[[ -z "$(find "$root/backups" -maxdepth 1 -name 'tesla-*.dump.gpg*')" ]] || fail "copie locale conservée"
grep -q "Restauration d'essai réussie" "$root/run1.log" || fail "restauration d'essai absente"
grep -q 'https://alert.example.test/ok' "$FAKE_CURL_LOG" || fail "signal de réussite absent"
! grep -q "$db_url" "$root/run1.log" || fail "URL de base dans le journal"
ok "sauvegarde réussie : chiffrée, copiée, vérifiée, copie locale supprimée, signal de réussite"

# Le fichier distant n'est pas un dump en clair.
! grep -q '_prisma_migrations' "$remote_file" || fail "sauvegarde non chiffrée"
ok "le fichier envoyé est chiffré"

# 2. Échec réseau : code non nul, alerte émise, copie locale conservée.
: > "$FAKE_CURL_LOG"
sleep 1
if env "${common[@]}" BACKUP_RETENTION_DAYS=0 FAKE_NETWORK_DOWN=1 \
  "$scripts/backup.sh" > "$root/run2.log" 2>&1; then fail "échec réseau non détecté"; fi
grep -q 'https://alert.example.test/echec' "$FAKE_CURL_LOG" || fail "alerte absente"
[[ -n "$(find "$root/backups" -maxdepth 1 -name 'tesla-*.dump.gpg')" ]] || fail "copie locale perdue"
ok "échec réseau : alerte émise, copie locale conservée"

# 3. Rétention 0 sans destination distante : refusée (la seule copie serait supprimée).
if env "${common[@]}" BACKUP_REMOTE= BACKUP_RETENTION_DAYS=0 "$scripts/backup.sh" >/dev/null 2>&1; then
  fail "rétention 0 sans distant acceptée"
fi
ok "rétention locale nulle refusée sans copie distante"

# 3 bis. Stockage objet actif sans copie des fichiers applicatifs : base copiée, puis échec et alerte.
: > "$FAKE_CURL_LOG"
sleep 1
before="$(find "$root/remote/tesla-backups/test" -name 'tesla-*.dump.gpg' | wc -l)"
if env "${common[@]}" BACKUP_RETENTION_DAYS=0 R2_BUCKET_NAME=tesla-files-test \
  "$scripts/backup.sh" > "$root/run3.log" 2>&1; then fail "fichiers non sauvegardés acceptés"; fi
after="$(find "$root/remote/tesla-backups/test" -name 'tesla-*.dump.gpg' | wc -l)"
(( after == before + 1 )) || fail "base non copiée avant l'échec"
grep -q 'https://alert.example.test/echec' "$FAKE_CURL_LOG" || fail "alerte absente (fichiers)"
grep -q 'fichiers applicatifs NON sauvegardés' "$root/run3.log" || fail "message absent"
ok "stockage objet sans copie des fichiers : base copiée, échec signalé et alerté"

# 4. Restauration complète depuis la copie distante, dans une base isolée, puis intégrité.
mkdir -p "$root/restore"
cp "$remote_file" "$remote_file.sha256" "$root/restore/"
local_copy="$root/restore/$(basename "$remote_file")"
BACKUP_RESTORE_CHECK_URL="$admin_url" "$scripts/restore.sh" "$local_copy" "$restored" >/dev/null
restored_url="${db_url%/*}/${restored}"
for table in _prisma_migrations users pedagogical_modules module_resources stored_files audit_logs; do
  a="$(psql --dbname="$db_url" -qAtc "SELECT count(*) FROM ${table}")"
  b="$(psql --dbname="$restored_url" -qAtc "SELECT count(*) FROM ${table}")"
  [[ "$a" == "$b" ]] || fail "intégrité : ${table} ${a} ≠ ${b}"
done
psql --dbname="$restored_url" -qAtc "SELECT tgname FROM pg_trigger WHERE tgname = 'stored_files_guard'" |
  grep -q stored_files_guard || fail "trigger non restauré"
ok "restauration dans une base isolée : comptages identiques, triggers présents"

# 5. Restauration par-dessus une base existante : refusée.
if BACKUP_RESTORE_CHECK_URL="$admin_url" "$scripts/restore.sh" "$local_copy" "$restored" >/dev/null 2>&1; then
  fail "écrasement accepté"
fi
ok "restauration sur une base existante refusée"

# 6. Fichier corrompu : empreinte différente détectée avant tout déchiffrement.
cp "$local_copy" "$root/restore/corrompu.dump.gpg"
sed "s/$(basename "$local_copy")/corrompu.dump.gpg/" "$local_copy.sha256" > "$root/restore/corrompu.dump.gpg.sha256"
printf '\x00' | dd of="$root/restore/corrompu.dump.gpg" bs=1 seek=200 conv=notrunc status=none
if BACKUP_RESTORE_CHECK_URL="$admin_url" "$scripts/verify-backup.sh" "$root/restore/corrompu.dump.gpg" \
  > "$root/run6.log" 2>&1; then fail "corruption non détectée"; fi
grep -q 'empreinte SHA-256 différente' "$root/run6.log" || fail "message de corruption absent"
ok "fichier corrompu détecté par l'empreinte"

# 7. Mauvaise clé : déchiffrement impossible, aucune base créée.
rm -f "$local_copy.sha256"
if GNUPGHOME="$root/gnupg-other" BACKUP_RESTORE_CHECK_URL="$admin_url" \
  "$scripts/verify-backup.sh" "$local_copy" >/dev/null 2>&1; then fail "mauvaise clé acceptée"; fi
leftover="$(psql --dbname="$admin_url" -qAtc "SELECT count(*) FROM pg_database WHERE datname LIKE 'tesla_restore_check_%'")"
[[ "$leftover" == 0 ]] || fail "base jetable non supprimée"
ok "clé de déchiffrement incorrecte refusée, aucune base laissée"

echo "${passed} contrôles réussis."
