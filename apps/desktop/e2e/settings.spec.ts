import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

let app: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  ({ app, window } = await launchApp());
});

test.afterEach(async () => {
  await closeApp(app);
});

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const editor = () => window.getByRole('textbox', { name: 'Code editor' });
const body = () => window.locator('body');

async function openSettings() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await expect(settings()).toBeVisible();
}

/** Shows one category of Settings: Appearance, Interview or Editor. */
async function showCategory(name: string) {
  await settings().getByRole('tab', { name }).click();
}

async function startRound() {
  await window.getByRole('button', { name: 'Start coding round' }).click();
  await expect(editor()).toBeVisible();
}

test('settings are sorted into Appearance, Interview and Editor', async () => {
  await openSettings();
  await expect(settings().getByRole('tab')).toHaveText(['Appearance', 'Interview', 'Editor']);
  await expect(settings().getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
  await expect(settings().getByRole('tabpanel')).toContainText('Text size');
  await showCategory('Editor');
  await expect(settings().getByRole('tabpanel')).toContainText('Code language');
  await expect(settings().getByRole('tabpanel')).not.toContainText('Text size');
});

test('settings open from the start screen and the room, by button or shortcut, and close with Escape', async () => {
  await openSettings();
  await window.keyboard.press('Escape');
  await expect(settings()).toBeHidden();

  await startRound();
  await window.keyboard.press('Control+,');
  await expect(settings()).toBeVisible();
  await settings().getByRole('button', { name: 'Close' }).click();
  await expect(settings()).toBeHidden();
  await openSettings();
});

test('text size scales the type, and is remembered', async () => {
  await expect(body()).toHaveCSS('font-size', '14px');
  await openSettings();
  await settings().getByText('Large', { exact: true }).click();
  await expect(body()).toHaveCSS('font-size', '16.1px');

  await window.reload();
  await expect(body()).toHaveCSS('font-size', '16.1px');
});

test('theme overrides the system setting', async () => {
  await openSettings();
  // A switch that is on carries a colour transition; it must end on the new theme's ink, not the old one.
  const onSwitch = () => settings().getByRole('switch', { name: 'Autocomplete' });
  await settings().getByText('Dark', { exact: true }).click();
  await expect(body()).toHaveCSS('background-color', 'rgb(25, 25, 24)');
  await showCategory('Editor');
  await expect(onSwitch()).toHaveCSS('background-color', 'rgb(236, 236, 232)');
  await showCategory('Appearance');
  await settings().getByText('Light', { exact: true }).click();
  await expect(body()).toHaveCSS('background-color', 'rgb(244, 244, 242)');
  await showCategory('Editor');
  await expect(onSwitch()).toHaveCSS('background-color', 'rgb(26, 26, 25)');
});

test('click to talk is the only way to talk until the mic arrives', async () => {
  await openSettings();
  await showCategory('Interview');
  await expect(settings().getByRole('radio', { name: 'Click to talk' })).toBeChecked();
  await expect(settings().getByRole('radio', { name: 'Speech detection' })).toBeDisabled();
});

test('with the transcript off by default, a round opens with only the current line', async () => {
  await openSettings();
  await showCategory('Interview');
  await settings().getByRole('switch', { name: 'Show the transcript when a round starts' }).uncheck();
  await window.keyboard.press('Escape');
  await startRound();
  await expect(window.getByRole('button', { name: 'Show transcript' })).toBeVisible();
  await expect(window.getByRole('log', { name: 'Transcript' })).toHaveCount(0);
});

test('the code language changes indentation live, and the code stays', async () => {
  await startRound();
  await editor().click();
  await window.keyboard.type('def f():');
  await window.keyboard.press('Enter');
  await window.keyboard.type('x');
  await expect(editor().locator('.cm-line').nth(1)).toHaveText('    x');

  await openSettings();
  await showCategory('Editor');
  await settings().getByLabel('Code language').selectOption('JavaScript');
  await window.keyboard.press('Escape');
  await expect(editor()).toContainText('def f():');

  await editor().click();
  await window.keyboard.press('Control+End');
  await window.keyboard.press('Enter');
  await window.keyboard.type('function g() {');
  await window.keyboard.press('Enter');
  await window.keyboard.type('y');
  await expect(editor().locator('.cm-line').last()).toHaveText('  y');
});

test('syntax highlighting can be turned off', async () => {
  await startRound();
  await editor().click();
  await window.keyboard.type('def f():');
  await expect(editor().locator('.cm-line span')).not.toHaveCount(0);

  await openSettings();
  await showCategory('Editor');
  await settings().getByRole('switch', { name: 'Syntax highlighting' }).uncheck();
  await expect(editor().locator('.cm-line span')).toHaveCount(0);
});

test('autocomplete offers names already in the code, once each, and can be turned off', async () => {
  await startRound();
  const popup = window.locator('.cm-tooltip-autocomplete');
  await editor().click();
  await window.keyboard.type('seen_values = {}');
  await window.keyboard.press('Enter');
  await window.keyboard.type('see');
  await expect(popup.getByRole('option', { name: 'seen_values' })).toHaveCount(1);
  await window.keyboard.press('Escape');

  await openSettings();
  await showCategory('Editor');
  await settings().getByRole('switch', { name: 'Autocomplete' }).uncheck();
  await window.keyboard.press('Escape');
  await editor().click();
  await window.keyboard.press('Control+End');
  await window.keyboard.press('Enter');
  await window.keyboard.type('see');
  await window.waitForTimeout(500); // the popup would have opened by now
  await expect(popup).toHaveCount(0);
});
