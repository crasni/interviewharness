import { open, rename, rm } from 'node:fs/promises';

export interface WriteOptions {
  /** File permissions; 0o600 keeps a file readable by its owner only (ignored on Windows, where the data folder is per user). */
  mode?: number;
  /** Tests stand in a rename that fails the way Windows does when another program holds the file. */
  rename?: (from: string, to: string) => Promise<void>;
  /** The wait before the first retry; it doubles with each one. */
  retryDelayMs?: number;
}

/** Errors Windows gives while an antivirus or indexer briefly holds the file. They pass, so they're worth retrying. */
const lockedCodes = new Set(['EPERM', 'EBUSY', 'EACCES']);
// Seven attempts wait about 3 s in all (50 ms doubling): long enough for a scan of a new file, short enough not to hold up a quit.
const renameAttempts = 7;

/** Writes to a temporary file, flushes it to disk, then renames it over the real one, so a crash never leaves half a file. */
export async function writeFileAtomically(
  path: string,
  text: string,
  { mode = 0o644, rename: renameFile = rename, retryDelayMs = 50 }: WriteOptions = {},
) {
  const temp = `${path}.${process.pid}.tmp`;
  const handle = await open(temp, 'w', mode);
  try {
    await handle.chmod(mode); // a temporary file left by a crash keeps its old mode otherwise
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
