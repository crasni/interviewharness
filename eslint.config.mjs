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
  // The renderer runs in the browser, and shared/ is part of it: values from providers would pull pi-ai and
  // Node in with them (the dev server doesn't tree-shake them away). Its types are fine, and /defaults is plain data.
  {
    files: ['apps/desktop/src/renderer/**', 'apps/desktop/src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@interviewharness/providers',
              allowTypeImports: true,
              message: 'The renderer may take only types from providers; plain values belong in @interviewharness/providers/defaults.',
            },
          ],
          patterns: [{ group: [piAi, `${piAi}/*`], message: 'Layering: core ← engine ← providers ← app. This import points the wrong way.' }],
        },
      ],
    },
  },
);
