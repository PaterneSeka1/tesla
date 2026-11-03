#!/usr/bin/env bash
# Test local de deploy.sh et rollback.sh, sans serveur : arborescence /var/www/tesla simulée dans un
# répertoire temporaire, dépôt Git jetable, npm/npx/sudo/id remplacés par des doublures, sauvegarde
# et contrôle de santé simulés. Aucun service, aucune base, aucun chemin réel n'est touché.
# Usage : bash deploy/scripts/tests/deploy-scripts.test.sh
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
t="$(mktemp -d)"
trap 'rm -rf "$t"' EXIT
failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'ÉCHEC %s\n' "$1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# Scripts testés (copie), sauvegarde et santé simulées.
mkdir -p "$t/scripts" "$t/bin" "$t/etc"
cp "$src"/deploy.sh "$src"/rollback.sh "$src"/common.sh "$t/scripts/"
printf '#!/usr/bin/env bash\necho backup >> "%s/calls"\n' "$t" > "$t/scripts/backup.sh"
printf '#!/usr/bin/env bash\n[[ "$(cat "%s/health")" == ok ]]\n' "$t" > "$t/scripts/healthcheck.sh"
chmod +x "$t"/scripts/*.sh

# Doublures : l'utilisateur est « tesla » ; sudo, npm et npx journalisent leurs arguments.
cat > "$t/bin/id" <<'EOF'
#!/usr/bin/env bash
[[ "${1:-}" == -un ]] && { echo tesla; exit 0; }
exec /usr/bin/id "$@"
EOF
cat > "$t/bin/sudo" <<EOF
#!/usr/bin/env bash
echo "sudo \$*" >> "$t/calls"
EOF
cat > "$t/bin/npm" <<EOF
#!/usr/bin/env bash
echo "npm \$*" >> "$t/calls"
[[ -f "$t/fail-build" && "\$1" == run ]] && exit 1
exit 0
EOF
cat > "$t/bin/npx" <<EOF
#!/usr/bin/env bash
echo "npx \$*" >> "$t/calls"
EOF
chmod +x "$t"/bin/*
export PATH="$t/bin:$PATH" TESLA_CONFIG_DIR="$t/etc"

# Instance installée : racine, dépôt de travail cloné d'un dépôt jetable.
www="$t/var/www/tesla"; root="$www/production"
mkdir -p "$root/releases"
git init -q --bare -b main "$t/origin.git"
git init -q -b main "$t/work"
git -C "$t/work" remote add origin "$t/origin.git"
commit() {
  mkdir -p "$t/work/apps/api" "$t/work/apps/web"
  echo "$1" > "$t/work/VERSION"; touch "$t/work/apps/api/.keep" "$t/work/apps/web/.keep"
  git -C "$t/work" add VERSION apps
  git -C "$t/work" -c user.name=test -c user.email=test@test.invalid commit -qm "$1"
  git -C "$t/work" tag -f "$1" > /dev/null
  git -C "$t/work" push -q --tags origin HEAD:main 2> /dev/null
}
commit v1
git clone -q "$t/origin.git" "$root/repo"
write_env() {
  cat > "$t/etc/production.env" <<EOF
WEB_HOSTING=$1
TESLA_DEPLOY_ROOT=$www
DATABASE_URL=postgresql://u:p@127.0.0.1:5432/db
PUBLIC_URL=https://api.tesla.test
CORS_ORIGINS=https://tesla.vercel.test
BACKUP_DIR=$t/backups
BACKUP_GPG_RECIPIENT=ABCDEF
NEXT_PUBLIC_API_URL=https://tesla.test/api/v1
EOF
}
write_env vercel
echo ok > "$t/health"
deploy() { : > "$t/calls"; "$t/scripts/deploy.sh" production "$1" > "$t/out" 2>&1 || { cat "$t/out" >&2; return 1; }; }
rollback() { : > "$t/calls"; "$t/scripts/rollback.sh" production "$@" > "$t/out" 2>&1; }
current() { cat "$root/current/VERSION"; }
releases() { find "$root/releases" -mindepth 1 -maxdepth 1 -type d | wc -l; }

# 1. Mode Vercel : API seule construite et redémarrée.
check "déploiement v1 (mode vercel)" deploy v1
check "lien current vers v1" test "$(current)" = v1
check "release v1 marquée saine" test -f "$root/current/HEALTHY"
check "build API seule (sans build Next.js)" grep -qx 'npm run build -w @tesla/api' "$t/calls"
check "aucun build de tous les espaces" bash -c "! grep -qx 'npm run build' '$t/calls'"
check "redémarrage de tesla-api seul" grep -qx 'sudo /usr/bin/systemctl restart tesla-api@production' "$t/calls"
check "sauvegarde avant migration" bash -c "grep -n . '$t/calls' | grep -A9 backup | grep -q 'prisma migrate deploy'"
check "verrou dans shared/" test -f "$root/shared/deploy.lock"

commit v2
check "déploiement v2" deploy v2
check "lien current vers v2" test "$(current)" = v2

# 2. Build en échec : release supprimée, service intact.
commit v3
touch "$t/fail-build"
before="$(releases)"
check "build en échec refusé" bash -c "! '$t/scripts/deploy.sh' production v3 > '$t/out' 2>&1"
rm -f "$t/fail-build"
check "release incomplète supprimée" test "$(releases)" = "$before"
check "version en service inchangée (v2)" test "$(current)" = v2

# 3. Santé en échec : retour automatique, release FAILED conservée.
echo ko > "$t/health"
sed -i 's/seq 1 30/seq 1 1/; s/sleep 2/true/' "$t/scripts/deploy.sh" "$t/scripts/rollback.sh"
check "santé en échec → code de sortie non nul" bash -c "! '$t/scripts/deploy.sh' production v3 > '$t/out' 2>&1"
check "retour automatique à v2" test "$(current)" = v2
check "release v3 marquée FAILED" bash -c "ls '$root'/releases/*/FAILED > /dev/null"
echo ok > "$t/health"

