#!/usr/bin/env bash
# Contrôle de disponibilité : API (base comprise) et, en mode historique (WEB_HOSTING=local), web.
# Avec WEB_HOSTING=vercel, le web n'est pas servi par ce VPS : sa disponibilité relève de Vercel et
# d'une surveillance externe (une panne Vercel ne doit jamais déclencher un retour arrière de l'API).
# Code de sortie non nul en cas d'échec, exploitable par systemd (tesla-healthcheck@.timer) ou un
# service de surveillance externe.
# Usage : healthcheck.sh [url_publique]   (défaut : $PUBLIC_URL)
set -euo pipefail
base="${1:-${PUBLIC_URL:?PUBLIC_URL manquant}}"
base="${base%/}"
body="$(curl -fsS --max-time 10 "$base/api/v1/health")" || { echo "API injoignable" >&2; exit 1; }
grep -q '"status":"ok"' <<<"$body" || { echo "API dégradée : ${body}" >&2; exit 1; }
if [[ "${WEB_HOSTING:-local}" != vercel ]]; then
  curl -fsS --max-time 10 -o /dev/null "$base/connexion" || { echo "Web injoignable" >&2; exit 1; }
fi
echo "OK ${base}"
