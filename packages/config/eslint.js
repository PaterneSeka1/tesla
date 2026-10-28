// Configuration ESLint commune aux paquets TypeScript non-Next (api, shared).
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

/**
 * @param {{ tsconfigRootDir: string, ignores?: string[] }} options
 */
export function createTypeScriptConfig({ tsconfigRootDir, ignores = [] }) {
  return tseslint.config(
    { ignores: ['dist/**', 'coverage/**', ...ignores] },
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    eslintConfigPrettier,
  );
}
