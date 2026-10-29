import { _electron as electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  app = await electron.launch({ args: ['.'], cwd: import.meta.dirname + '/..' });
  window = await app.firstWindow();
  await window.getByRole('button', { name: 'Start coding round' }).click();
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
