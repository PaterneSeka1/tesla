/**
 * Seed pédagogique seul : `npm run db:seed:pedagogy` (ou `-- --dry-run` pour prévisualiser sans écrire).
 * Requiert les étapes de progression (seed principal). Ne modifie jamais un module déjà importé.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from './route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from './scoutisme-base.seed.js';
import { formatImportReport, importSourceModules } from './source-modules.js';

// Même fichier .env que prisma.config.ts (racine du monorepo).
const rootEnvFile = path.resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');
const dryRun = process.argv.includes('--dry-run');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const results = await importSourceModules(
    prisma,
    [...SCOUTISME_BASE_MODULES, ...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES],
    { dryRun },
  );
  console.log(formatImportReport(results, dryRun));
} finally {
  await prisma.$disconnect();
}
