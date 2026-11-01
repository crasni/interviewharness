import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeKeyServer, fakeOllama } from '@interviewharness/providers/test';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;
let ollama: Awaited<ReturnType<typeof fakeOllama>>;

test.beforeEach(async () => {
  ollama = await fakeOllama([
    { name: 'qwen3:0.6b', parameterSize: '751.63M' },
    { name: 'gemma3:270m', parameterSize: '268.10M' },
  ]);
});

test.afterEach(async () => {
  await closeApp(app);
  await ollama.close();
});

const step = () => window.getByRole('region', { name: 'Pick a model' });
const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));

test('finds Ollama on this computer, and a model that answers is picked', async () => {
  ({ app, window, dataDir } = await launchApp({ modelPicked: false, ollamaAddress: ollama.origin }));
  ollama.reply({ text: 'OK' });

  await expect(step().getByText('Running · 2 models')).toBeVisible();
  await step().getByLabel('Ollama model').selectOption('gemma3:270m');
  await step().getByRole('button', { name: 'Use Ollama' }).click();

  await expect(step()).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeEnabled();
  expect(settingsFile()).toMatchObject({ interviewerModel: { provider: 'ollama', model: 'gemma3:270m' }, ollamaAddress: ollama.origin });
  // Asked once to answer, with the context size set.
  expect(ollama.chats()).toHaveLength(1);
  expect(ollama.chats()[0]!.body).toMatchObject({ model: 'gemma3:270m', options: { num_ctx: 8192 } });
});

test("says when Ollama isn't running and how to start it, and finds it at another address", async () => {
  ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

  await expect(step().getByRole('alert')).toContainText("Ollama isn't running");
  await expect(step().getByRole('alert')).toContainText('ollama serve');

  await step().getByLabel('Ollama address').fill(ollama.origin);
  await step().getByRole('button', { name: 'Look again' }).click();

  await expect(step().getByText('Running · 2 models')).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeDisabled();
});

test('picks a model on another OpenAI-compatible server, checked before it is saved', async () => {
  const server = await fakeKeyServer(['qwen2.5-7b-instruct']);
  try {
    ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

    await step().getByRole('button', { name: 'Add' }).click();
    await step().getByLabel('Provider').selectOption('server');
    await step().getByLabel('Server address').fill(`${server.origin}/v1`);
    await step().getByRole('button', { name: 'Find models' }).click();
    await expect(step().getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('qwen2.5-7b-instruct');

    server.reply({ status: 401, body: JSON.stringify({ error: { message: 'Unauthorized' } }) });
    await step().getByRole('button', { name: 'Check and save' }).click();
    await expect(step().getByRole('region', { name: 'API key or other server' }).getByRole('alert')).toContainText('asks for a key');
    expect(settingsFile().interviewerModel ?? null).toBeNull();

    server.reply({ text: 'OK' });
    await step().getByRole('button', { name: 'Check and save' }).click();

    await expect(step()).toHaveCount(0);
    expect(settingsFile()).toMatchObject({ interviewerModel: { provider: 'server', model: 'qwen2.5-7b-instruct' }, serverAddress: `${server.origin}/v1` });
  } finally {
    await server.close();
  }
});

test('an API key is hidden as it is typed, and nothing can be saved without one', async () => {
  ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

  await step().getByRole('button', { name: 'Add' }).click();
  await step().getByLabel('Provider').selectOption('anthropic');
  await expect(step().getByRole('textbox', { name: 'API key', exact: true })).toHaveAttribute('type', 'password');
  // With no key, nothing can be checked or saved.
  await expect(step().getByRole('button', { name: 'Check and save' })).toBeDisabled();
});
