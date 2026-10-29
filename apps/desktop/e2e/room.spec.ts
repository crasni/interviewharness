import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchIntoRoom());
});

test.afterEach(async () => {
  await app.close();
});

test('the interviewer is present and listening when the round starts', async () => {
  await expect(window.getByRole('status', { name: 'Interviewer' })).toHaveAttribute('data-state', 'listening');
});

test('the room shows no hint counter, score or budget', async () => {
  await expect(window.getByText(/hints?\b|score|budget/i)).toHaveCount(0);
});
