#!/usr/bin/env bash
# Contrôle de disponibilité : API (base comprise) et web. Code de sortie non nul en cas d'échec,
# exploitable par systemd (tesla-healthcheck@.timer) ou un service de surveillance externe.
# Usage : healthcheck.sh [url_publique]   (défaut : $PUBLIC_URL)
set -euo pipefail
base="${1:-${PUBLIC_URL:?PUBLIC_URL manquant}}"
base="${base%/}"
body="$(curl -fsS --max-time 10 "$base/api/v1/health")" || { echo "API injoignable" >&2; exit 1; }
grep -q '"status":"ok"' <<<"$body" || { echo "API dégradée : ${body}" >&2; exit 1; }
curl -fsS --max-time 10 -o /dev/null "$base/connexion" || { echo "Web injoignable" >&2; exit 1; }
echo "OK ${base}"
