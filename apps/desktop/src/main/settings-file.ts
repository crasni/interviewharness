import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSettings, type Settings, validSettings } from '../shared/settings.ts';

/** The shape settings.json is written in. Bump it, and add a migration below, when a setting changes meaning. */
export const settingsVersion = 1;

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Each migration takes a file of its key's version to the next version. None yet: version 1 is the first. */
const settingsMigrations: Record<number, Migration> = {};

/**
 * Brings a settings object up to `toVersion`, one version at a time. A file with no version is taken
 * as version 1; one from a newer app is left as it is, and only the settings this app knows are read from it.
 */
export function migrateSettings(
  raw: Record<string, unknown>,
  migrations: Record<number, Migration> = settingsMigrations,
  toVersion = settingsVersion,
): Record<string, unknown> {
  let current = raw;
  let version = typeof raw.version === 'number' ? raw.version : 1;
  while (version < toVersion) {
    const migrate = migrations[version];
    if (migrate) current = migrate(current);
    version += 1;
    current = { ...current, version };
  }
  return current;
}

/**
 * The candidate's settings, kept in settings.json in the data folder. Main owns the file:
 * the renderer only reads and changes it over IPC.
 */
export function openSettingsFile(dir: string, { rename: renameFile = rename, retryDelayMs = 50 }: WriteOptions = {}) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'settings.json');
  const fresh = !existsSync(path);
  const loaded = fresh ? null : load(path);
  let values: Settings = loaded ?? defaultSettings;

  // Writes go one at a time, each with the latest values; changes made while one is going wait for the next.
  let writing: Promise<void> = Promise.resolve();
  let pending = false;
  function save() {
    if (pending) return;
    pending = true;
    writing = writing.then(async () => {
      pending = false;
      const text = `${JSON.stringify({ version: settingsVersion, ...values }, null, 2)}\n`;
      try {
        await writeAtomically(path, text, renameFile, retryDelayMs);
      } catch (error) {
        // The settings still apply for this run; the next change tries again.
        console.error('Could not save settings.json:', error);
      }
    });
  }

  if (!fresh && !loaded) backUp(path);
  if (!loaded) save();

  return {
    /** Whether there was no settings file when the app started. */
    fresh,
    values: () => values,
    /** Applies the valid part of `changes`, saves, and returns the settings now in force. */
    change(changes: unknown): Settings {
      values = { ...values, ...validSettings(changes) };
      save();
      return values;
    },
    /** Resolves once every change so far is on disk. */
    flush: () => writing,
  };
}

export type SettingsFile = ReturnType<typeof openSettingsFile>;

interface WriteOptions {
  /** Tests stand in a rename that fails the way Windows does when another program holds the file. */
  rename?: (from: string, to: string) => Promise<void>;
  /** The wait before the first retry; it doubles with each one. */
  retryDelayMs?: number;
}

/** Errors Windows gives while an antivirus or indexer briefly holds the file. They pass, so they're worth retrying. */
const lockedCodes = new Set(['EPERM', 'EBUSY', 'EACCES']);
const renameAttempts = 5;

/** The settings the file holds, or null if it can't be read or isn't a settings object at all. */
function load(path: string): Settings | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return { ...defaultSettings, ...validSettings(migrateSettings(raw as Record<string, unknown>)) };
}

/** Moves a bad settings file aside, so the candidate (or a bug report) still has it. */
function backUp(path: string) {
  try {
    renameSync(path, `${path}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  } catch {
    // Can't move it (locked, or gone): the defaults are written over it, which is still better than not starting.
  }
}

/** Writes to a temporary file, flushes it to disk, then renames it over the real one, so a crash never leaves half a file. */
async function writeAtomically(
  path: string,
  text: string,
  renameFile: NonNullable<WriteOptions['rename']>,
  retryDelayMs: number,
) {
  const temp = `${path}.${process.pid}.tmp`;
  const handle = await open(temp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  for (let attempt = 1; ; attempt++) {
    try {
      await renameFile(temp, path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!lockedCodes.has(code) || attempt === renameAttempts) {
        await rm(temp, { force: true });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** (attempt - 1)));
    }
  }
}
