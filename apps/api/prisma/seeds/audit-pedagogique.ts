/**
 * Vérificateur pédagogique : `npm run pedagogy:audit [-- --json] [-- --liens]`.
 * Lecture seule. Code de sortie 1 si un module destiné à la publication porte une anomalie bloquante.
 * `--json` : rapport exploitable automatiquement ; `--liens` : contrôle réseau des liens externes.
 * Voir `pedagogy-audit.ts`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { auditCatalog, formatAuditReport } from './pedagogy-audit.js';

const rootEnvFile = path.resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const report = await auditCatalog(prisma, { checkLinks: process.argv.includes('--liens') });
  console.log(
    process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatAuditReport(report),
  );
  if (report.summary.blockingModules > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
