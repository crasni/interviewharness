import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { launchIntoRoom, readRoundLog } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
});

test.afterEach(async () => {
  await app.close();
});

const problem = () => window.getByRole('region', { name: 'Problem' });
const editor = () => window.getByRole('textbox', { name: 'Code editor' });

test('the problem is shown, and can be hidden and shown again', async () => {
  await expect(problem().getByRole('heading', { name: 'Longest calm stretch' })).toBeVisible();

  await window.getByRole('button', { name: 'Hide problem' }).click();
  await expect(problem().getByRole('heading', { name: 'Longest calm stretch' })).toBeHidden();

  await window.getByRole('button', { name: 'Show problem' }).click();
  await expect(problem().getByRole('heading', { name: 'Longest calm stretch' })).toBeVisible();
});

test('the editor takes code, Space types instead of talking, and typing is sent as activity', async () => {
  await editor().click();
  await window.keyboard.type('def longest_calm(readings, t):');

  await expect(editor()).toContainText('def longest_calm(readings, t):');
  await expect(window.getByRole('status', { name: 'You' })).toHaveText('Hold Space to talk');
  await expect.poll(() => readRoundLog(dataDir).some((e) => e.signal.type === 'editor-activity')).toBe(true);
});

test('the transcript drawer shows the whole conversation, toggled with a shortcut', async () => {
  await window.getByRole('textbox', { name: 'What you said' }).fill('Can the readings be negative?');
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');
  await expect(window.getByTestId('subtitle')).not.toHaveText('');

  await window.getByRole('banner', { name: 'Round status' }).click(); // leave text fields so Space means "talk"
  await window.keyboard.press('ControlOrMeta+t');
  const transcript = window.getByRole('complementary', { name: 'Transcript' });

  await expect(transcript).toContainText('Hi, thanks for joining.');
  await expect(transcript).toContainText('Can the readings be negative?');
  await expect(transcript).toContainText('Good question. You can assume the input fits in memory.');

  await window.keyboard.press('ControlOrMeta+t');
  await expect(transcript).toBeHidden();
});

test('a subtitle fades a few seconds after the interviewer finishes', async () => {
  await window.getByRole('textbox', { name: 'What you said' }).fill('I would use two pointers.');
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');
  const subtitle = window.getByTestId('subtitle');
  await expect(subtitle).toHaveAttribute('data-faded', 'false');

  await expect(subtitle).toHaveAttribute('data-faded', 'true', { timeout: 10_000 });
  await expect(subtitle).toHaveText('Okay, that makes sense.'); // still there for screen readers and the transcript
});
