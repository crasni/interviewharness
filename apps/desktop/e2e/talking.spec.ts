import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
});

test.afterEach(async () => {
  await app.close();
});

function roundLog() {
  const [round] = readdirSync(join(dataDir, 'rounds'));
  return readFileSync(join(dataDir, 'rounds', round!, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test('holding Space shows the candidate is talking', async () => {
  await window.keyboard.down('Space');
  await expect(window.getByRole('status', { name: 'You' })).toHaveText('Talking');
  await window.keyboard.up('Space');
  await expect(window.getByRole('status', { name: 'You' })).toHaveText('Hold Space to talk');
});

test('a short pause mid-turn gets a backchannel, and it is logged', async () => {
  await window.keyboard.down('Space');
  await window.waitForTimeout(1_500);
  await window.keyboard.up('Space');

  await expect(window.getByTestId('subtitle')).toHaveText('Mm-hm.', { timeout: 3_000 });
  expect(roundLog().find((entry) => entry.decision.kind === 'backchannel')).toMatchObject({
    decision: { line: 'Mm-hm.' },
    state: { talking: false },
  });
});
