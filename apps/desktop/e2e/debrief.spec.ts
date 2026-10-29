import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom, readRoundLog } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
  await window.getByRole('button', { name: 'End round' }).click();
});

test.afterEach(async () => {
  await app.close();
});

const debrief = () => window.getByRole('main', { name: 'Debrief' });

test('ending the round leads to the debrief, clearly marked as sample feedback', async () => {
  await expect(debrief().getByRole('heading', { name: 'Debrief' })).toBeVisible();
  await expect(debrief()).toContainText('Sample feedback');
});

test('the debrief gives a verdict on the six-level scale, with reasons', async () => {
  const scale = debrief().getByRole('list', { name: 'Verdict' });
  await expect(scale.getByRole('listitem')).toHaveText([
    'Strong hire',
    'Hire',
    'Lean hire',
    'Lean no hire',
    'No hire',
    'Strong no hire',
  ]);
  await expect(scale.locator('[aria-current="true"]')).toHaveText('Lean hire');
  await expect(debrief().getByRole('region', { name: 'Why' })).not.toBeEmpty();
});

test('each point of feedback is tied to a moment in the round', async () => {
  for (const section of ['What went well', 'What to fix']) {
    const points = debrief().getByRole('region', { name: section }).getByRole('listitem');
    await expect(points.first()).toBeVisible();
    for (const point of await points.all()) await expect(point).toContainText(/\d\d:\d\d/);
  }
});

test('the debrief shows no metrics, and leads back to the start screen', async () => {
  await expect(debrief().getByText(/score|%|chart/i)).toHaveCount(0);

  await window.getByRole('button', { name: 'Back to start' }).click();

  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeVisible();
});

test("the round's log ends with the round ending, so a replay can tell it from a crash", async () => {
  await expect(debrief()).toBeVisible();
  expect(readRoundLog(dataDir).at(-1)).toMatchObject({ signal: { type: 'round-end' } });
});
