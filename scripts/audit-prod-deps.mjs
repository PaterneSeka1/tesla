/**
 * Audit des dépendances de production (paquets non `dev` du package-lock.json) par l'endpoint
 * « bulk » du registre npm. Remplace `npm audit --omit=dev`, que le registre refuse pour cet arbre
 * (« Invalid package tree » : pairs optionnels de @hookform/resolvers non installés).
 * Sortie non nulle si une vulnérabilité de gravité ≥ AUDIT_LEVEL (défaut : high) est connue.
 * Usage : node scripts/audit-prod-deps.mjs
 */
import { readFileSync } from 'node:fs';

const LEVELS = ['low', 'moderate', 'high', 'critical'];
const threshold = LEVELS.indexOf(process.env.AUDIT_LEVEL ?? 'high');
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

const versions = new Map();
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules/') || meta.dev || meta.link || !meta.version) continue;
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  if (!versions.has(name)) versions.set(name, new Set());
  versions.get(name).add(meta.version);
}

async function query(chunk) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(chunk.map((n) => [n, [...versions.get(n)]]))),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
}

const names = [...versions.keys()];
let blocking = 0;
for (let i = 0; i < names.length; i += 10) {
  for (const [name, advisories] of Object.entries(await query(names.slice(i, i + 10)))) {
    for (const advisory of advisories) {
      const severe = LEVELS.indexOf(advisory.severity) >= threshold;
      if (severe) blocking++;
      console.log(
        `${severe ? '✗' : '·'} ${advisory.severity} ${name}@${[...versions.get(name)].join(',')} ` +
          `${advisory.vulnerable_versions} — ${advisory.title} (${advisory.url})`,
      );
    }
  }
}
console.log(
  `${names.length} paquets de production analysés ; ${blocking} vulnérabilité(s) bloquante(s).`,
);
process.exitCode = blocking > 0 ? 1 : 0;
