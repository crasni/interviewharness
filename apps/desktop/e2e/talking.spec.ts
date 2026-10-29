import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom, readRoundLog, stopTalkingButton, talkButton } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;

test.beforeEach(async () => {
  ({ app, window, dataDir } = await launchIntoRoom());
});

test.afterEach(async () => {
  await closeApp(app);
});

const roundLog = () => readRoundLog(dataDir);

test('clicking Talk shows the candidate is talking, until they click Stop talking', async () => {
  await talkButton(window).click();
  await expect(stopTalkingButton(window)).toHaveAttribute('aria-pressed', 'true');

  await stopTalkingButton(window).click();
  await expect(talkButton(window)).toHaveAttribute('aria-pressed', 'false');
});

test('Space no longer talks', async () => {
  await window.getByRole('banner', { name: 'Round status' }).click();
  await window.keyboard.down('Space');

  await expect(talkButton(window)).toHaveAttribute('aria-pressed', 'false');
  await window.keyboard.up('Space');
});

test('a short pause mid-turn gets a backchannel, and it is logged', async () => {
  await talkButton(window).click();
  await window.waitForTimeout(1_500);
  await stopTalkingButton(window).click();

  await expect(window.getByTestId('interviewer-state')).toHaveText('Mm-hm.', { timeout: 3_000 });
  expect(roundLog().find((entry) => entry.decision.kind === 'backchannel')).toMatchObject({
    decision: { line: 'Mm-hm.' },
    state: { talking: false },
  });
});
