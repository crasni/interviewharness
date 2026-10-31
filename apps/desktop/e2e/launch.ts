import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ModelScript } from '@interviewharness/engine/test';
import { _electron as electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

export const talkButton = (window: Page) => window.getByRole('button', { name: 'Talk', exact: true });
export const stopTalkingButton = (window: Page) => window.getByRole('button', { name: 'Stop talking' });

/**
 * Launches the built app in a hidden window, with its own throwaway data folder (or `dataDir`, to relaunch).
 * - `model`: a script of replies for the interviewer's words (the engine's scriptedModel). Without one,
 *   it says the example lines as written. No test ever reaches a real model.
 * - `modelPicked`: a new data folder starts with a model already picked, so Start works at once.
 *   False shows the first-run step instead.
 */
export async function launchApp({
  dataDir,
  model,
  modelPicked = true,
}: { dataDir?: string; model?: ModelScript; modelPicked?: boolean } = {}) {
  if (!dataDir) {
    dataDir = mkdtempSync(join(tmpdir(), 'interviewharness-e2e-'));
    if (modelPicked) {
      const settings = { version: 1, interviewerModel: { provider: 'chatgpt', model: 'gpt-5-mini' } };
      writeFileSync(join(dataDir, 'settings.json'), JSON.stringify(settings));
    }
  }
  const app = await electron.launch({
    args: ['.'],
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      INTERVIEWHARNESS_DATA_DIR: dataDir,
      INTERVIEWHARNESS_HIDDEN_WINDOW: '1',
      INTERVIEWHARNESS_FAKE_MODEL: model ? JSON.stringify(model) : 'example-lines',
    },
    // No emulated colour scheme: Playwright's default (light) would hide the theme the app sets itself.
    colorScheme: null,
  });
  // On CI, record a trace so a failure on an OS nobody has at hand can still be looked into.
  if (process.env.CI) await app.context().tracing.start({ screenshots: true, snapshots: true });
  const window = await app.firstWindow();
  return { app, window, dataDir };
}

/** Ends the round: End round, then the confirmation's End round. */
export async function endRound(window: Page) {
  await window.getByRole('button', { name: 'End round' }).click();
  await window.getByRole('group', { name: 'End the round?' }).getByRole('button', { name: 'End round' }).click();
}

/** Launches the app and starts a coding round, stopping at the interviewer's intro. */
export async function launchAtIntro(options: Parameters<typeof launchApp>[0] = {}) {
  const launched = await launchApp(options);
  await launched.window.getByRole('button', { name: 'Start coding round' }).click();
  await expect(talkButton(launched.window)).toBeVisible();
  return launched;
}

/**
 * Launches the app, starts a coding round, and talks over the intro so the room is quiet.
 * (The intro takes ~10 s to say; a quick Talk / Stop talking is a barge-in that stops it.)
 */
export async function launchIntoRoom(options: Parameters<typeof launchApp>[0] = {}) {
  const launched = await launchAtIntro(options);
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
  if (process.env.CI) await saveTraceIfFailed(app);
  const closed = app.close().then(() => true);
  const timedOut = new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000));
  if (!(await Promise.race([closed, timedOut]))) app.process().kill('SIGKILL');
}

/** Keeps the trace of a failed test in its output folder (uploaded by CI); drops it otherwise. */
async function saveTraceIfFailed(app: ElectronApplication) {
  const info = test.info();
  const failed = info.status !== info.expectedStatus;
  await app
    .context()
    .tracing.stop(failed ? { path: info.outputPath('trace.zip') } : undefined)
    .catch(() => {}); // a crashed app has no trace to give; the failure itself is what matters
}

/** Scripted replies to a candidate's turn, as the model gives them: an answer, an acknowledgement or an offer to move on. */
export const turnReply = {
  answer: (words: string) => ({ object: { words, heard: 'clarifying-question', kind: 'answer', hintLevel: 'none', movesTo: 'stays', checkedCode: false, foundOwnMistake: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' } }),
  ack: (words: string) => ({ object: { words, heard: 'explaining', kind: 'acknowledgement', hintLevel: 'none', movesTo: 'stays', checkedCode: false, foundOwnMistake: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' } }),
  offer: (words: string) => ({ object: { words, heard: 'done', kind: 'offer-next-phase', hintLevel: 'none', movesTo: 'stays', checkedCode: false, foundOwnMistake: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' } }),
  /** The candidate agreed to move on: their words moved the round to `phase`. */
  /** The check's verdict on a reply's words that give nothing away (ADR 0019). */
  passes: { object: { namesMistake: false, hintLevel: 'none', describesSolution: false } },
  agreed: (words: string, phase: string) => ({ object: { words, heard: 'agreeing', kind: 'acknowledgement', hintLevel: 'none', movesTo: phase, checkedCode: false, foundOwnMistake: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' } }),
};

/** An intro long enough to talk over, as launchIntoRoom does. */
export const longIntro = "Hi, thanks for joining. This is a 45-minute coding round. Take a moment to read the problem, and ask me anything you'd like to clarify before you start.";
