import { expect, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

test('candidate starts a coding round and sees the room', async () => {
  const { app, window } = await launchApp();

  await expect(window.getByRole('button', { name: 'System design round' })).toBeDisabled();
  await expect(window.getByRole('button', { name: 'AI-assisted round' })).toBeDisabled();

  await window.getByRole('button', { name: 'Start coding round' }).click();

  const topBar = window.getByRole('banner', { name: 'Round status' });
  await expect(topBar).toContainText('Coding round');
  await expect(window.getByTestId('phase')).toHaveText('Clarify');
  // The timer runs on the real clock here, so only check that it has started counting.
  await expect(window.getByTestId('timer')).toHaveText(/^00:0[1-9]$/, { timeout: 5_000 });

  await closeApp(app);
});
