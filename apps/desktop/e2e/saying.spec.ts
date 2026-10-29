import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom } from './launch.ts';

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
  await say('I would use a hash map from value to index.');
  const interviewer = window.getByRole('status', { name: 'Interviewer' });
  await expect(interviewer).toHaveAttribute('data-state', 'speaking');

  await window.locator('body').click(); // leave the text field so Space means "talk"
  await window.keyboard.down('Space');

  await expect(interviewer).toHaveAttribute('data-state', 'listening');
  await expect(window.getByTestId('subtitle')).toHaveText('');
  await window.keyboard.up('Space');
});

test('Space types a space in the text field instead of talking', async () => {
  await said().click();
  await window.keyboard.type('a b');

  await expect(said()).toHaveValue('a b');
  await expect(window.getByRole('status', { name: 'You' })).toHaveText('Hold Space to talk');
});
