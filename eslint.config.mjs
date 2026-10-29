import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Layering: core ← engine ← app. A layer may only import from layers to its left,
// whether by package name or by a relative path into another package's folder.
const forbid = (...specifiers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: specifiers.flatMap((s) => [s, `${s}/*`]),
          message: 'Layering: core ← engine ← app. This import points the wrong way.',
        },
      ],
    },
  ],
});
const enginePaths = ['**/engine/src', '**/engine/src/**'];
const appPaths = ['**/apps/desktop', '**/apps/desktop/**', '**/desktop/src/**'];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/out/**', '**/dist/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**'],
    rules: forbid('@interviewharness/engine', '@interviewharness/desktop', 'electron', 'react', 'node:*', ...enginePaths, ...appPaths),
  },
  {
    files: ['packages/engine/**'],
    rules: forbid('@interviewharness/desktop', 'electron', 'react', ...appPaths),
  },
);
