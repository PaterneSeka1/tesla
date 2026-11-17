#!/usr/bin/env bash
# Contrôle de disponibilité : API (base comprise) et web selon WEB_HOSTING.
# - vercel : le web n'est pas servi par ce VPS ; sa disponibilité relève de Vercel et d'une
#   surveillance externe (une panne Vercel ne doit jamais déclencher un retour arrière de l'API).
# - ovh : web Next.js contrôlé en local (127.0.0.1:WEB_PORT), sans passer par Vercel ni par le vhost
#   d'origine, réservé au proxy Vercel (secret partagé).
# - local : web contrôlé sur l'URL publique.
# Code de sortie non nul en cas d'échec, exploitable par systemd (tesla-healthcheck@.timer) ou un
# service de surveillance externe.
# Usage : healthcheck.sh [url_publique]   (défaut : $PUBLIC_URL)
set -euo pipefail
base="${1:-${PUBLIC_URL:?PUBLIC_URL manquant}}"
base="${base%/}"
body="$(curl -fsS --max-time 10 "$base/api/v1/health")" || { echo "API injoignable" >&2; exit 1; }
grep -q '"status":"ok"' <<<"$body" || { echo "API dégradée : ${body}" >&2; exit 1; }
case "${WEB_HOSTING:-local}" in
  vercel) ;;
  ovh)
    [[ "${WEB_PORT:-}" =~ ^[0-9]+$ ]] || { echo "WEB_PORT manquant (WEB_HOSTING=ovh)" >&2; exit 1; }
    curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:${WEB_PORT}/connexion" ||
      { echo "Web injoignable (127.0.0.1:${WEB_PORT})" >&2; exit 1; }
    ;;
  *) curl -fsS --max-time 10 -o /dev/null "$base/connexion" || { echo "Web injoignable" >&2; exit 1; } ;;
esac
echo "OK ${base}"
