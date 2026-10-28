import { readFileSync } from 'node:fs';
import path from 'node:path';

// src/config ou dist/config → apps/api/package.json
const packageJsonPath = path.resolve(import.meta.dirname, '../../package.json');

export const APP_VERSION = (
  JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
).version;
