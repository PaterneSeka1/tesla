#!/usr/bin/env bash
# Alerte d'exploitation, appelée par tesla-alert@.service quand une unité TESLA échoue
# (OnFailure= : contrôle de santé, traitement quotidien, sauvegarde). Envoie un court message texte
# en POST à ALERT_URL (ntfy, Healthchecks, passerelle e-mail…) ; jamais de secret ni de journal.
# Usage : alert.sh <unité-instance>   ex. tesla-healthcheck-production
set -euo pipefail
unit="${1:?Usage : alert.sh <unité-instance>}"
instance="${unit##*-}"
[[ "$instance" =~ ^(production|preproduction)$ ]] || { echo "Instance inconnue : ${instance}" >&2; exit 1; }
env_file="/etc/tesla/${instance}.env"
alert_url=""
if [[ -r "$env_file" ]]; then
  alert_url="$(sed -n 's/^ALERT_URL=//p' "$env_file" | tail -1)"
fi
message="TESLA ${instance} : échec de ${unit%-*} sur $(hostname) à $(date -u +%FT%TZ). Voir journalctl -u ${unit%-*}@${instance}."
echo "$message" >&2
if [[ -z "$alert_url" ]]; then
  echo "ALERT_URL absent de ${env_file} : alerte limitée au journal." >&2
  exit 0
fi
curl -fsS --max-time 10 --retry 2 -o /dev/null --data "$message" "$alert_url"
