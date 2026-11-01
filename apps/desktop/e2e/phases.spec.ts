import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchAtIntro, launchIntoRoom, longIntro, turnReply } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.afterEach(async () => {
  await closeApp(app);
});

test('the interviewer opens the round with an intro', async () => {
  const launched = await launchAtIntro();
  app = launched.app;

  await expect(launched.window.getByTestId('subtitle')).toContainText('Hi, thanks for joining.');
});

/** A round whose interviewer hears the candidate as done and offers to move on, then replies with `then`. */
async function offered(then: ReturnType<typeof turnReply.ack>) {
  ({ app, window } = await launchIntoRoom({
    // Hearing them as done makes the offer a risky reply, so it's checked before it's said.
    model: { 'interviewer-reply': [longIntro, turnReply.offer('Want to talk through your approach?'), then], 'reply-check': [turnReply.passes] },
  }));
  await say("I think that's it.");
  await expect(window.getByTestId('subtitle')).toHaveText('Want to talk through your approach?');
}

async function say(text: string) {
  await window.getByRole('textbox', { name: 'What you said' }).fill(text);
  await window.getByRole('textbox', { name: 'What you said' }).press('Enter');
}

test('an offer to move on is just said, and the candidate answers it in words', async () => {
  await offered(turnReply.agreed('Great, go ahead.', 'approach'));
  await expect(window.getByRole('button', { name: /move on|not yet/i })).toHaveCount(0);

  await say("sure, let's do it");

  await expect(window.getByTestId('phase')).toHaveText('Approach');
});

test('carrying on instead of agreeing keeps the phase', async () => {
  await offered(turnReply.ack('Sure, go on.'));

  await say('Actually, one more thing about duplicates.');

  await expect(window.getByTestId('subtitle')).toHaveText('Sure, go on.');
  await expect(window.getByTestId('phase')).toHaveText('Clarify');
});
