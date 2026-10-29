import { type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { closeApp, launchIntoRoom } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchIntoRoom());
});

test.afterEach(async () => {
  await closeApp(app);
});

const problem = () => window.getByRole('region', { name: 'Problem' });
const transcript = () => window.getByRole('log', { name: 'Transcript' });
const problemEdge = () => window.getByRole('separator', { name: 'Resize the problem' });
const transcriptEdge = () => window.getByRole('separator', { name: 'Resize the transcript' });
const width = async (locator: Locator) => (await locator.boundingBox())!.width;
const height = async (locator: Locator) => (await locator.boundingBox())!.height;

async function drag(edge: Locator, dx: number, dy: number) {
  const box = (await edge.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await window.mouse.move(x, y);
  await window.mouse.down();
  await window.mouse.move(x + dx, y + dy, { steps: 8 });
  await window.mouse.up();
}

test('dragging the edge between problem and editor resizes the problem; a double-click resets it', async () => {
  const before = await width(problem());
  await drag(problemEdge(), 120, 0);
  expect(await width(problem())).toBeCloseTo(before + 120, -1);

  await problemEdge().dblclick();
  expect(await width(problem())).toBeCloseTo(before, -1);
});

test('the problem can not be dragged so wide that the editor is unusable', async () => {
  await drag(problemEdge(), 5_000, 0);
  const editor = window.getByRole('region', { name: 'Editor' });
  expect(await width(editor)).toBeGreaterThanOrEqual(359);
});

test('dragging the edge above the transcript makes it taller', async () => {
  const before = await height(transcript());
  await drag(transcriptEdge(), 0, -100);
  expect(await height(transcript())).toBeCloseTo(before + 100, -1);
});

test('the edges also move with the arrow keys', async () => {
  const before = await width(problem());
  await problemEdge().focus();
  await window.keyboard.press('ArrowRight');
  expect(await width(problem())).toBeCloseTo(before + 16, 0);
});

test('panel sizes are remembered for the next round', async () => {
  await drag(problemEdge(), 100, 0);
  await drag(transcriptEdge(), 0, -60);
  const problemWidth = await width(problem());
  const transcriptHeight = await height(transcript());

  await window.getByRole('button', { name: 'End round' }).click();
  await window.getByRole('button', { name: 'Back to start' }).click();
  await window.getByRole('button', { name: 'Start coding round' }).click();

  await expect(problem()).toBeVisible();
  expect(await width(problem())).toBeCloseTo(problemWidth, 0);
  expect(await height(transcript())).toBeCloseTo(transcriptHeight, 0);
});
