import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, expect, type Page } from '@playwright/test';

export const talkButton = (window: Page) => window.getByRole('button', { name: 'Talk', exact: true });
export const stopTalkingButton = (window: Page) => window.getByRole('button', { name: 'Stop talking' });

/** Launches the built app in a hidden window, with its own throwaway data folder. */
export async function launchApp() {
  const dataDir = mkdtempSync(join(tmpdir(), 'interviewharness-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, INTERVIEWHARNESS_DATA_DIR: dataDir, INTERVIEWHARNESS_HIDDEN_WINDOW: '1' },
    // No emulated colour scheme: Playwright's default (light) would hide the theme the app sets itself.
    colorScheme: null,
  });
  const window = await app.firstWindow();
  return { app, window, dataDir };
}

/** Launches the app and starts a coding round, stopping at the interviewer's intro. */
export async function launchAtIntro() {
  const launched = await launchApp();
  await launched.window.getByRole('button', { name: 'Start coding round' }).click();
  await expect(talkButton(launched.window)).toBeVisible();
  return launched;
}

/**
 * Launches the app, starts a coding round, and talks over the intro so the room is quiet.
 * (The intro takes ~10 s to say; a quick Talk / Stop talking is a barge-in that stops it.)
 */
export async function launchIntoRoom() {
  const launched = await launchAtIntro();
  const { window } = launched;
  const interviewer = window.getByRole('status', { name: 'Interviewer' });
  await expect(interviewer).toHaveAttribute('data-state', 'speaking');
  // An instant tap, under the 1 s that counts as having said something, so setup never earns a backchannel.
  await talkButton(window).dispatchEvent('click');
  await stopTalkingButton(window).dispatchEvent('click');
  await expect(interviewer).toHaveAttribute('data-state', 'listening');
  return launched;
}

/** The round's events.jsonl entries, parsed. */
export function readRoundLog(dataDir: string) {
  const [round] = readdirSync(join(dataDir, 'rounds'));
  return readFileSync(join(dataDir, 'rounds', round!, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

/** Closes the app; if Electron hangs on close (rare, seen once in ~50 runs), kills the process instead. */
export async function closeApp(app: ElectronApplication) {
  const closed = app.close().then(() => true);
  const timedOut = new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000));
  if (!(await Promise.race([closed, timedOut]))) app.process().kill('SIGKILL');
}
