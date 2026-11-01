import { join } from 'node:path';
import type { RoundKind } from '@interviewharness/core';
import {
  createLineBook,
  difficulties,
  gradeRound,
  type GradingEntry,
  modelErrorKind,
  type Problem,
  type RoundLog,
  type RoundRecord,
} from '@interviewharness/engine';
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import linesFile from '../../../../content/interviewer/lines.md?raw';
// The app icon from brand/ (png/app-icon-512.png); `?asset` gives its path in the build.
import icon from '../../resources/icon.png?asset';
import { channels, type FeedbackResult, type ProblemChoice, isCandidateSignal, isCodeSnapshot, isTheme } from '../shared/api.ts';
import { type ActiveRound, runRound } from './active-round.ts';
import { writeFileAtomically } from './atomic-write.ts';
import { carryOverOldDataFolder } from './data-folder.ts';
import { createEventsLog } from './events-log.ts';
import { keyPageFor } from './key-pages.ts';
import { setUpModels } from './model-setup.ts';
import { roundsByProblem } from './problem-history.ts';
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

/** Changes settings from main, and tells every window. */
function changeSettings(changes: Parameters<typeof settings.change>[0]) {
  const values = settings.change(changes);
  for (const each of BrowserWindow.getAllWindows()) each.webContents.send(channels.settingsChanged, values);
  return values;
}

// Every folder is read and checked at startup, so a broken problem stops the app rather than a round.
const problems = loadProblems();

/** The problem named, or one picked at random from all of them when none is. */
function pickProblem(name: unknown) {
  if (name === undefined) return [...problems.values()][Math.floor(Math.random() * problems.size)]!;
  const problem = typeof name === 'string' ? problems.get(name) : undefined;
  if (!problem) throw new Error(`No such problem: ${String(name)}`);
  return problem;
}

let window: BrowserWindow | null = null;
/** A round's folder: its events.jsonl, and later its feedback.json. */
type RoundFolder = { dir: string; log: RoundLog; problem: Problem };

let round: (ActiveRound & RoundFolder) | null = null;
// The round that ended last, and its Feedback as it's being written.
let ended: (RoundFolder & { record: RoundRecord; feedback: Promise<FeedbackResult> }) | null = null;

const models = setUpModels({ dataDir: dataDir(), settings: { values: settings.values, change: changeSettings }, window: () => window });

// Only coding rounds exist so far; the start screen shows the others as disabled.
const availableKinds: readonly RoundKind[] = ['coding'];

/** Stops the round in progress, if any, and returns it as it ended. Nothing is graded: see End round. */
function endCurrentRound(code?: unknown) {
  if (!round) return null;
  const stopped = round;
  round = null;
  stopped.stop(isCodeSnapshot(code) ? code : undefined);
  return stopped;
}

/**
 * Grades a round and saves the Feedback, whole (scores included, no credentials), as feedback.json in its
 * folder. The renderer gets the words only. Never rejects: a failure comes back as one, for Try again.
 */
async function writeFeedback(record: RoundRecord, { dir, log, problem }: RoundFolder): Promise<FeedbackResult> {
  // A round where the candidate said nothing has nothing to grade, however long it ran.
  if (!record.transcript.some((line) => line.who === 'candidate')) return { ok: false, error: 'nothing-said' };
  const grader = await models.feedbackModel();
  if (!grader) return { ok: false, error: 'no-model' };
  const startedAt = systemClock.now();
  // How the verdict was reached (or why it wasn't) goes in the round's log, so it can be replayed and checked.
  const logGrading = (grading: Omit<GradingEntry['grading'], 'model' | 'ms'>) =>
    log.write({ at: systemClock.now(), grading: { model: grader.model.identity, ms: systemClock.now() - startedAt, ...grading } });
  try {
    const feedback = await gradeRound({ model: grader.model, problem, record, rough: grader.rough });
    logGrading({ outcome: 'written', verdict: feedback.verdict, samples: feedback.samples });
    await writeFileAtomically(join(dir, 'feedback.json'), `${JSON.stringify(feedback, null, 2)}\n`);
    const { verdict, why, wentWell, toFix, rough } = feedback;
    return { ok: true, verdict, why, wentWell, toFix, rough };
  } catch (error) {
    logGrading({ outcome: 'failed', error: modelErrorKind(error) });
    console.error('Could not write the Feedback:', error);
    return { ok: false, error: modelErrorKind(error) };
  }
}

