import { expect, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

test('candidate starts a coding round and sees the room', async () => {
  const { app, window } = await launchApp();

  await expect(window.getByRole('button', { name: 'System design round' })).toBeDisabled();
  await expect(window.getByRole('button', { name: 'AI-assisted round' })).toBeDisabled();

  await window.getByRole('button', { name: 'Start coding round' }).click();

  const topBar = window.getByRole('banner', { name: 'Round status' });
  await expect(topBar).toContainText('Coding round');
  await expect(window.getByTestId('phase')).toHaveText('Clarify');
  // The timer runs on the real clock here, so only check that it has started counting.
  await expect(window.getByTestId('timer')).toHaveText(/^00:0[1-9]$/, { timeout: 5_000 });

  await closeApp(app);
});

test('with no model picked yet, Start waits for one and asks for it', async () => {
  const { app, window } = await launchApp({ modelPicked: false });

  const step = window.getByRole('region', { name: 'Pick a model' });
  await expect(step).toBeVisible();
  await expect(step.getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeDisabled();

  await closeApp(app);
});

test('once a model is picked, the step is gone', async () => {
  const { app, window } = await launchApp();

  await expect(window.getByRole('region', { name: 'Pick a model' })).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeEnabled();

  await closeApp(app);
});

test('Continue with ChatGPT opens the sign-in in the browser, and can be cancelled', async () => {
  const { app, window } = await launchApp({ modelPicked: false });
  // Catch the browser opening instead of opening one; nothing reaches OpenAI.
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });

  await window.getByRole('button', { name: 'Continue with ChatGPT' }).click();

  await expect(window.getByRole('status').filter({ hasText: 'Finish signing in in your browser' })).toBeVisible();
  const [page] = await app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);
  const url = new URL(page!);
  expect(`${url.origin}${url.pathname}`).toBe('https://auth.openai.com/api/accounts/authorize');
  expect(url.searchParams.get('agent_name_hint')).toBe('InterviewHarness');

  await window.getByRole('button', { name: 'Cancel' }).click();

  await expect(window.getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeDisabled();
  await expect(fetch(url.searchParams.get('redirect_uri')!)).rejects.toThrow(); // the listener is gone

  await closeApp(app);
});
