import { defineConfig } from 'vitest/config';

/**
 * Tests d'intégration sur une vraie base PostgreSQL (contraintes, triggers, concurrence).
 * Requiert TEST_DATABASE_URL vers une base dédiée dont le nom se termine par « _test » :
 * elle est migrée puis vidée entre les tests. Lancement : `npm run test:int -w @tesla/api`.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.int-spec.ts'],
    globalSetup: ['test/int-global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
