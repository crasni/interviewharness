import { cpSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

/** Files Chromium holds while its app runs; a copy would claim a lock nobody holds. */
const notCopied = /^(Singleton(Lock|Cookie|Socket)|lockfile|Crashpad)$/;

/**
 * v0.0 kept its data in a folder named after the npm package. Copies that folder's contents (rounds
 * and browser storage) into the new one, once: only while the new folder has no settings.json yet, which
 * the app writes on its first launch. Must run before any window opens, so browser storage isn't in use.
 * The old folder is left in place. Returns whether anything was copied.
 */
export function carryOverOldDataFolder(from: string, to: string): boolean {
  if (!existsSync(from) || existsSync(join(to, 'settings.json'))) return false;
  cpSync(from, to, {
    recursive: true,
    // Electron has already made the new folder with a few files of its own; those stay.
    force: false,
    filter: (source) => !notCopied.test(basename(source)),
  });
  return true;
}
