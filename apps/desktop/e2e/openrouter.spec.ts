import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const well = () => settings().getByRole('group', { name: 'Add a connection' });
const savedCredentials = () => (existsSync(join(dataDir, 'credentials.json')) ? JSON.parse(readFileSync(join(dataDir, 'credentials.json'), 'utf8')).entries : {});

async function openModelTab() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await settings().getByRole('tab', { name: 'Model' }).click();
}

/** Stands in for the candidate's browser: records the pages the app asks it to open, and opens nothing. */
async function recordBrowser() {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
  return () => app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);
}

test("signing in opens only OpenRouter's own page, waits for the browser, and cancelling saves nothing", async () => {
  const opened = await recordBrowser();
  await openModelTab();
  await settings().getByRole('button', { name: 'Add', exact: true }).click();
  await well().getByRole('group', { name: 'Sign in' }).getByRole('option', { name: 'OpenRouter' }).click();

  await expect(well().getByRole('textbox', { name: 'API key' })).toHaveCount(0);
  await well().getByRole('button', { name: 'Sign in with OpenRouter' }).click();

  await expect(well().getByRole('status')).toHaveText('Finish signing in in your browser…');
  await expect.poll(opened).toHaveLength(1);
  const page = new URL((await opened())[0]!);
  expect(`${page.origin}${page.pathname}`).toBe('https://openrouter.ai/auth');
  expect(page.searchParams.get('callback_url')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback\//);

  await well().getByRole('button', { name: 'Cancel' }).last().click();

  await expect(well().getByRole('button', { name: 'Sign in with OpenRouter' })).toBeEnabled();
  expect(savedCredentials()).toEqual({});
  // Nothing listens for the browser any more.
  await expect(fetch(page.searchParams.get('callback_url')!)).rejects.toThrow();
});

test('signed in to OpenRouter, the row says so and offers Sign out, which forgets the key', async () => {
  // The key OpenRouter issues, as the app keeps it, encrypted by the OS. A fake key.
  const login = { type: 'oauth', access: 'sk-or-never-shown', refresh: '', expires: Number.MAX_SAFE_INTEGER };
  const data = await app.evaluate(async ({ safeStorage }, text) => (await safeStorage.encryptStringAsync(text)).toString('base64'), JSON.stringify(login));
  writeFileSync(join(dataDir, 'credentials.json'), JSON.stringify({ version: 1, entries: { openrouter: { type: 'oauth', data } } }));
  await openModelTab();

  const row = settings().getByRole('listitem').filter({ hasText: 'OpenRouter' });
  await expect(row).toContainText('Signed in');
  await expect(row.getByRole('button', { name: 'Replace' })).toHaveCount(0);
  await expect(settings()).not.toContainText('sk-or-never-shown');

  await row.getByRole('button', { name: 'Sign out' }).click();

  await expect(row).toHaveCount(0);
  expect(savedCredentials()).toEqual({});
});
