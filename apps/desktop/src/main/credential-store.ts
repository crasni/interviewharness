import { randomUUID } from 'node:crypto';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Credential, CredentialInfo, CredentialStore } from '@interviewharness/providers';
import { writeFileAtomically } from './atomic-write.ts';

/** The OS's encryption (Electron's safeStorage in the app; a fake in tests). Only usable once the app is ready. */
export interface Encryption {
  /** The Linux keyring in use; 'basic_text' means there is none, and "encrypted" data is effectively plain text. */
  backend(): string;
  encrypt(text: string): Promise<Buffer>;
  decrypt(data: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

/** credentials.json: each login encrypted by the OS, plus this installation's id (not a secret). */
interface CredentialsFile {
  version: 1;
  installId?: string;
  entries: Record<string, { type: Credential['type']; data: string }>;
}

/** A locked keyring says so in its error; it passes, so it's worth retrying (and never a reason to delete). */
const temporarilyUnavailable = /temporarily unavailable/i;
const decryptAttempts = 4;

/**
 * Where logins and keys are kept: credentials.json in the data folder, each one encrypted by the OS,
 * written atomically and readable only by its owner. Main only: nothing here reaches the renderer or a log.
 */
export function openCredentialStore(dir: string, encryption: Encryption, { retryDelayMs = 250 } = {}) {
  const path = join(dir, 'credentials.json');
  // Every read and change goes through this queue, so changes never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };

  async function load(): Promise<CredentialsFile> {
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: {} };
      throw error;
    }
    try {
      const file = JSON.parse(text) as CredentialsFile;
      if (typeof file.entries === 'object' && file.entries !== null) return file;
    } catch {
      // Falls through: kept aside below, never deleted.
    }
    // Kept aside once, then replaced by an empty file, so the next read doesn't copy it again.
    await copyFile(path, `${path}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const empty: CredentialsFile = { version: 1, entries: {} };
    await save(empty);
    return empty;
  }

  const save = (file: CredentialsFile) => writeFileAtomically(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });

  async function decrypt(data: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await encryption.decrypt(Buffer.from(data, 'base64'));
      } catch (error) {
        if (!temporarilyUnavailable.test(String(error)) || attempt === decryptAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  async function seal(credential: Credential) {
    return { type: credential.type, data: (await encryption.encrypt(JSON.stringify(credential))).toString('base64') };
  }

  async function readEntry(file: CredentialsFile, providerId: string): Promise<Credential | undefined> {
    const entry = file.entries[providerId];
    if (!entry) return undefined;
    const { result, shouldReEncrypt } = await decrypt(entry.data);
    const credential = JSON.parse(result) as Credential;
    if (shouldReEncrypt) {
      file.entries[providerId] = await seal(credential);
      await save(file);
    }
    return credential;
  }

  const store: CredentialStore = {
    read: (providerId) => inTurn(async () => readEntry(await load(), providerId)),

    list: () =>
      inTurn(async () =>
        Object.entries((await load()).entries).map(([providerId, { type }]): CredentialInfo => ({ providerId, type })),
      ),

    modify: (providerId, fn) =>
      inTurn(async () => {
        const file = await load();
        // One that can't be decrypted (the keyring changed) is passed on as none, so a new login can take its
        // place. It is only ever replaced by a new login, never deleted for failing.
        const current = await readEntry(file, providerId).catch(() => undefined);
        const next = await fn(current);
        if (next === undefined) return current;
        file.entries[providerId] = await seal(next);
        await save(file);
        return next;
      }),

    delete: (providerId) =>
      inTurn(async () => {
        const file = await load();
        delete file.entries[providerId];
        await save(file);
      }),
  };

  return {
    ...store,

    /** A stable id for this installation, made on first use. OpenAI's sign-in asks for one. */
    installId: () =>
      inTurn(async () => {
        const file = await load();
        if (!file.installId) {
          file.installId = randomUUID();
          await save(file);
        }
        return file.installId;
      }),

    /** Whether the OS really encrypts logins. False on Linux with no keyring: they're saved anyway, owner-only. */
    encrypted: () => encryption.backend() !== 'basic_text',
  };
}

export type AppCredentialStore = ReturnType<typeof openCredentialStore>;
