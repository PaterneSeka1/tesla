import { createTypeScriptConfig } from '@tesla/config/eslint';

export default createTypeScriptConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['src/generated/**', 'prisma/migrations/**'],
});
