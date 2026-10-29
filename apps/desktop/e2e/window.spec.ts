import { type ElectronApplication, expect, test } from '@playwright/test';
import { launchApp } from './launch.ts';

let app: ElectronApplication;

test.beforeEach(async () => {
  ({ app } = await launchApp());
});

test.afterEach(async () => {
  await app.close();
});

test('there is no File / Edit / View menu bar', async () => {
  const menuBarVisible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMenuBarVisible());
  expect(menuBarVisible).toBe(false);
});

test('Ctrl+= zooms in without Shift, Ctrl+- zooms out, Ctrl+0 resets', async () => {
  const zoom = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomLevel());
  // Sent the way the OS delivers keys, so it passes through the window's own key handling.
  const press = (keyCode: string) =>
    app.evaluate(({ BrowserWindow }, keyCode) => {
      const contents = BrowserWindow.getAllWindows()[0]!.webContents;
      contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers: ['control'] });
      contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers: ['control'] });
    }, keyCode);

  await press('=');
  await expect.poll(zoom).toBeGreaterThan(0);
  await press('-');
  await press('-');
  await expect.poll(zoom).toBeLessThan(0);
  await press('0');
  await expect.poll(zoom).toBe(0);
});
