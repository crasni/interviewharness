// Proves the layering lint rule fires, so a config change can't silently disable it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();

async function errorsFor(filePath, source) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

const forbidden = [
  ['packages/core/src/x.ts', "import '@interviewharness/engine';"],
  ['packages/core/src/x.ts', "import '../../engine/src/round.ts';"],
  ['packages/core/src/x.ts', "import '../../../apps/desktop/src/shared/api.ts';"],
  ['packages/core/src/x.ts', "import 'electron';"],
  ['packages/engine/src/x.ts', "import '@interviewharness/desktop';"],
  ['packages/engine/src/x.ts', "import '../../../apps/desktop/src/shared/api.ts';"],
  ['packages/engine/src/x.ts', "import 'electron';"],
];

for (const [file, source] of forbidden) {
  test(`rejects ${source} in ${file}`, async () => {
    assert.equal((await errorsFor(file, source)).length, 1);
  });
}

const allowed = [
  ['packages/engine/src/x.ts', "import '@interviewharness/core';"],
  ['packages/engine/src/x.ts', "import './round.ts';"],
  ['apps/desktop/src/main/x.ts', "import '@interviewharness/engine';"],
];

for (const [file, source] of allowed) {
  test(`allows ${source} in ${file}`, async () => {
    assert.equal((await errorsFor(file, source)).length, 0);
  });
}
