import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Le fichier .env unique se trouve à la racine du monorepo.
const rootEnvFile = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Vide autorisé pour `prisma generate` (CI) ; requis pour migrate/seed.
    url: process.env.DATABASE_URL ?? '',
  },
});
