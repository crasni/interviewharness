import { type ElectronApplication, expect, test } from '@playwright/test';
import { closeApp, launchApp } from './launch.ts';

let app: ElectronApplication;

test.beforeEach(async () => {
  ({ app } = await launchApp());
});

test.afterEach(async () => {
  await closeApp(app);
});

test('there is no File / Edit / View menu bar', async () => {
  const { menuBarVisible, menus } = await app.evaluate(({ BrowserWindow, Menu }) => ({
    menuBarVisible: BrowserWindow.getAllWindows()[0]!.isMenuBarVisible(),
    menus: Menu.getApplicationMenu()?.items.map((item) => item.role ?? item.label) ?? [],
  }));
  if (process.platform === 'darwin') {
    // A Mac always shows its menu bar at the top of the screen; there it holds only the app's own, Edit and Window.
    expect(menus.map((m) => m.toLowerCase())).toEqual(['appmenu', 'editmenu', 'windowmenu']);
  } else {
    expect(menuBarVisible).toBe(false);
  }
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
