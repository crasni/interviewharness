import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchApp());
});

test.afterEach(async () => {
  await closeApp(app);
});

const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
const body = () => window.locator('body');

async function relaunch() {
  await closeApp(app);
  ({ app, window } = await launchApp(dataDir));
}

test('settings are kept in settings.json in the data folder, and survive a restart', async () => {
  expect(settingsFile()).toMatchObject({ version: 1, textSize: 'medium' });

  await window.getByRole('button', { name: 'Settings' }).click();
  await window.getByRole('dialog', { name: 'Settings' }).getByText('Large', { exact: true }).click();
  await expect(body()).toHaveCSS('font-size', '16.1px');
  await relaunch();

  await expect(body()).toHaveCSS('font-size', '16.1px');
  expect(settingsFile()).toMatchObject({ textSize: 'large' });
});

test("v0.0's settings in browser storage are carried into settings.json once, then cleared", async () => {
  // As v0.0 left things: settings only in browser storage, no settings.json.
  await window.evaluate(() => localStorage.setItem('settings', JSON.stringify({ textSize: 'large', theme: 'neon' })));
  await closeApp(app);
  rmSync(join(dataDir, 'settings.json'));
  ({ app, window } = await launchApp(dataDir));

  await expect(body()).toHaveCSS('font-size', '16.1px');
  expect(await window.evaluate(() => localStorage.getItem('settings'))).toBeNull();
  await expect.poll(settingsFile).toMatchObject({ textSize: 'large', theme: 'system' }); // the invalid theme is dropped
});
