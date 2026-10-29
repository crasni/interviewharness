import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carryOverOldDataFolder } from './data-folder.ts';

function folders() {
  const root = mkdtempSync(join(tmpdir(), 'interviewharness-folders-'));
  const from = join(root, '@interviewharness', 'desktop');
  const to = join(root, 'InterviewHarness');
  // Electron makes the new folder itself before the app's code runs, with a few files of its own.
  put(to, 'Local State', '{}');
  return { from, to };
}

function put(dir: string, file: string, text: string) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

describe('carrying over the v0.0 data folder', () => {
  it("copies the old folder's rounds and browser storage, and leaves the old folder in place", () => {
    const { from, to } = folders();
    put(from, 'rounds/2026-10-01T10-00-00-000Z/events.jsonl', '{"at":0}\n');
    put(from, 'Local Storage/leveldb/000003.log', 'settings');
    put(from, 'SingletonLock', 'held by a running app');

    expect(carryOverOldDataFolder(from, to)).toBe(true);

    expect(readFileSync(join(to, 'rounds/2026-10-01T10-00-00-000Z/events.jsonl'), 'utf8')).toBe('{"at":0}\n');
    expect(readFileSync(join(to, 'Local Storage/leveldb/000003.log'), 'utf8')).toBe('settings');
    expect(existsSync(join(to, 'SingletonLock'))).toBe(false); // a lock belongs to the app that made it
    expect(existsSync(join(from, 'rounds'))).toBe(true);
  });

  it('copies nothing once the new folder is in use, so a second launch never overwrites newer data', () => {
    const { from, to } = folders();
    put(from, 'rounds/old/events.jsonl', 'old');
    put(to, 'settings.json', '{"version":1}');

    expect(carryOverOldDataFolder(from, to)).toBe(false);
    expect(existsSync(join(to, 'rounds'))).toBe(false);
  });

  it('copies nothing on a new install, where there is no old folder', () => {
    const { from, to } = folders();

    expect(carryOverOldDataFolder(from, to)).toBe(false);
  });
});
