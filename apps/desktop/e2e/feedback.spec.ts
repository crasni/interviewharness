import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelScript } from '@interviewharness/engine/test';
import { type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { closeApp, endRound, launchApp, readRoundLog } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.afterEach(async () => {
  await closeApp(app);
});

/** One grader's scores: solid everywhere, each citing a line of the round. */
const solid = {
  object: {
    problemSolving: { score: 3, evidence: ['t2'] },
    coding: { score: 3, evidence: ['t2'] },
    testing: { score: 3, evidence: ['t3'] },
    communication: { score: 3, evidence: ['t2'] },
  },
};

const prose = {
  object: {
    why: 'You asked the right question early and kept your reasoning out loud.',
    wentWell: [{ text: 'Asked whether values can repeat before designing anything.', evidence: 't2' }],
    toFix: [{ text: 'Trace an example through the code before calling it done.', evidence: 't3' }],
  },
};

/**
 * A short round with a scripted interviewer: its intro (t1), the candidate's question (t2) and its answer (t3).
 * `grading` scripts the graders' replies, in order.
 */
async function playRound(grading: NonNullable<ModelScript['grading']>) {
  ({ app, window, dataDir } = await launchApp({
    model: {
      'interviewer-reply': ['Hi, take a look at the problem.', { object: { words: 'Yes, values can repeat.', heard: 'clarifying-question', kind: 'answer', hintLevel: 'none', movesTo: 'stays', checkedCode: false, foundOwnMistake: false, saysCodeDone: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' } }],
      grading,
      'feedback-prose': [prose],
    },
  }));
  await window.getByRole('button', { name: 'Start coding round' }).click();
  const transcript = window.getByRole('log', { name: 'Transcript' });
  await expect(transcript.getByText('Hi, take a look at the problem.')).toBeVisible();
  await window.getByRole('textbox', { name: 'What you said' }).fill('Can values repeat?');
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');
  await expect(transcript.getByText('Yes, values can repeat.')).toBeVisible();
}

const feedbackScreen = () => window.getByRole('main', { name: 'Feedback' });

test('ending the round asks first, and "Keep going" keeps it', async () => {
  await playRound([solid, solid, solid]);

  await window.getByRole('button', { name: 'End round' }).click();
  await window.getByRole('group', { name: 'End the round?' }).getByRole('button', { name: 'Keep going' }).click();

  await expect(window.getByRole('button', { name: 'End round' })).toBeVisible();
  await expect(feedbackScreen()).toHaveCount(0);
});

test('the Feedback is written from the round: a verdict, why, and points at their moments, with no scores', async () => {
  await playRound([solid, solid, solid]);

  await endRound(window);

  const scale = feedbackScreen().getByRole('list', { name: 'Verdict' });
  await expect(scale.getByRole('listitem')).toHaveText(['Strong hire', 'Hire', 'Lean hire', 'Lean no hire', 'No hire', 'Strong no hire']);
  // Solid everywhere, but the code was never checked, so testing is capped at mixed: 3 + 3 + 2 + 3.
  await expect(scale.locator('[aria-current="true"]')).toHaveText('Lean hire');
  await expect(feedbackScreen().getByRole('region', { name: 'Why' })).toContainText('You asked the right question early');
  const wentWell = feedbackScreen().getByRole('region', { name: 'What went well' }).getByRole('listitem');
  await expect(wentWell).toHaveText([/^\d\d:\d\dAsked whether values can repeat/]);
  await expect(feedbackScreen().getByText(/score|\b[1-4] ?\/ ?4\b/i)).toHaveCount(0);
  await expect(feedbackScreen().getByText('Sample feedback')).toHaveCount(0);
});

test("the Feedback is saved in the round's folder, scores included, and how it was reached is in the log", async () => {
  await playRound([solid, solid, solid]);
  await endRound(window);
  await expect(feedbackScreen().getByRole('region', { name: 'Why' })).toBeVisible();

  const [round] = readdirSync(join(dataDir, 'rounds'));
  const saved = JSON.parse(readFileSync(join(dataDir, 'rounds', round!, 'feedback.json'), 'utf8'));
  expect(saved).toMatchObject({
    verdict: 'Lean hire',
    areas: { problemSolving: { score: 3, evidence: ['t2'] }, testing: { score: 2 } },
    model: { provider: 'scripted' },
  });
  expect(JSON.stringify(saved)).not.toMatch(/token|apiKey|secret/i);
  const log = readRoundLog(dataDir);
  expect(log.find((entry) => entry.signal?.type === 'round-end')).toMatchObject({ signal: { code: { language: 'python' } } });
  // How the verdict was reached is in the log too: every sample, as given and as checked.
  expect(log.at(-1)).toMatchObject({ grading: { outcome: 'written', verdict: 'Lean hire', model: { provider: 'scripted' } } });
  expect(log.at(-1).grading.samples).toHaveLength(3);
});

test('a failed grading shows a plain error, and Try again works without the round again', async () => {
  await playRound([{ error: 'offline' }, solid, solid, solid, solid, solid]);
  await endRound(window);

  await expect(feedbackScreen().getByRole('alert')).toContainText("Couldn't reach the model to write your Feedback.");
  await feedbackScreen().getByRole('button', { name: 'Try again' }).click();

  await expect(feedbackScreen().getByRole('list', { name: 'Verdict' }).locator('[aria-current="true"]')).toHaveText('Lean hire');
  await expect(feedbackScreen().getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('leads back to the start screen', async () => {
  await playRound([solid, solid, solid]);
  await endRound(window);

  await window.getByRole('button', { name: 'Back to start' }).click();

  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeVisible();
});

test('in a short window the Feedback screen still fits: only the feedback scrolls, the verdict and the way out stay', async () => {
  await playRound([solid, solid, solid]);
  await endRound(window);
  await expect(feedbackScreen().getByRole('region', { name: 'Why' })).toBeVisible();

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1000, 420));
  const written = feedbackScreen().getByLabel('Written feedback');
  await expect.poll(() => written.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await feedbackScreen().evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // Measured by hand: toBeInViewport waits on frames, which a hidden window doesn't draw.
  const onScreen = (locator: Locator) =>
    locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= el.ownerDocument.documentElement.clientHeight;
    });
  await written.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await onScreen(feedbackScreen().getByRole('heading', { name: 'Feedback' }))).toBe(true);
  expect(await onScreen(feedbackScreen().getByRole('list', { name: 'Verdict' }))).toBe(true);
  expect(await onScreen(window.getByRole('button', { name: 'Back to start' }))).toBe(true);
});

test('a round with nothing said in it gets no grade, just a plain note', async () => {
  ({ app, window, dataDir } = await launchApp({ model: { 'interviewer-reply': ['Hi, take a look at the problem.'] } }));
  await window.getByRole('button', { name: 'Start coding round' }).click();

  await endRound(window);

  await expect(feedbackScreen().getByRole('alert')).toContainText('nothing was said');
  await expect(feedbackScreen().getByRole('list', { name: 'Verdict' })).toHaveCount(0);
  await expect(feedbackScreen().getByRole('button', { name: 'Try again' })).toHaveCount(0);
});
