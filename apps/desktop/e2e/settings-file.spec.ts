import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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

/** Whether `text` is in Chromium's browser-storage files in the data folder (stored as Latin-1 or UTF-16). */
function storedOnDisk(text: string) {
  const dir = join(dataDir, 'Local Storage', 'leveldb');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => {
    let data: Buffer;
    try {
      data = readFileSync(join(dir, name));
    } catch {
      return false; // a file still held by an app that is only just closing
    }
    return data.includes(Buffer.from(text, 'latin1')) || data.includes(Buffer.from(text, 'utf16le'));
  });
}

const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
const body = () => window.locator('body');

async function relaunch() {
  await closeApp(app);
  ({ app, window } = await launchApp({ dataDir }));
}

test('settings are kept in settings.json in the data folder, and survive a restart', async () => {
  // Written just after launch, not before the window shows.
  await expect.poll(settingsFile).toMatchObject({ version: 2, textSize: 'medium' });

  await window.getByRole('button', { name: 'Settings' }).click();
  await window.getByRole('dialog', { name: 'Settings' }).getByText('Large', { exact: true }).click();
  await expect(body()).toHaveCSS('font-size', '16.1px');
  await relaunch();

  await expect(body()).toHaveCSS('font-size', '16.1px');
  await expect.poll(settingsFile).toMatchObject({ textSize: 'large' });
});

test("v0.0's settings in browser storage are carried into settings.json once, then cleared", async () => {
  // As v0.0 left things: settings only in browser storage, no settings.json.
  // Chromium writes browser storage to disk lazily and, on Windows, keeps the files locked while the app runs, so
  // they're read once it has closed; a write that didn't reach the disk in time is made again.
  for (let attempt = 1; ; attempt++) {
    await window.evaluate(() => localStorage.setItem('settings', JSON.stringify({ textSize: 'large', theme: 'neon' })));
    await app.evaluate(({ session }) => session.defaultSession.flushStorageData());
    await closeApp(app);
    if (storedOnDisk('neon') || attempt === 3) break;
    ({ app, window } = await launchApp({ dataDir }));
  }
  expect(storedOnDisk('neon')).toBe(true);
  rmSync(join(dataDir, 'settings.json'));
  ({ app, window } = await launchApp({ dataDir }));

  await expect(body()).toHaveCSS('font-size', '16.1px');
  expect(await window.evaluate(() => localStorage.getItem('settings'))).toBeNull();
  await expect.poll(settingsFile).toMatchObject({ textSize: 'large', theme: 'system' }); // the invalid theme is dropped
});
