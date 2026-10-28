import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v1' },
  },
});
