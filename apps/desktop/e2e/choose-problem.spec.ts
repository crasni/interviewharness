import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

/** Saves a round as the app would have: a folder in rounds/ with its events.jsonl. */
function saveRound(dataDir: string, folder: string, firstLine: string) {
  mkdirSync(join(dataDir, 'rounds', folder), { recursive: true });
  writeFileSync(join(dataDir, 'rounds', folder, 'events.jsonl'), `${firstLine}\n`);
}

const problemList = (window: Page) => window.getByRole('region', { name: 'Choose a problem' });

test('Choose a problem lists the problems by title and difficulty, never their topic', async () => {
  const { app, window } = await launchApp();

  await window.getByRole('button', { name: 'Choose a problem' }).click();
  const list = problemList(window);
  await expect(list.getByRole('heading', { name: 'Choose a problem' })).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(10);
  // Easiest first: the two easy ones, then the medium ones, then the hard one.
  await expect(list.getByRole('listitem').first()).toContainText('Balanced brackets');
  await expect(list.getByRole('listitem').last()).toContainText('Fewest coins');
  await expect(list.getByRole('button', { name: /^Two sum/ })).toContainText('Easy');
  for (const topic of ['Hash map', 'Stack', 'Heap', 'Dynamic programming']) await expect(list).not.toContainText(topic);
  // Nothing done yet, so no count shows.
  await expect(list).not.toContainText('Done');
  await expect(window.getByRole('button', { name: 'Start coding round' })).toHaveCount(0);

  await list.getByRole('button', { name: 'Back' }).click();
  await expect(window.getByRole('button', { name: 'Start coding round' })).toBeVisible();

  await closeApp(app);
});

test('a problem in the list starts a round on it', async () => {
  const { app, window } = await launchApp();

  await window.getByRole('button', { name: 'Choose a problem' }).click();
  await problemList(window).getByRole('button', { name: /^Two sum/ }).click();

  await expect(window.getByTestId('phase')).toHaveText('Clarify');
  await expect(window.getByRole('region', { name: 'Problem' }).getByRole('heading', { level: 1 })).toHaveText('Two sum');

  await closeApp(app);
});

test('each problem says how many rounds were done on it, counted from the saved rounds', async () => {
  const { app, window } = await launchApp({
    seed: (dataDir) => {
      saveRound(dataDir, '2026-11-01T10-00-00-000Z', JSON.stringify({ at: 0, started: { kind: 'coding', problem: 'two-sum' } }));
      // Rounds from before v0.1.2 name no problem: they were all Two sum.
      saveRound(dataDir, '2026-10-30T10-00-00-000Z', JSON.stringify({ at: 0, signal: { type: 'tick' } }));
      // A log that can't be read is skipped, not fatal.
      saveRound(dataDir, '2026-10-29T10-00-00-000Z', '{ not json');
    },
  });

  await window.getByRole('button', { name: 'Choose a problem' }).click();
  await expect(problemList(window).getByRole('button', { name: /^Two sum/ })).toContainText('Done twice');

  await closeApp(app);
});

test('with no model picked yet, there is no problem to choose', async () => {
  const { app, window } = await launchApp({ modelPicked: false });

  await expect(window.getByRole('region', { name: 'Pick a model' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Choose a problem' })).toHaveCount(0);

  await closeApp(app);
});
