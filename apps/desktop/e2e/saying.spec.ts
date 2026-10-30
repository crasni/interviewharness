import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom, longIntro, stopTalkingButton, talkButton, turnReply } from './launch.ts';

let app: ElectronApplication;
let window: Page;

/** Opens a quiet room whose interviewer replies to the candidate's turns with `replies`, in order. */
async function enter(...replies: ReturnType<typeof turnReply.ack>[]) {
  ({ app, window } = await launchIntoRoom({ model: { 'interviewer-reply': [longIntro, ...replies] } }));
}

const goodQuestion = turnReply.answer('Good question. You can assume the input fits in memory, and that it has at least two values.');

test.afterEach(async () => {
  await closeApp(app);
});

const said = () => window.getByRole('textbox', { name: 'What you said' });

async function say(text: string) {
  await said().fill(text);
  await said().press('Enter');
}

test('a question gets an answer, and the candidate sees their own words', async () => {
  await enter(goodQuestion);
  await say('Can the input be empty?');

  await expect(window.getByTestId('candidate-words')).toHaveText('Can the input be empty?');
  await expect(window.getByTestId('subtitle')).toHaveText(goodQuestion.object.words);
  await expect(said()).toHaveValue('');
});

test('a statement gets an acknowledgement', async () => {
  await enter(turnReply.ack('Okay, that makes sense.'));
  await say('I would use a hash map from value to index.');

  await expect(window.getByTestId('subtitle')).toHaveText('Okay, that makes sense.');
});

test('talking over the interviewer stops it', async () => {
  await enter(goodQuestion);
  await say('Can the input be empty?'); // the answer is long enough to talk over
  const interviewer = window.getByRole('status', { name: 'Interviewer' });
  await expect(interviewer).toHaveAttribute('data-state', 'speaking');

  await talkButton(window).click();

  await expect(interviewer).toHaveAttribute('data-state', 'listening');
  await expect(window.getByTestId('subtitle')).toHaveAttribute('data-cut-off', 'true');
  await expect(window.getByTestId('subtitle')).toContainText('cut off');
  await stopTalkingButton(window).click();
});

test('Space types a space in the text field', async () => {
  await enter();
  await said().click();
  await window.keyboard.type('a b');

  await expect(said()).toHaveValue('a b');
  await expect(talkButton(window)).toHaveAttribute('aria-pressed', 'false');
});
