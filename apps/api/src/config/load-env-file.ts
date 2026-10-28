import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Charge le `.env` racine du monorepo en développement.
 * Les variables déjà définies (système, CI, production) ne sont pas écrasées.
 */
export function loadRootEnvFile(): void {
  // src/config ou dist/config → racine du monorepo
  const envFile = path.resolve(import.meta.dirname, '../../../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
