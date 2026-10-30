import { readFileSync, writeFileSync } from 'node:fs';
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

test('shows the interviewer model, and offers to sign in when logged out', async () => {
  await openModelTab();

  await expect(settings().getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(settings().getByLabel('Interviewer model', { exact: true })).toHaveValue('gpt-5-mini');
  await expect(settings().getByLabel('Interviewer model', { exact: true })).toBeDisabled();
  await expect(settings().getByLabel('Feedback model', { exact: true })).toHaveValue('');
});

test('changes the interviewer and Feedback models, and marks a model small', async () => {
  await seedLogin();
  await openModelTab();
  await expect(settings().getByText('Signed in with ChatGPT')).toBeVisible();

  await settings().getByLabel('Interviewer model', { exact: true }).selectOption('gpt-5-nano');
  await settings().getByLabel('Feedback model', { exact: true }).selectOption('gpt-5.5');
  await settings().getByRole('switch', { name: 'Treat the Feedback model as small' }).check();

  await expect
    .poll(settingsFile)
    .toMatchObject({
      interviewerModel: { provider: 'chatgpt', model: 'gpt-5-nano' },
      feedbackModel: { provider: 'chatgpt', model: 'gpt-5.5' },
      smallModels: ['chatgpt/gpt-5.5'],
    });

  await settings().getByLabel('Feedback model', { exact: true }).selectOption('');
  await expect.poll(settingsFile).toMatchObject({ feedbackModel: null });
  // "Same as interviewer": the switch now speaks about the interviewer's model, which isn't marked.
  await expect(settings().getByRole('switch', { name: 'Treat the Feedback model as small' })).not.toBeChecked();
});

test('logging out forgets the login, and Start asks for a model again', async () => {
  await seedLogin();
  await openModelTab();

  await settings().getByRole('button', { name: 'Log out' }).click();

  await expect(settings().getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  expect(JSON.parse(readFileSync(join(dataDir, 'credentials.json'), 'utf8')).entries).toEqual({});
  await expect.poll(settingsFile).toMatchObject({ interviewerModel: null });
  await window.keyboard.press('Escape');
  await expect(window.getByRole('region', { name: 'Pick a model' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeDisabled();
});
