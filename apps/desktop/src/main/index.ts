import { join } from 'node:path';
import type { RoundKind } from '@interviewharness/core';
import { createLineBook, type Model } from '@interviewharness/engine';
import { scriptedModel } from '@interviewharness/engine/test';
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import linesFile from '../../../../content/interviewer/lines.md?raw';
import { channels, isCandidateSignal, isTheme } from '../shared/api.ts';
import { type ActiveRound, runRound } from './active-round.ts';
import { carryOverOldDataFolder } from './data-folder.ts';
import { createEventsLog } from './events-log.ts';
import { loadProblems } from './problems.ts';
import { openSettingsFile } from './settings-file.ts';
import { installAppMenu, setUpWindowChrome, windowChromeOptions } from './window-chrome.ts';

const systemClock = { now: () => performance.now() };
// Tests point this at a throwaway folder; normally rounds live in the app's user data.
const dataDir = () => process.env.INTERVIEWHARNESS_DATA_DIR ?? app.getPath('userData');
// With a throwaway folder, keep everything there (browser storage too), so tests never touch the real profile.
if (process.env.INTERVIEWHARNESS_DATA_DIR) app.setPath('userData', process.env.INTERVIEWHARNESS_DATA_DIR);
// v0.0's data folder was named after the npm package; the app's name (productName) now names it.
else carryOverOldDataFolder(join(app.getPath('appData'), '@interviewharness', 'desktop'), dataDir());

const settings = openSettingsFile(dataDir());

// End-to-end tests set this to a script of replies (see the engine's scriptedModel), so they run with no
// network or keys. Never in a packaged app. Real providers arrive with the model setup; until then, with
// no model, the interviewer says the example lines as written.
const model: Model | null = app.isPackaged ? null : fakeModel(process.env.INTERVIEWHARNESS_FAKE_MODEL);

function fakeModel(script: string | undefined) {
  if (!script) return null;
  try {
    return scriptedModel(JSON.parse(script)).model;
  } catch (error) {
    throw new Error(`INTERVIEWHARNESS_FAKE_MODEL is not a JSON script of replies: ${String(error)}`, { cause: error });
  }
}

// Only Two sum so far (v0.1b adds more); every folder is read and checked at startup all the same.
const problem = loadProblems().get('two-sum')!;

let window: BrowserWindow | null = null;
let round: ActiveRound | null = null;

// Only coding rounds exist so far; the start screen shows the others as disabled.
const availableKinds: readonly RoundKind[] = ['coding'];

/** Stops the round in progress, if any, and returns how it ended. */
function endCurrentRound() {
  const ended = round?.snapshot() ?? null;
  round?.stop();
  round = null;
  return ended;
}

ipcMain.handle(channels.startRound, (_event, kind: RoundKind) => {
  if (!availableKinds.includes(kind)) throw new Error(`Round kind not available yet: ${kind}`);
  endCurrentRound();
  round = runRound({
    kind,
    clock: systemClock,
    lines: createLineBook(linesFile),
    log: createEventsLog(dataDir(), new Date()),
    model,
    problem,
    toneGuide: linesFile,
    onEvent: (event) => window?.webContents.send(channels.decision, event),
  });
  return round.snapshot();
});

ipcMain.handle(channels.roundSnapshot, () => round?.snapshot() ?? null);

ipcMain.handle(channels.endRound, endCurrentRound);

ipcMain.on(channels.signal, (_event, signal: unknown) => {
  if (isCandidateSignal(signal)) round?.signal(signal);
});

ipcMain.handle(channels.setTheme, (_event, theme: unknown) => {
  if (isTheme(theme)) {
    nativeTheme.themeSource = theme; // 'updated' fires, and setUpWindowChrome repaints the window
  }
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle(channels.getSettings, () => ({ values: settings.values(), fresh: settings.fresh }));

ipcMain.on(channels.changeSettings, (event, changes: unknown) => {
  const values = settings.change(changes); // validated there: the renderer is not trusted
  // The window that made the change already shows it; any other is told.
  for (const other of BrowserWindow.getAllWindows()) {
    if (other.webContents !== event.sender) other.webContents.send(channels.settingsChanged, values);
  }
});

// Automated UI tests set this so the window never appears on the developer's screen.
const hidden = process.env.INTERVIEWHARNESS_HIDDEN_WINDOW === '1';

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !hidden,
    ...windowChromeOptions(),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      // A hidden window is throttled like a background tab; keep its timers running.
      backgroundThrottling: !hidden,
    },
  });
  setUpWindowChrome(window);

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

// Chromium's internal logs (e.g. "Frame latency is negative" from its compositor on Linux) are noise
// in development; only fatal ones get through. Our own logs and JavaScript errors are unaffected.
if (!app.isPackaged) app.commandLine.appendSwitch('log-level', '3');

void app.whenReady().then(() => {
  installAppMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  endCurrentRound();
  // The last change may still be on its way to disk.
  void settings.flush().finally(() => app.quit());
});
