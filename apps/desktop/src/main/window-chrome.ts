import {
  app,
  type BrowserWindow,
  type BrowserWindowConstructorOptions,
  Menu,
  type MenuItemConstructorOptions,
  nativeTheme,
} from 'electron';

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

// The canvas and ink of each theme (see tokens.css), for the parts of the window main draws itself.
// The scrim is what dims the page behind a dialog; the window buttons' strip is dimmed to match.
const themes = {
  light: { canvas: [244, 244, 242], ink: [26, 26, 25], scrim: { colour: [26, 26, 25], alpha: 0.32 } },
  dark: { canvas: [25, 25, 24], ink: [236, 236, 232], scrim: { colour: [0, 0, 0], alpha: 0.6 } },
} as const;

/** Whether the page is dimmed under a dialog right now (the renderer says, see setWindowDimmed). */
let dimmed = false;

function themeColours() {
  const theme = themes[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
  const { colour, alpha } = theme.scrim;
  const hex = (rgb: readonly number[]) =>
    '#' +
    rgb
      .map((value, i) => (dimmed ? value * (1 - alpha) + colour[i]! * alpha : value))
      .map((value) => Math.round(value).toString(16).padStart(2, '0'))
      .join('');
  return { canvas: hex(theme.canvas), ink: hex(theme.ink) };
}

/** Dims (or undims) the window buttons' strip along with the page, which the page can't reach. */
export function setWindowDimmed(window: BrowserWindow, dim: boolean) {
  dimmed = dim;
  followTheme(window);
}

/** The top bar's height in px; the room's bar matches it (--bar-height in tokens.css). */
const barHeight = 48;

/**
 * No system title bar: the app's own top bar is the window's top edge, and the native window buttons
 * sit over its right end (its left on macOS). The page keeps clear of them via env(titlebar-area-*).
 */
export function windowChromeOptions(): BrowserWindowConstructorOptions {
  const { canvas, ink } = themeColours();
  return {
    backgroundColor: canvas,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? true : { color: canvas, symbolColor: ink, height: barHeight },
    trafficLightPosition: { x: 16, y: (barHeight - 16) / 2 },
  };
}

/** Repaints what main draws (window background, the window buttons' strip) in the current theme. */
export function followTheme(window: BrowserWindow) {
  const { canvas, ink } = themeColours();
  window.setBackgroundColor(canvas);
  if (process.platform !== 'darwin') window.setTitleBarOverlay({ color: canvas, symbolColor: ink, height: barHeight });
}

const zoomStep = 0.5;

/** Hides the menu bar and handles zoom keys ourselves: Ctrl/Cmd + = (no Shift needed), -, 0. */
export function setUpWindowChrome(window: BrowserWindow) {
  window.setMenuBarVisibility(false);
  // The system theme can change while the app follows it.
  const onThemeUpdated = () => followTheme(window);
  nativeTheme.on('updated', onThemeUpdated);
  window.on('closed', () => nativeTheme.off('updated', onThemeUpdated));
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
