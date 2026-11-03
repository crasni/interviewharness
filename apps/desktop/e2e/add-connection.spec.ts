import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeKeyServer } from '@interviewharness/providers/test';
import { type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { closeApp, launchApp, picker } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.afterEach(async () => {
  await closeApp(app);
});

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const step = () => window.getByRole('region', { name: 'Pick a model' });
const well = () => window.getByRole('dialog', { name: 'Add a connection' });
const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
const groupNames = (scope: Locator) => scope.getByRole('listbox').getByRole('group').evaluateAll((groups) => groups.map((g) => g.getAttribute('aria-label')));

async function openAdd() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await settings().getByRole('tab', { name: 'Model' }).click();
  await settings().getByRole('button', { name: 'Add', exact: true }).click();
}

test('Add lists every kind of connection in groups, and typing filters across all of them', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openAdd();

  expect(await groupNames(well())).toEqual(['Plans you pay for', 'Sign in', 'API keys', 'On this computer or your network']);
  await expect(well().getByRole('option', { name: 'ChatGPT' })).toBeVisible();

  // The search field has the keyboard as soon as the list opens.
  await window.keyboard.type('open');
  await expect(well().getByRole('option')).toHaveText(['ChatGPT', 'OpenRouter', 'OpenAI', 'OpenRouter', 'Custom server']);
  await well().getByRole('combobox', { name: 'Search' }).fill('lm studio');
  await expect(well().getByRole('option')).toHaveText(['Custom server']);
});

test('plans the app can not use are not there, not even in search', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openAdd();

  for (const plan of ['Copilot', 'Gemini AI Pro', 'Claude Pro', 'Z.ai', 'Qwen']) {
    await well().getByRole('combobox', { name: 'Search' }).fill(plan);
    await expect(well().getByRole('option')).toHaveCount(0);
    await expect(well()).toContainText('Nothing matches.');
  }
});

test('picking an item from the keyboard shows only its fields, and Cancel goes back to the list', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openAdd();

  // OpenRouter is there twice: to sign in to, first, and with an API key, next.
  await window.keyboard.type('router');
  await window.keyboard.press('ArrowDown');
  await window.keyboard.press('Enter');

  await expect(well().getByRole('heading', { name: 'OpenRouter' })).toBeVisible();
  await expect(well().getByRole('textbox', { name: 'API key', exact: true })).toHaveAttribute('type', 'password');
  await expect(picker(well(), 'Model')).toHaveText('OpenAI: GPT-6.1 Sol');
  await expect(well().getByLabel('Address', { exact: true })).toHaveCount(0);
  await expect(well().getByRole('button', { name: 'Continue with ChatGPT' })).toHaveCount(0);
  await expect(well().getByRole('button', { name: 'Check and save' })).toBeDisabled();

  await well().getByRole('button', { name: 'Back' }).click();
  await expect(well().getByRole('group', { name: 'API keys' }).getByRole('option', { name: 'OpenRouter' })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(well()).toHaveCount(0);
  await expect(settings()).toBeVisible(); // back to Settings, still open behind it
});

test('a server picked from the list is checked before it is saved, then listed as a connection', async () => {
  const server = await fakeKeyServer(['qwen2.5-7b-instruct']);
  try {
    ({ app, window, dataDir } = await launchApp());
    await openAdd();
    await well().getByRole('option', { name: 'Custom server' }).click();

    await well().getByLabel('Name', { exact: true }).fill('Home');
    await expect(well().getByRole('button', { name: 'Find models' })).toBeDisabled();
    await well().getByLabel('Address', { exact: true }).fill(`${server.origin}/v1`);
    await well().getByLabel('Address', { exact: true }).press('Tab');
    await expect(picker(well(), 'Model')).toHaveText('qwen2.5-7b-instruct');
    server.reply({ text: 'OK' });
    await well().getByRole('button', { name: 'Check and save' }).click();

    await expect(well()).toHaveCount(0);
    await expect(settings().getByRole('listitem').filter({ hasText: 'Home' })).toContainText(`${server.origin}/v1 · 1 model`);
    await expect.poll(settingsFile).toMatchObject({ servers: [{ name: 'Home', address: `${server.origin}/v1`, format: 'openai' }] });
  } finally {
    await server.close();
  }
});

test('in a short window the list scrolls inside its own region, and the settings stay the window height', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openAdd();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 420));

  const list = well().getByRole('listbox');
  await expect.poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await list.evaluate((el) => el.ownerDocument.defaultView!.getComputedStyle(el).overflowY)).toBe('auto');
  expect(await window.locator('html').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
});

test("the Start screen's API key row opens the same list, with only keys and servers", async () => {
  const server = await fakeKeyServer(['qwen2.5-7b-instruct']);
  try {
    ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

    await step().getByRole('radio', { name: /API key/ }).check();
    expect(await groupNames(step())).toEqual(['API keys', 'On this computer or your network']);
    await expect(step().getByRole('option', { name: 'ChatGPT' })).toHaveCount(0);
    await expect(step().getByRole('option', { name: 'Ollama' })).toHaveCount(0);

    await step().getByRole('combobox', { name: 'Search' }).fill('vllm');
    await window.keyboard.press('Enter');
    await step().getByLabel('Address', { exact: true }).fill(`${server.origin}/v1`);
    await step().getByLabel('Address', { exact: true }).press('Tab');
    await expect(picker(step(), 'Model')).toHaveText('qwen2.5-7b-instruct');

    server.reply({ status: 401, body: JSON.stringify({ error: { message: 'Unauthorized' } }) });
    await step().getByRole('button', { name: 'Check and save' }).click();
    await expect(step().getByRole('alert')).toContainText('asks for a key');
    expect(settingsFile().interviewerModel ?? null).toBeNull();

    server.reply({ text: 'OK' });
    await step().getByRole('button', { name: 'Check and save' }).click();

    await expect(step()).toHaveCount(0);
    // Named after its host, as no name was typed.
    const host = new URL(server.origin).host;
    await expect.poll(settingsFile).toMatchObject({ servers: [{ name: host, address: `${server.origin}/v1` }], interviewerModel: { provider: 'server', model: 'qwen2.5-7b-instruct' } });
  } finally {
    await server.close();
  }
});
