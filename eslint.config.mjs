import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Layering: core ← engine ← providers ← app. A layer may only import from layers to its left,
// whether by package name or by a relative path into another package's folder.
// pi-ai lives only in providers, behind the engine's model interface (ADR 0016).
const forbid = (...specifiers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: specifiers.flatMap((s) => [s, `${s}/*`]),
          message: 'Layering: core ← engine ← providers ← app. This import points the wrong way.',
        },
      ],
    },
  ],
});
const enginePaths = ['**/engine/src', '**/engine/src/**'];
const providerPaths = ['**/providers/src', '**/providers/src/**'];
const piAi = '@earendil-works/pi-ai';
const appPaths = ['**/apps/desktop', '**/apps/desktop/**', '**/desktop/src/**'];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/out/**', '**/dist/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**'],
    rules: forbid('@interviewharness/engine', '@interviewharness/providers', '@interviewharness/desktop', 'electron', 'react', 'node:*', piAi, ...enginePaths, ...providerPaths, ...appPaths),
  },
  {
    files: ['packages/engine/**'],
    rules: forbid('@interviewharness/providers', '@interviewharness/desktop', 'electron', 'react', piAi, ...providerPaths, ...appPaths),
  },
  {
    files: ['packages/providers/**'],
    rules: forbid('@interviewharness/desktop', 'electron', 'react', ...appPaths),
  },
  {
    files: ['apps/**'],
    rules: forbid(piAi),
  },
);
