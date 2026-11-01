import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeOllama } from '@interviewharness/providers/test';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { choose, closeApp, launchApp, picker } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;
let ollama: Awaited<ReturnType<typeof fakeOllama>>;

test.beforeEach(async () => {
  ollama = await fakeOllama([
    { name: 'qwen3:0.6b', parameterSize: '751.63M' },
    { name: 'qwen2.5:32b', parameterSize: '32.8B' },
  ]);
  ({ app, window, dataDir } = await launchApp({ ollamaAddress: ollama.origin }));
});

test.afterEach(async () => {
  await closeApp(app);
  await ollama.close();
});

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));

async function openModelTab() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await settings().getByRole('tab', { name: 'Model' }).click();
}

/** A ChatGPT login as the app would keep it, encrypted by the OS with the app's own safeStorage. Fake tokens. */
async function seedLogin() {
  const login = { type: 'oauth', access: 'fake-access', refresh: 'fake-refresh', expires: Date.now() + 3_600_000, clientId: 'oaiapp_test' };
  const data = await app.evaluate(async ({ safeStorage }, text) => (await safeStorage.encryptStringAsync(text)).toString('base64'), JSON.stringify(login));
  writeFileSync(join(dataDir, 'credentials.json'), JSON.stringify({ version: 1, entries: { openai: { type: 'oauth', data } } }));
}

test('shows the connections and the interviewer model, and offers to sign in when logged out', async () => {
  await openModelTab();

  await expect(settings().getByRole('listitem').filter({ hasText: 'Ollama' })).toContainText('Running · 2 models');
  await settings().getByRole('button', { name: 'Add', exact: true }).click();
  await settings().getByRole('option', { name: 'ChatGPT' }).click();
  await expect(settings().getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(picker(settings(), 'Interviewer model')).toHaveText('gpt-5-mini');
  await expect(picker(settings(), 'Feedback model')).toHaveText('Same as interviewer');
});

test('changes the interviewer and Feedback models, each checked to answer, and marks a model small', async () => {
  await openModelTab();
  ollama.reply({ text: 'OK' }, { text: 'OK' });

  await choose(settings(), 'Interviewer model', 'qwen3:0.6b');
  await expect.poll(settingsFile).toMatchObject({ interviewerModel: { provider: 'ollama', model: 'qwen3:0.6b' } });
  await choose(settings(), 'Feedback model', 'qwen2.5:32b');
  await expect(picker(settings(), 'Feedback model')).toHaveText('qwen2.5:32b · Ollama');
  await expect.poll(settingsFile).toMatchObject({ feedbackModel: { provider: 'ollama', model: 'qwen2.5:32b' } });
  expect(ollama.chats()).toHaveLength(2);
  await settings().getByRole('switch', { name: 'Treat the Feedback model as small' }).check();

  await expect.poll(settingsFile).toMatchObject({ smallModels: ['ollama/qwen2.5:32b'] });

  await choose(settings(), 'Feedback model', 'Same as interviewer');
  await expect.poll(settingsFile).toMatchObject({ feedbackModel: null });
  // "Same as interviewer": the switch now speaks about the interviewer's model, which isn't marked.
  await expect(settings().getByRole('switch', { name: 'Treat the Feedback model as small' })).not.toBeChecked();
});

test('logging out forgets the login, and Start asks for a model again', async () => {
  await seedLogin();
  await openModelTab();

  await expect(settings().getByRole('listitem').filter({ hasText: 'ChatGPT' })).toContainText('Signed in');
  await settings().getByRole('button', { name: 'Sign out' }).click();

  await expect(settings().getByRole('listitem').filter({ hasText: 'ChatGPT' })).toHaveCount(0);
  expect(JSON.parse(readFileSync(join(dataDir, 'credentials.json'), 'utf8')).entries).toEqual({});
  await expect.poll(settingsFile).toMatchObject({ interviewerModel: null });
  await window.keyboard.press('Escape');
  await expect(window.getByRole('region', { name: 'Pick a model' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toHaveCount(0);
});

test("a model that doesn't answer isn't picked, and the reason is shown", async () => {
  await openModelTab();
  ollama.reply({ status: 500, error: 'model requires more system memory (20.0 GiB) than is available (8.0 GiB)' });

  await choose(settings(), 'Interviewer model', 'qwen2.5:32b');

  await expect(settings().getByRole('alert')).toContainText('more system memory');
  await expect(picker(settings(), 'Interviewer model')).toHaveText('gpt-5-mini');
  expect(settingsFile()).toMatchObject({ interviewerModel: { provider: 'chatgpt', model: 'gpt-5-mini' } });
});

test('a saved key shows as a status, never the key, and Remove forgets it', async () => {
  const key = { type: 'api_key', key: 'sk-ant-never-shown' };
  const data = await app.evaluate(async ({ safeStorage }, text) => (await safeStorage.encryptStringAsync(text)).toString('base64'), JSON.stringify(key));
  writeFileSync(join(dataDir, 'credentials.json'), JSON.stringify({ version: 1, entries: { anthropic: { type: 'api_key', data } } }));
  await openModelTab();

  const row = settings().getByRole('listitem').filter({ hasText: 'Anthropic' });
  await expect(row).toContainText('Key saved');
  await expect(settings()).not.toContainText('sk-ant-never-shown');

  await row.getByRole('button', { name: 'Remove' }).click();

  await expect(row).toHaveCount(0);
  expect(JSON.parse(readFileSync(join(dataDir, 'credentials.json'), 'utf8')).entries).toEqual({});
});

test('the model picker searches a long list, works from the keyboard, and Escape closes only the list', async () => {
  await seedLogin();
  await openModelTab();
  ollama.reply({ text: 'OK' });

  await picker(settings(), 'Interviewer model').click();
  await settings().getByRole('combobox', { name: 'Search' }).fill('qwen3');
  await expect(settings().getByRole('option')).toHaveCount(1);
  await window.keyboard.press('Escape');
  await expect(settings().getByRole('option')).toHaveCount(0);
  await expect(settings()).toBeVisible();

  await picker(settings(), 'Interviewer model').click();
  await settings().getByRole('combobox', { name: 'Search' }).fill('qwen3');
  await window.keyboard.press('Enter');

  await expect.poll(settingsFile).toMatchObject({ interviewerModel: { provider: 'ollama', model: 'qwen3:0.6b' } });
  await expect(picker(settings(), 'Interviewer model')).toHaveText('qwen3:0.6b · Ollama');
});

test('Refresh shows it is looking, then what it found', async () => {
  await openModelTab();
  const row = settings().getByRole('listitem').filter({ hasText: 'Ollama' });
  await expect(row).toContainText('Running · 2 models');
  await ollama.close();

  await row.getByRole('button', { name: 'Refresh' }).click();

  await expect(row).toContainText('Looking…');
  await expect(row.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true');
  await expect(row).toContainText('Not running');
  await expect(row.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'false');
  ollama = await fakeOllama([]); // for afterEach
});

test('signed in to ChatGPT, adding it again offers its models instead of signing in again', async () => {
  await seedLogin();
  await openModelTab();
  await settings().getByRole('button', { name: 'Add', exact: true }).click();

  await settings().getByRole('option', { name: 'ChatGPT' }).click();

  await expect(settings().getByRole('group', { name: 'Add a connection' })).toContainText('Signed in');
  await expect(settings().getByRole('button', { name: 'Continue with ChatGPT' })).toHaveCount(0);
  await expect(picker(settings(), 'Model')).toHaveText('GPT-6.1 Sol');
  await expect(settings().getByRole('button', { name: 'Use this model' })).toBeEnabled();
});
