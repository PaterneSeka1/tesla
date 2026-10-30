/**
 * Mise en service du catalogue : `npm run pedagogy:release -w @tesla/api [-- --dry-run] [-- --acteur <e-mail>]`.
 * Décision prise au nom du responsable plein en exercice (ou du compte indiqué, s'il est habilité).
 * Voir `release-catalog.ts`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { formatReleaseReport, releaseActor, releaseCatalog } from './release-catalog.js';

const rootEnvFile = path.resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est requis.');
const dryRun = process.argv.includes('--dry-run');
const actorIndex = process.argv.indexOf('--acteur');
const email = actorIndex >= 0 ? process.argv[actorIndex + 1] : undefined;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const actor = await releaseActor(prisma, email);
  console.log(formatReleaseReport(await releaseCatalog(prisma, actor, { dryRun }), dryRun));
} finally {
  await prisma.$disconnect();
}
