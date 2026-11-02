import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { choose, closeApp, launchIntoRoom, picker, readRoundLog } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
});

test.afterEach(async () => {
  await closeApp(app);
});

const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));

test("changes the interviewer's reasoning mid-round, saved on the model and logged", async () => {
  await expect(picker(window, 'Reasoning')).toHaveText('low');

  await choose(window, 'Reasoning', 'medium');

  await expect(picker(window, 'Reasoning')).toHaveText('medium');
  await expect.poll(settingsFile).toMatchObject({ yourModels: [{ provider: 'chatgpt', model: 'gpt-5-mini', effort: 'medium' }] });
  await expect.poll(() => readRoundLog(dataDir).filter((entry) => 'effortChanged' in entry)).toEqual([
    { at: expect.any(Number), effortChanged: { model: { provider: 'chatgpt', model: 'gpt-5-mini' }, from: 'low', to: 'medium' } },
  ]);
});
