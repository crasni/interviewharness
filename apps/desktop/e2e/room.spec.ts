import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchIntoRoom());
});

test.afterEach(async () => {
  await closeApp(app);
});

test('the interviewer is present and listening when the round starts', async () => {
  await expect(window.getByRole('status', { name: 'Interviewer' })).toHaveAttribute('data-state', 'listening');
});

test('the room shows no hint counter, score or budget', async () => {
  await expect(window.getByText(/hints?\b|score|budget/i)).toHaveCount(0);
});

test('icon buttons keep their words: as the name screen readers hear, and as the tooltip on hover', async () => {
  for (const name of ['Settings', 'Hide transcript', 'Hide problem', 'Talk']) {
    const button = window.getByRole('button', { name, exact: true });
    await expect(button).toHaveText('');
    await expect(button).toHaveAttribute('data-tip', name);
  }
});
