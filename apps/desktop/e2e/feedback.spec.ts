import { type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom, readRoundLog } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
  await window.getByRole('button', { name: 'End round' }).click();
});

test.afterEach(async () => {
  await closeApp(app);
});

const feedbackScreen = () => window.getByRole('main', { name: 'Feedback' });

test('ending the round leads to the Feedback screen, clearly marked as sample feedback', async () => {
  await expect(feedbackScreen().getByRole('heading', { name: 'Feedback' })).toBeVisible();
  await expect(feedbackScreen()).toContainText('Sample feedback');
});

test('the Feedback screen gives a verdict on the six-level scale, with reasons', async () => {
  const scale = feedbackScreen().getByRole('list', { name: 'Verdict' });
  await expect(scale.getByRole('listitem')).toHaveText([
    'Strong hire',
    'Hire',
    'Lean hire',
    'Lean no hire',
    'No hire',
    'Strong no hire',
  ]);
  await expect(scale.locator('[aria-current="true"]')).toHaveText('Lean hire');
  await expect(feedbackScreen().getByRole('region', { name: 'Why' })).not.toBeEmpty();
});

test('each point of feedback is tied to a moment in the round', async () => {
  for (const section of ['What went well', 'What to fix']) {
    const points = feedbackScreen().getByRole('region', { name: section }).getByRole('listitem');
    await expect(points.first()).toBeVisible();
    for (const point of await points.all()) await expect(point).toContainText(/\d\d:\d\d/);
  }
});

test('the Feedback screen shows no metrics, and leads back to the start screen', async () => {
  await expect(feedbackScreen().getByText(/score|%|chart/i)).toHaveCount(0);

  await window.getByRole('button', { name: 'Back to start' }).click();

  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeVisible();
});

test("the round's log ends with the round ending, so a replay can tell it from a crash", async () => {
  await expect(feedbackScreen()).toBeVisible();
  expect(readRoundLog(dataDir).at(-1)).toMatchObject({ signal: { type: 'round-end' } });
});

test('in a short window the Feedback screen still fits: only the feedback scrolls, the verdict and the way out stay', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1000, 480));
  const written = feedbackScreen().getByLabel('Written feedback');
  await expect.poll(() => written.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await feedbackScreen().evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // Measured by hand: toBeInViewport waits on frames, which a hidden window doesn't draw.
  const onScreen = (locator: Locator) =>
    locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= el.ownerDocument.documentElement.clientHeight;
    });
  await written.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await onScreen(feedbackScreen().getByRole('heading', { name: 'Feedback' }))).toBe(true);
  expect(await onScreen(feedbackScreen().getByRole('list', { name: 'Verdict' }))).toBe(true);
  expect(await onScreen(window.getByRole('button', { name: 'Back to start' }))).toBe(true);
});
