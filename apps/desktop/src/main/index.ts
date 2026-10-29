import { join } from 'node:path';
import type { RoundKind } from '@interviewharness/core';
import { type Round, startRound } from '@interviewharness/engine';
import { app, BrowserWindow, ipcMain } from 'electron';
import { channels } from '../shared/api.ts';

const systemClock = { now: () => performance.now() };
let round: Round | null = null;

// Only coding rounds exist so far; the start screen shows the others as disabled.
const availableKinds: readonly RoundKind[] = ['coding'];

ipcMain.handle(channels.startRound, (_event, kind: RoundKind) => {
  if (!availableKinds.includes(kind)) throw new Error(`Round kind not available yet: ${kind}`);
  round = startRound(kind, systemClock);
  return round.snapshot();
});

ipcMain.handle(channels.roundSnapshot, () => round?.snapshot() ?? null);

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());
