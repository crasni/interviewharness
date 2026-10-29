import { app, type BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';

/**
 * Our own application menu, never shown as a bar. It keeps the shortcuts people expect
 * (copy/paste, quit, close) and, in development, reload and dev tools.
 */
export function installAppMenu() {
  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === 'darwin') template.push({ role: 'appMenu' });
  template.push({ role: 'editMenu' }, { role: 'windowMenu' });
  if (!app.isPackaged) template.push({ label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const zoomStep = 0.5;

/** Hides the menu bar and handles zoom keys ourselves: Ctrl/Cmd + = (no Shift needed), -, 0. */
export function setUpWindowChrome(window: BrowserWindow) {
  window.setMenuBarVisibility(false);
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    const contents = window.webContents;
    if (input.key === '=' || input.key === '+') contents.setZoomLevel(contents.getZoomLevel() + zoomStep);
    else if (input.key === '-' || input.key === '_') contents.setZoomLevel(contents.getZoomLevel() - zoomStep);
    else if (input.key === '0' && !input.shift) contents.setZoomLevel(0);
    else return;
    event.preventDefault();
  });
}
