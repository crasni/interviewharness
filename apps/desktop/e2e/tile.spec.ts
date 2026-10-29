import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchIntoRoom());
});

test.afterEach(async () => {
  await closeApp(app);
});

const tile = () => window.locator('.interviewer-tile');

test('the interviewer sits in a tile in the bottom-right corner, showing what it is doing', async () => {
  await expect(tile()).toHaveAttribute('data-corner', 'bottom-right');
  await expect(window.getByTestId('interviewer-state')).toHaveText('Listening');
});

test('dragging the tile and letting go settles it in the nearest corner, and it remembers', async () => {
  const work = await window.locator('.room-work').boundingBox();
  const box = await tile().boundingBox();
  await window.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await window.mouse.down();
  await window.mouse.move(work!.x + 120, work!.y + 100, { steps: 8 }); // towards the top-left
  await window.mouse.up();

  await expect(tile()).toHaveAttribute('data-corner', 'top-left');
  expect(await window.evaluate(() => localStorage.getItem('interviewer-tile-corner'))).toBe('top-left');
});
