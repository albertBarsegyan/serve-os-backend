// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // TypeScript best-practices
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',

      // General JS/TS best-practices
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'eqeqeq': ['error', 'always'],
      'consistent-return': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Let Prettier handle all formatting concerns; keep a single source of formatting truth.
      // The `eslint-plugin-prettier/recommended` config (included above) already adds the
      // `prettier/prettier` rule; ensure it's enforced and configure EOL handling.
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
