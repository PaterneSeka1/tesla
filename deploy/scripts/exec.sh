#!/usr/bin/env bash
# Commande ponctuelle d'exploitation sur la version en service d'une instance, exécutée par
# l'utilisateur « tesla » depuis current/apps/api, avec l'environnement de l'instance et le Node.js
# de TESLA (TESLA_NODE_DIR, jamais /usr/bin/node). Exemples :
#   exec.sh production node dist/jobs/create-admin.js --email <adresse> …
#   exec.sh production npx prisma migrate status
#   exec.sh production npm run pedagogy:audit
# Usage : exec.sh <production|preproduction> <commande> [arguments…]
set -euo pipefail

instance="${1:?Usage : exec.sh <production|preproduction> <commande> [arguments…]}"
shift
(( $# )) || { echo "Usage : exec.sh <production|preproduction> <commande> [arguments…]" >&2; exit 1; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/common.sh
. "$here/common.sh"
tesla_check_instance "$instance"
[[ "$(id -un)" == "tesla" ]] || { echo "À exécuter en tant qu'utilisateur tesla." >&2; exit 1; }
tesla_load_env "$instance"
tesla_use_node
api="$(tesla_deploy_root)/${instance}/current/apps/api"
[[ -d "$api" ]] || { echo "Aucune version en service : ${api} (deploy.sh)." >&2; exit 1; }
cd "$api"
exec "$@"
