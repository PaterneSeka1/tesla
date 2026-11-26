/**
 * Référentiel scout seul : `npm run db:seed:reference` (ou `-- --dry-run` pour prévisualiser).
 * Importe les contenus fournis comme brouillons, crée les rubriques de départ absentes et range les
 * textes existants. Aucune publication. Voir `reference-catalog.ts`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { formatReferenceReport, seedReference } from './reference-catalog.js';

const rootEnvFile = path.resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis pour le seed.');
const dryRun = process.argv.includes('--dry-run');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  console.log(formatReferenceReport(await seedReference(prisma, { dryRun }), dryRun));
} finally {
  await prisma.$disconnect();
}
