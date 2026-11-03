import { readFileSync } from 'node:fs';
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

  // Ollama is running with models, so it's the way picked to start with.
  await expect(step().getByText('Running on this computer · 2 models')).toBeVisible();
  await expect(step().getByRole('radio', { name: /Ollama/ })).toBeChecked();
  await choose(step(), 'Model', 'gemma3:270m');
  await step().getByRole('button', { name: 'Use this model' }).click();

  await expect(step()).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeEnabled();
  // The screen moves on as soon as main has the choice; settings.json is written a moment later.
  await expect.poll(settingsFile).toMatchObject({ interviewerModel: { provider: 'ollama', model: 'gemma3:270m' }, ollamaAddress: ollama.origin });
  // Asked once to answer, with the context size set.
  expect(ollama.chats()).toHaveLength(1);
  expect(ollama.chats()[0]!.body).toMatchObject({ model: 'gemma3:270m', options: { num_ctx: 8192 } });
});

test("says when Ollama isn't running and how to start it, and finds it at another address", async () => {
  ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

  await step().getByRole('radio', { name: /Ollama/ }).check();
  await expect(step().getByRole('alert')).toContainText("Ollama isn't running");
  await expect(step().getByRole('alert')).toContainText('ollama serve');

  await step().getByLabel('Ollama address').fill(ollama.origin);
  await step().getByRole('button', { name: 'Refresh' }).click();

  await expect(step().getByText('Running on this computer · 2 models')).toBeVisible();
  await expect(step().getByRole('button', { name: 'Use this model' })).toBeEnabled();
});

test('an API key is hidden as it is typed, and nothing can be saved without one', async () => {
  ({ app, window, dataDir } = await launchApp({ modelPicked: false }));

  const pickKey = (name: string) => step().getByRole('option', { name, exact: true }).click();
  const backToList = () => step().getByRole('button', { name: 'Back' }).click();

  await step().getByRole('radio', { name: /API key/ }).check();
  await pickKey('OpenAI');
  await expect(picker(step(), 'Model')).toHaveText('GPT-6.1 Sol'); // OpenAI's list starts on the default
  await backToList();
  await pickKey('OpenRouter');
  await expect(picker(step(), 'Model')).toHaveText('OpenAI: GPT-6.1 Sol');
  await backToList();
  await pickKey('Anthropic');
  await expect(step().getByRole('textbox', { name: 'API key', exact: true })).toHaveAttribute('type', 'password');
  // With no key, nothing can be checked or saved.
  await expect(step().getByRole('button', { name: 'Check and save' })).toBeDisabled();
});
