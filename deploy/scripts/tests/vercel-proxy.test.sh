#!/usr/bin/env bash
# Contrôle statique de deploy/vercel-proxy/vercel.json (proxy Vercel du mode WEB_HOSTING=ovh) :
# une seule route qui relaie tout vers une origine https, secret ajouté depuis une variable
# d'environnement (jamais en clair), cache CDN désactivé, aucun framework ni build.
# --ready : exige en plus que l'origine réelle remplace <domaine_origine> (avant la bascule).
# Usage : bash deploy/scripts/tests/vercel-proxy.test.sh [--ready]
set -euo pipefail
file="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/vercel-proxy/vercel.json"
READY="${1:-}" node - "$file" <<'JS'
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${name}`); if (!ok) failures++; };
const routes = config.routes ?? [];
const [route] = routes;
check('aucun framework (Vercel ne construit rien)', config.framework === null);
check('ni rewrites, ni redirects, ni headers, ni functions hors routes',
  !['rewrites', 'redirects', 'headers', 'functions', 'buildCommand', 'cleanUrls', 'trailingSlash'].some((k) => k in config));
check('une seule route', routes.length === 1);
check('route attrape-tout', route?.src === '/(.*)');
const dest = /^https:\/\/([a-z0-9.-]+|<domaine_origine>)\/\$1$/.exec(route?.dest ?? '');
check('destination https://<origine>/$1 sans chemin', Boolean(dest));
check('origine différente du domaine public', dest?.[1] !== 'nikola-tesla-academie.vercel.app');
check('cache CDN des réécritures désactivé', route?.headers?.['x-vercel-enable-rewrite-caching'] === '0');
const secret = (route?.transforms ?? []).find((t) => t.target?.key === 'x-tesla-proxy-secret');
check('secret posé (set) sur la requête', secret?.type === 'request.headers' && secret?.op === 'set');
check('secret lu dans TESLA_PROXY_SECRET', secret?.args === '$TESLA_PROXY_SECRET' &&
  JSON.stringify(secret?.env) === '["TESLA_PROXY_SECRET"]');
check('aucun secret en clair dans le fichier', !/[0-9a-f]{32}/i.test(JSON.stringify(config)));
if (process.env.READY === '--ready')
  check('origine réelle renseignée', Boolean(dest) && dest[1] !== '<domaine_origine>');
if (failures) { console.error(`${failures} échec(s).`); process.exit(1); }
console.log('Configuration du proxy Vercel conforme.');
JS
