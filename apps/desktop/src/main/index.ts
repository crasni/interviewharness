import { join } from 'node:path';
import type { RoundKind } from '@interviewharness/core';
import { createLineBook } from '@interviewharness/engine';
import { app, BrowserWindow, ipcMain } from 'electron';
import linesFile from '../../../../content/interviewer/lines.md?raw';
import { channels, isCandidateSignal } from '../shared/api.ts';
import { type ActiveRound, runRound } from './active-round.ts';
import { createEventsLog } from './events-log.ts';
import { installAppMenu, setUpWindowChrome } from './window-chrome.ts';

const systemClock = { now: () => performance.now() };
// Tests point this at a throwaway folder; normally rounds live in the app's user data.
const dataDir = () => process.env.INTERVIEWHARNESS_DATA_DIR ?? app.getPath('userData');

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
    onDecision: (decision) => window?.webContents.send(channels.decision, decision),
  });
  return round.snapshot();
});

ipcMain.handle(channels.roundSnapshot, () => round?.snapshot() ?? null);

ipcMain.handle(channels.endRound, endCurrentRound);

ipcMain.on(channels.signal, (_event, signal: unknown) => {
  if (isCandidateSignal(signal)) round?.signal(signal);
});

// Automated UI tests set this so the window never appears on the developer's screen.
const hidden = process.env.INTERVIEWHARNESS_HIDDEN_WINDOW === '1';

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !hidden,
    backgroundColor: '#ffffff',
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
  app.quit();
});
