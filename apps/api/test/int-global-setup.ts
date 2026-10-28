import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './int-database.js';

/** Applique les migrations versionnées sur la base de test (jamais `migrate reset` ni `db push`). */
export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
