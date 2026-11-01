import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { closeApp, launchApp, readRoundLog } from './launch.ts';

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

test('with no model picked yet, the Start screen asks for one instead of offering rounds', async () => {
  const { app, window } = await launchApp({ modelPicked: false });

  const step = window.getByRole('region', { name: 'Pick a model' });
  await expect(step).toBeVisible();
  // Ollama isn't running here, so ChatGPT is the way picked to start with.
  await expect(step.getByRole('radio', { name: /ChatGPT/ })).toBeChecked();
  await expect(step.getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toHaveCount(0);

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
  // The browser is opened just after that line shows; wait for it rather than look too early.
  const opened = () => app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);
  await expect.poll(async () => (await opened()).length).toBe(1);
  const [page] = await opened();
  const url = new URL(page!);
  expect(`${url.origin}${url.pathname}`).toBe('https://auth.openai.com/api/accounts/authorize');
  expect(url.searchParams.get('agent_name_hint')).toBe('InterviewHarness');

  await window.getByRole('button', { name: 'Cancel' }).click();

  await expect(window.getByRole('button', { name: 'Continue with ChatGPT' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toHaveCount(0);
  await expect(fetch(url.searchParams.get('redirect_uri')!)).rejects.toThrow(); // the listener is gone

  await closeApp(app);
});

test("a round starts on a problem, shows its statement and names it in the round's log", async () => {
  const { app, window, dataDir } = await launchApp();

  await window.getByRole('button', { name: 'Start coding round' }).click();
  // Picked at random: whichever it is, the panel and the log agree.
  const title = await window.getByRole('region', { name: 'Problem' }).getByRole('heading', { level: 1 }).textContent();
  await expect.poll(() => readRoundLog(dataDir)[0]).toMatchObject({ started: { kind: 'coding', problem: expect.any(String) } });
  const { problem } = readRoundLog(dataDir)[0].started;
  const statement = readFileSync(join(import.meta.dirname, '../../../content/problems', problem, 'statement.md'), 'utf8');
  expect(statement.split(/\r?\n/)[0]).toBe(`# ${title}`);

  await closeApp(app);
});
