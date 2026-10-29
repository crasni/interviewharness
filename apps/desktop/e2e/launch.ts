import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

/** Launches the built app in a hidden window, with its own throwaway data folder. */
export async function launchApp() {
  const dataDir = mkdtempSync(join(tmpdir(), 'interviewharness-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, INTERVIEWHARNESS_DATA_DIR: dataDir, INTERVIEWHARNESS_HIDDEN_WINDOW: '1' },
  });
  const window = await app.firstWindow();
  return { app, window, dataDir };
}

/** Launches the app and starts a coding round, stopping at the interviewer's intro. */
export async function launchAtIntro() {
  const launched = await launchApp();
  await launched.window.getByRole('button', { name: 'Start coding round' }).click();
  await expect(launched.window.getByRole('status', { name: 'You' })).toBeVisible();
  return launched;
}

/**
 * Launches the app, starts a coding round, and talks over the intro so the room is quiet.
 * (The intro takes ~10 s to say; a tap of Space is a barge-in that stops it.)
 */
export async function launchIntoRoom() {
  const launched = await launchAtIntro();
  const { window } = launched;
  const interviewer = window.getByRole('status', { name: 'Interviewer' });
  await expect(interviewer).toHaveAttribute('data-state', 'speaking');
  await window.keyboard.press('Space');
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
