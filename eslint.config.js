import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const qualityGateFiles = [
  'config/**/*.ts',
  'scripts/**/*.mjs',
  'server/**/*.js',
  'src/app/api/**/*.ts',
  'src/app/constants/**/*.ts',
  'src/app/**/*.ts',
  'src/app/**/*.tsx',
  'vite.config.ts',
  'vite.config.test.ts',
];

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: qualityGateFiles,
    ...eslint.configs.recommended,
    rules: {
      ...eslint.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-control-regex': 'off',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: qualityGateFiles.filter((file) => file.endsWith('.ts') || file.includes('**/*.ts')),
    rules: {
      ...config.rules,
    },
  })),
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
