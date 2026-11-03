import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  // A brand-new data folder, as on a first launch.
  ({ app, window, dataDir } = await launchApp({ modelPicked: false }));
});

test.afterEach(async () => {
  await closeApp(app);
});

/** Chromium's browser storage as v0.0 left it: its settings, under the key v0.0 used. */
const v00Storage = join(import.meta.dirname, 'fixtures', 'v0.0-browser-storage');

const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
const body = () => window.locator('body');

test('settings are kept in settings.json in the data folder, and survive a restart', async () => {
  // Written just after launch, not before the window shows.
  await expect.poll(settingsFile).toMatchObject({ version: 2, textSize: 'medium' });

  await window.getByRole('button', { name: 'Settings' }).click();
  await window.getByRole('dialog', { name: 'Settings' }).getByText('Large', { exact: true }).click();
  await expect(body()).toHaveCSS('font-size', '16.1px');
  // Quitting straight away, as ⌘Q does, waits for the change to reach the disk, then quits on its own.
  const quit = await Promise.race([app.close().then(() => true), new Promise<false>((resolve) => setTimeout(() => resolve(false), 3_000))]);
  expect(quit).toBe(true);
  expect(settingsFile()).toMatchObject({ textSize: 'large' });
  ({ app, window } = await launchApp({ dataDir }));

  await expect(body()).toHaveCSS('font-size', '16.1px');
});

test("v0.0's settings in browser storage are carried into settings.json once, then cleared", async () => {
  // As v0.0 left things: settings only in browser storage, no settings.json. The storage is copied in from files a
  // v0.0-style app wrote ({ textSize: 'large', theme: 'neon' }), rather than written by this run: Chromium writes it
  // to disk lazily, and on Windows a write cut short at quit can leave files that look right but don't load.
  await closeApp(app);
  ({ app, window, dataDir } = await launchApp({ modelPicked: false, seed: (dir) => cpSync(v00Storage, join(dir, 'Local Storage'), { recursive: true }) }));

  await expect(body()).toHaveCSS('font-size', '16.1px');
  expect(await window.evaluate(() => localStorage.getItem('settings'))).toBeNull();
  await expect.poll(settingsFile).toMatchObject({ textSize: 'large', theme: 'system' }); // the invalid theme is dropped
});
