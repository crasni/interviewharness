import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp, picker } from './launch.ts';

// The key providers from the table, as the screens show them. Their models answer only on the internet, so
// these tests stop short of a check: providers.test and main's tests check keys against a fake server.

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
const well = () => window.getByRole('dialog', { name: 'Add a connection' });

async function openModelTab() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await settings().getByRole('tab', { name: 'Model' }).click();
}

/** A DeepSeek key as the app would keep it, encrypted by the OS with the app's own safeStorage. A fake key. */
async function seedDeepSeekKey() {
  const key = { type: 'api_key', key: 'sk-deepseek-fake' };
  const data = await app.evaluate(async ({ safeStorage }, text) => (await safeStorage.encryptStringAsync(text)).toString('base64'), JSON.stringify(key));
  writeFileSync(join(dataDir, 'credentials.json'), JSON.stringify({ version: 1, entries: { deepseek: { type: 'api_key', data } } }));
}

test('a key provider is found by name, starts on its named model, and links to where its keys are made', async () => {
  // Stands in for the browser: records what main asks it to open.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
  await openModelTab();
  await settings().getByRole('button', { name: 'Add', exact: true }).click();

  await window.keyboard.type('grok');
  await expect(well().getByRole('option')).toHaveText(['xAI']);
  await well().getByRole('combobox', { name: 'Search' }).fill('deepseek');
  await window.keyboard.press('Enter');

  await expect(well().getByRole('heading', { name: 'DeepSeek' })).toBeVisible();
  await expect(well().getByRole('textbox', { name: 'API key', exact: true })).toHaveAttribute('type', 'password');
  await expect(picker(well(), 'Model')).toHaveText(/flash/i);
  await expect(well().getByRole('button', { name: 'Check and save' })).toBeDisabled();

  await well().getByRole('button', { name: 'Get a key' }).click();
  await expect.poll(() => app.evaluate(() => (globalThis as { opened?: string[] }).opened)).toEqual(['https://platform.deepseek.com/api_keys']);
});

test('a saved key is listed as a connection, and its models can be added from the pickers', async () => {
  await seedDeepSeekKey();
  await openModelTab();

  await expect(settings().getByRole('listitem').filter({ hasText: 'DeepSeek' })).toContainText('Key saved');
  await picker(settings(), 'Interviewer model').click();
  await settings().getByRole('option', { name: 'Add a model…' }).click();
  const adding = settings().getByRole('group', { name: 'Add a model' });
  await expect(adding.getByRole('listbox').getByRole('group', { name: 'DeepSeek' }).getByRole('option')).toHaveText(['DeepSeek V4 Pro', 'DeepSeek V4.1 Flash']);
});
