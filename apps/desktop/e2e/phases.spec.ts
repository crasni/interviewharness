import { type ElectronApplication, expect, test } from '@playwright/test';
import { closeApp, launchAtIntro, launchIntoRoom, longIntro, turnReply } from './launch.ts';

let app: ElectronApplication;

test.afterEach(async () => {
  await closeApp(app);
});

test('the interviewer opens the round with an intro', async () => {
  const launched = await launchAtIntro();
  app = launched.app;

  await expect(launched.window.getByTestId('subtitle')).toContainText('Hi, thanks for joining.');
});

/** A round whose interviewer hears the candidate as done, and offers to move on. */
const offering = (...more: ReturnType<typeof turnReply.ack>[]) => ({
  model: { 'interviewer-reply': [longIntro, turnReply.offer('Want to talk through your approach?'), ...more] },
});

test('the candidate accepts a suggestion to move on, and the phase changes', async () => {
  const launched = await launchIntoRoom(offering());
  app = launched.app;
  const { window } = launched;
  await window.getByRole('textbox', { name: 'What you said' }).fill("I think that's it.");
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');

  await expect(window.getByTestId('subtitle')).toHaveText('Want to talk through your approach?');
  await window.getByRole('group', { name: 'Move on to Approach?' }).getByRole('button', { name: 'Move on' }).click();

  await expect(window.getByTestId('phase')).toHaveText('Approach');
  await expect(window.getByRole('button', { name: 'Move on' })).toHaveCount(0);
});

test('"Not yet" keeps the phase', async () => {
  const launched = await launchIntoRoom(offering());
  app = launched.app;
  const { window } = launched;
  await window.getByRole('textbox', { name: 'What you said' }).fill("I think that's it.");
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');

  await window.getByRole('button', { name: 'Not yet' }).click();

  await expect(window.getByTestId('phase')).toHaveText('Clarify');
  await expect(window.getByRole('button', { name: 'Not yet' })).toHaveCount(0);
});

test('carrying on instead of answering withdraws the suggestion', async () => {
  const launched = await launchIntoRoom(offering(turnReply.ack('Sure, go on.')));
  app = launched.app;
  const { window } = launched;
  await window.getByRole('textbox', { name: 'What you said' }).fill("I think that's it.");
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');
  await expect(window.getByRole('button', { name: 'Not yet' })).toBeVisible();

  await window.getByRole('textbox', { name: 'What you said' }).fill('Actually, one more thing about duplicates.');
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');

  await expect(window.getByRole('button', { name: 'Not yet' })).toHaveCount(0);
  await expect(window.getByTestId('phase')).toHaveText('Clarify');
});
