import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeOllama } from '@interviewharness/providers/test';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp, picker } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;
let ollama: Awaited<ReturnType<typeof fakeOllama>>;

test.beforeEach(async () => {
  ollama = await fakeOllama([
    { name: 'qwen3:0.6b', parameterSize: '751.63M' },
    { name: 'qwen2.5:32b', parameterSize: '32.8B' },
  ]);
  // A v0.1 settings file (the default seed): its interviewer model, chatgpt/gpt-5-mini, becomes the first of your models.
  ({ app, window, dataDir } = await launchApp({ ollamaAddress: ollama.origin }));
});

test.afterEach(async () => {
  await closeApp(app);
  await ollama.close();
});

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const adding = () => settings().getByRole('group', { name: 'Add a model' });
const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
const options = () => settings().getByRole('option');

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

/** Opens "Add a model…" from the picker named `field`. */
async function addFrom(field: string) {
  await picker(settings(), field).click();
  await settings().getByRole('option', { name: 'Add a model…' }).click();
}

test('the pickers list only your models, with their connection, and end with Add a model…', async () => {
  await openModelTab();
  await expect(settings().getByRole('listitem').filter({ hasText: 'Ollama' })).toContainText('Running · 2 models');

  await expect(picker(settings(), 'Interviewer model')).toHaveText('gpt-5-mini · ChatGPT');
  await picker(settings(), 'Interviewer model').click();
  await expect(options()).toHaveText(['gpt-5-mini', 'Add a model…']);
  await window.keyboard.press('Escape');

  await picker(settings(), 'Feedback model').click();
  await expect(options()).toHaveText(['Same as interviewer', 'gpt-5-mini', 'Add a model…']);
});

test('Add a model… searches every connection, and a model that answers is added and picked', async () => {
  await seedLogin();
  await openModelTab();
  ollama.reply({ text: 'OK' });

  await addFrom('Feedback model');
  await settings().getByRole('combobox', { name: 'Search' }).fill('qwen2.5');
  await expect(options()).toHaveText(['qwen2.5:32b']);
  await window.keyboard.press('Enter');

  await expect(adding()).toHaveCount(0);
  await expect(picker(settings(), 'Feedback model')).toHaveText('qwen2.5:32b · Ollama');
  await expect(picker(settings(), 'Interviewer model')).toHaveText('GPT-5 Mini · ChatGPT');
  await expect.poll(settingsFile).toMatchObject({
    yourModels: [{ provider: 'chatgpt', model: 'gpt-5-mini' }, { provider: 'ollama', model: 'qwen2.5:32b' }],
    feedbackModel: { provider: 'ollama', model: 'qwen2.5:32b' },
  });
  expect(ollama.chats()).toHaveLength(1);

  // Picking one of your models needs no check: it answered when it was added.
  await picker(settings(), 'Interviewer model').click();
  await settings().getByRole('option', { name: 'qwen2.5:32b' }).click();
  await expect.poll(settingsFile).toMatchObject({ interviewerModel: { provider: 'ollama', model: 'qwen2.5:32b' } });
  expect(ollama.chats()).toHaveLength(1);
});

test("a model that doesn't answer isn't added, and the reason is shown", async () => {
  await openModelTab();
  ollama.reply({ status: 500, error: 'model requires more system memory (20.0 GiB) than is available (8.0 GiB)' });

  await addFrom('Interviewer model');
  await settings().getByRole('option', { name: 'qwen2.5:32b' }).click();

  await expect(adding().getByRole('alert')).toContainText('more system memory');
  await expect(picker(settings(), 'Interviewer model')).toHaveText('gpt-5-mini · ChatGPT');
  expect(settingsFile()).toMatchObject({ yourModels: [{ provider: 'chatgpt', model: 'gpt-5-mini' }] });

  await adding().getByRole('button', { name: 'Cancel' }).click();
  await expect(adding()).toHaveCount(0);
});

test('removing the model in use unpicks it, and Start asks for a model again', async () => {
  await openModelTab();

  await picker(settings(), 'Interviewer model').click();
  await settings().getByRole('button', { name: 'Remove gpt-5-mini' }).click();

  await expect(options()).toHaveText(['Add a model…']);
  await window.keyboard.press('Escape');
  await expect(picker(settings(), 'Interviewer model')).toHaveText('None');
  await expect.poll(settingsFile).toMatchObject({ yourModels: [], interviewerModel: null });
  await window.keyboard.press('Escape');
  await expect(window.getByRole('region', { name: 'Pick a model' })).toBeVisible();
});

test("removing a connection takes its models out of the pickers", async () => {
  await seedLogin();
  await openModelTab();

  await settings().getByRole('button', { name: 'Sign out' }).click();

  await expect(picker(settings(), 'Interviewer model')).toHaveText('None');
  await picker(settings(), 'Feedback model').click();
  await expect(options()).toHaveText(['Same as interviewer', 'Add a model…']);
  await expect.poll(settingsFile).toMatchObject({ yourModels: [] });
});
