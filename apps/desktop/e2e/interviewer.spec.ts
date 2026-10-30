import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import type { ModelScript } from '@interviewharness/engine/test';
import { closeApp, launchApp, readRoundLog, stopTalkingButton, talkButton } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.afterEach(async () => {
  await closeApp(app);
});

const interviewer = () => window.getByRole('status', { name: 'Interviewer' });
const tileState = () => window.getByTestId('interviewer-state');
const said = () => window.getByRole('textbox', { name: 'What you said' });

/** Opens a round whose interviewer's words come from `replies`, in order. */
async function startWith(replies: NonNullable<ModelScript['interviewer-reply']>) {
  ({ app, window, dataDir } = await launchApp({ model: { 'interviewer-reply': replies } }));
  await window.getByRole('button', { name: 'Start coding round' }).click();
}

async function say(text: string) {
  await said().fill(text);
  await said().press('Enter');
}

test("the model writes the interviewer's words: the intro, and the answer to a question", async () => {
  await startWith([
    'Hi, I am your interviewer today.',
    { object: { words: 'Yes, the list can be empty; return an empty list then.', kind: 'answer', askedForHelp: false, hintLevel: 'none', phase: 'clarify' } },
  ]);
  const line = window.getByRole('log', { name: 'Transcript' }); // shown by default
  await expect(line.getByText('Hi, I am your interviewer today.')).toBeVisible();

  await say('Can the list be empty?');

  await expect(line.getByText('Yes, the list can be empty; return an empty list then.')).toBeVisible();
  const calls = readRoundLog(dataDir).filter((entry) => entry.modelCall);
  expect(calls.map((entry) => [entry.modelCall.reply, entry.modelCall.outcome])).toEqual([
    ['intro', 'spoken'],
    ['turn', 'spoken'],
  ]);
  expect(calls[0].modelCall.model).toEqual({ provider: 'scripted', model: 'scripted-fake' });
});

test('the interviewer thinks quietly while its words are written, and talking over it drops them', async () => {
  await startWith([{ text: 'Hi, I am your interviewer today.', delayMs: 3_000 }]);
  await expect(interviewer()).toHaveAttribute('data-state', 'preparing');
  await expect(tileState()).toHaveText('Thinking');

  await talkButton(window).click();

  await expect(interviewer()).toHaveAttribute('data-state', 'listening');
  await stopTalkingButton(window).click();
  await window.waitForTimeout(3_500); // past when the words would have arrived
  await expect(window.getByText('Hi, I am your interviewer today.')).toHaveCount(0);
  expect(readRoundLog(dataDir).filter((entry) => entry.modelCall).map((entry) => entry.modelCall.outcome)).toEqual([
    'aborted',
  ]);
});

test('a failing model gives a stock line and a small notice, and the round carries on', async () => {
  await startWith([{ error: 'offline' }]);

  await expect(window.getByRole('status', { name: 'Notice' })).toHaveText(
    "Couldn't reach the model, so the interviewer used a stock line.",
  );
  await expect(interviewer()).toHaveAttribute('data-state', 'speaking');
  expect(readRoundLog(dataDir).find((entry) => entry.modelCall)?.modelCall).toMatchObject({
    outcome: 'failed',
    error: 'offline',
  });
});

test('what the candidate says carries their code, into the round log', async () => {
  await startWith(['Hi, I am your interviewer today.', { object: { words: 'Looks reasonable so far.', kind: 'answer', askedForHelp: false, hintLevel: 'none', phase: 'clarify' } }]);
  await expect(window.getByRole('log', { name: 'Transcript' }).getByText('Hi, I am your interviewer today.')).toBeVisible();
  await window.getByRole('textbox', { name: 'Code editor' }).click();
  await window.keyboard.type('def two_sum(nums, target):');

  await say('Does my signature look right?');

  await expect(window.getByRole('log', { name: 'Transcript' }).getByText('Looks reasonable so far.')).toBeVisible();
  const said = readRoundLog(dataDir).find((entry) => entry.signal?.type === 'said');
  expect(said.signal.code).toEqual({ language: 'python', text: 'def two_sum(nums, target):' });
  expect(readRoundLog(dataDir).find((entry) => entry.modelCall?.reply === 'turn').modelCall.hint).toEqual({ askedForHelp: false, level: 'none' });
});

test('when the candidate has moved on by themselves, the round follows', async () => {
  await startWith(['Hi, I am your interviewer today.', { object: { words: 'Okay, I see the code. Go on.', kind: 'acknowledgement', askedForHelp: false, hintLevel: 'none', phase: 'code' } }]);
  await expect(window.getByRole('log', { name: 'Transcript' }).getByText('Hi, I am your interviewer today.')).toBeVisible();
  await expect(window.getByTestId('phase')).toHaveText('Clarify');

  await say('I already wrote the brute force');

  await expect(window.getByRole('log', { name: 'Transcript' }).getByText('Okay, I see the code. Go on.')).toBeVisible();
  await expect(window.getByTestId('phase')).toHaveText('Code');
  expect(readRoundLog(dataDir).find((entry) => entry.decision?.kind === 'phase-moved')).toMatchObject({ decision: { phase: 'code' } });
});