# 4. Retour arrière : dernière release saine hors current (v1), jamais une release FAILED.
check "rollback sans argument" rollback
check "lien current vers v1" test "$(current)" = v1
failed="$(dirname "$(ls "$root"/releases/*/FAILED)")"
check "rollback vers une release FAILED refusé" bash -c "! '$t/scripts/rollback.sh' production '$failed' > /dev/null 2>&1"
check "rollback hors de releases/ refusé" bash -c "! '$t/scripts/rollback.sh' production '$t' > /dev/null 2>&1"
check "rollback par lien ../ refusé" bash -c "! '$t/scripts/rollback.sh' production '$root/releases/../repo' > /dev/null 2>&1"

# 5. Verrou : un second déploiement concurrent est refusé.
exec 8> "$root/shared/deploy.lock"; flock -n 8
check "déploiement concurrent refusé" bash -c "! '$t/scripts/deploy.sh' production v2 > '$t/out' 2>&1 && grep -q 'déjà en cours' '$t/out'"
exec 8>&-

# 6. Mode historique : build complet, API et web redémarrés.
write_env local
check "déploiement v2 (mode local)" deploy v2
check "build de tous les espaces" grep -qx 'npm run build' "$t/calls"
check "redémarrage API et web" grep -qx 'sudo /usr/bin/systemctl restart tesla-api@production tesla-web@production' "$t/calls"
write_env vercel

# 7. Rétention : 5 releases saines + current ; FAILED au plus 2.
for v in v4 v5 v6 v7 v8 v9; do commit "$v"; deploy "$v"; done
healthy_kept="$(find "$root/releases" -mindepth 2 -maxdepth 2 -name HEALTHY | wc -l)"
check "rétention : 6 releases saines (current + 5)" test "$healthy_kept" = 6
check "current vers v9" test "$(current)" = v9

# 8. Garde-fous de chemin.
. "$t/scripts/common.sh"
for bad in / /var/www /var/www/ /opt /etc relative/path /var/www/tesla/../x '/var/www/te sla'; do
  check "racine refusée : '${bad}'" bash -c "TESLA_DEPLOY_ROOT='$bad'; . '$t/scripts/common.sh'; ! (tesla_deploy_root) 2> /dev/null"
done
check "racine par défaut /var/www/tesla" test "$(TESLA_DEPLOY_ROOT='' tesla_deploy_root)" = /var/www/tesla
check "suppression hors releases/ refusée" bash -c ". '$t/scripts/common.sh'; ! tesla_remove_release '$root' '$root/repo' 2> /dev/null"
check "suppression de la release en service refusée" \
  bash -c ". '$t/scripts/common.sh'; ! tesla_remove_release '$root' \"\$(readlink -f '$root/current')\" 2> /dev/null"
check "dépôt de travail intact" test -d "$root/repo/.git"
check "instance inconnue refusée" bash -c "! '$t/scripts/deploy.sh' staging v1 > /dev/null 2>&1"
check "variable à compléter refusée" bash -c "sed -i 's#^CORS_ORIGINS=.*#CORS_ORIGINS=https://<projet>.vercel.app#' '$t/etc/production.env'; ! '$t/scripts/deploy.sh' production v9 > /dev/null 2>&1"

if (( failures )); then echo "${failures} échec(s)." >&2; exit 1; fi
echo "Tous les contrôles des scripts de déploiement ont réussi."
