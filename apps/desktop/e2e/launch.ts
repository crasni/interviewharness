import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

/** Launches the built app in a hidden window, with its own throwaway data folder. */
export async function launchApp() {
  const dataDir = mkdtempSync(join(tmpdir(), 'interviewharness-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, INTERVIEWHARNESS_DATA_DIR: dataDir, INTERVIEWHARNESS_HIDDEN_WINDOW: '1' },
  });
  const window = await app.firstWindow();
  return { app, window, dataDir };
}

/** Launches the app and starts a coding round. */
export async function launchIntoRoom() {
  const launched = await launchApp();
  await launched.window.getByRole('button', { name: 'Start coding round' }).click();
  await expect(launched.window.getByRole('status', { name: 'You' })).toBeVisible();
  return launched;
}
