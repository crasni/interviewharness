import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom, stopTalkingButton, talkButton } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchIntoRoom());
});

test.afterEach(async () => {
  await app.close();
});

const said = () => window.getByRole('textbox', { name: 'What you said' });

async function say(text: string) {
  await said().fill(text);
  await said().press('Enter');
}

test('a question gets an answer, and the candidate sees their own words', async () => {
  await say('Can the input be empty?');

  await expect(window.getByTestId('candidate-words')).toHaveText('Can the input be empty?');
  await expect(window.getByTestId('subtitle')).toHaveText('Good question. You can assume the input fits in memory.');
  await expect(said()).toHaveValue('');
});

test('a statement gets an acknowledgement', async () => {
  await say('I would use a hash map from value to index.');

  await expect(window.getByTestId('subtitle')).toHaveText('Okay, that makes sense.');
});

test('talking over the interviewer stops it', async () => {
  await say('Can the input be empty?'); // the answer is long enough to talk over
  const interviewer = window.getByRole('status', { name: 'Interviewer' });
  await expect(interviewer).toHaveAttribute('data-state', 'speaking');

  await talkButton(window).click();

  await expect(interviewer).toHaveAttribute('data-state', 'listening');
  await expect(window.getByTestId('subtitle')).toHaveText('');
  await stopTalkingButton(window).click();

  await window.keyboard.press('ControlOrMeta+t');
  await expect(window.getByRole('complementary', { name: 'Transcript' }).getByRole('listitem').last()).toContainText(
    'Interviewer · cut off',
  );
});

test('Space types a space in the text field', async () => {
  await said().click();
  await window.keyboard.type('a b');

  await expect(said()).toHaveValue('a b');
  await expect(talkButton(window)).toHaveAttribute('aria-pressed', 'false');
});