ipcMain.handle(channels.startRound, (_event, kind: RoundKind, name: unknown) => {
  if (!availableKinds.includes(kind)) throw new Error(`Round kind not available yet: ${kind}`);
  const problem = pickProblem(name);
  endCurrentRound();
  const model = models.interviewerModel();
  const log = createEventsLog(dataDir(), new Date());
  log.write({ at: systemClock.now(), started: { kind, problem: problem.name } });
  const running = runRound({
    kind,
    clock: systemClock,
    lines: createLineBook(linesFile),
    log,
    model,
    problem,
    toneGuide: linesFile,
    onEvent: (event) => window?.webContents.send(channels.decision, event),
  });
  round = { ...running, dir: log.dir, log };
  return round.snapshot();
});

ipcMain.handle(channels.roundSnapshot, () => round?.snapshot() ?? null);

ipcMain.handle(channels.problems, (): ProblemChoice[] => {
  const done = roundsByProblem(dataDir());
  return [...problems.values()]
    .map(({ name, details: { title, difficulty } }) => ({ name, title, difficulty, timesDone: done.get(name) ?? 0 }))
    .sort((a, b) => difficulties.indexOf(a.difficulty) - difficulties.indexOf(b.difficulty) || a.title.localeCompare(b.title));
});

// The candidate ended the round: its Feedback starts being written at once.
ipcMain.handle(channels.endRound, (_event, code: unknown) => {
  const stopped = endCurrentRound(code);
  if (!stopped) return null;
  const record = stopped.record();
  ended = { record, dir: stopped.dir, log: stopped.log, problem: stopped.problem, feedback: writeFeedback(record, stopped) };
  return stopped.snapshot();
});

ipcMain.handle(channels.feedbackResult, (): Promise<FeedbackResult> => ended?.feedback ?? Promise.resolve({ ok: false, error: 'no-round' }));

ipcMain.handle(channels.feedbackRetry, (): Promise<FeedbackResult> => {
  if (!ended) return Promise.resolve({ ok: false, error: 'no-round' });
  ended.feedback = writeFeedback(ended.record, ended);
  return ended.feedback;
});

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

ipcMain.handle(channels.continueWithChatGPT, () => models.continueWithChatGPT());

ipcMain.on(channels.cancelLogin, () => models.cancelLogin());

ipcMain.handle(channels.providers, () => models.providers());

ipcMain.handle(channels.listModels, (_event, provider: unknown, connection: unknown) => models.list(provider, connection));

ipcMain.handle(channels.connect, (_event, connection: unknown) => models.connect(connection));
ipcMain.handle(channels.replaceKey, (_event, replacement: unknown) => models.replaceKey(replacement));

ipcMain.handle(channels.logout, (_event, provider: unknown, server: unknown) => models.logout(provider, server));
ipcMain.handle(channels.removeModel, (_event, model: unknown) => models.removeModel(model));
ipcMain.handle(channels.listServer, (_event, listing: unknown) => models.listServer(listing));
ipcMain.handle(channels.addServer, (_event, setup: unknown) => models.addServer(setup));
ipcMain.handle(channels.editServer, (_event, setup: unknown) => models.editServer(setup));

ipcMain.handle(channels.signInToOpenRouter, () => models.signInToOpenRouter());

// "Get a key": the renderer names a provider; only that provider's key page, from the table, is opened.
ipcMain.on(channels.openKeyPage, (_event, provider: unknown) => {
  const page = keyPageFor(provider);
  if (page) void shell.openExternal(page);
});

// Automated UI tests set this so the window never appears on the developer's screen.
const hidden = process.env.INTERVIEWHARNESS_HIDDEN_WINDOW === '1';

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: !hidden,
    icon,
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
  // Windows and Linux take the icon from the window; a packaged Mac app takes it from its bundle.
  if (!app.isPackaged) app.dock?.setIcon(icon);
  installAppMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  endCurrentRound();
  // The last change may still be on its way to disk.
  void settings.flush().finally(() => app.quit());
});
