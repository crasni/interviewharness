import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Encryption, openCredentialStore } from './credential-store.ts';

const tempDir = () => mkdtempSync(join(tmpdir(), 'interviewharness-credentials-'));
const fileText = (dir: string) => readFileSync(join(dir, 'credentials.json'), 'utf8');

/** Stands in for the OS's encryption: reversible, and visibly not the plain text. */
function fakeEncryption(overrides: Partial<Encryption> = {}): Encryption {
  return {
    backend: () => 'gnome_libsecret',
    encrypt: async (text) => Buffer.from(`sealed:${[...text].reverse().join('')}`),
    decrypt: async (data) => ({ result: [...data.toString().slice('sealed:'.length)].reverse().join(''), shouldReEncrypt: false }),
    ...overrides,
  };
}

const login = { type: 'oauth' as const, access: 'secret-access-token', refresh: 'secret-refresh-token', expires: 1, clientId: 'oaiapp_1' };

describe('the credential store', () => {
  it('keeps a login encrypted on disk, readable only by its owner, and reads it back after a restart', async () => {
    const dir = tempDir();
    await openCredentialStore(dir, fakeEncryption()).modify('openai', async () => login);

    const reopened = openCredentialStore(dir, fakeEncryption());

    expect(await reopened.read('openai')).toEqual(login);
    expect(await reopened.list()).toEqual([{ providerId: 'openai', type: 'oauth' }]);
    expect(fileText(dir)).not.toContain('secret-access-token');
    expect(fileText(dir)).not.toContain('secret-refresh-token');
    if (process.platform !== 'win32') expect(statSync(join(dir, 'credentials.json')).mode & 0o777).toBe(0o600);
  });

  it('gives the current login to each change, one change at a time', async () => {
    const store = openCredentialStore(tempDir(), fakeEncryption());
    await store.modify('openai', async () => login);

    await Promise.all([
      store.modify('openai', async (current) => ({ ...login, expires: (current as typeof login).expires + 1 })),
      store.modify('openai', async (current) => ({ ...login, expires: (current as typeof login).expires + 1 })),
    ]);

    expect(await store.read('openai')).toMatchObject({ expires: 3 });
  });

  it('forgets a login on logout', async () => {
    const dir = tempDir();
    const store = openCredentialStore(dir, fakeEncryption());
    await store.modify('openai', async () => login);

    await store.delete('openai');

    expect(await openCredentialStore(dir, fakeEncryption()).read('openai')).toBeUndefined();
  });

  it('retries while the keyring is temporarily unavailable', async () => {
    const dir = tempDir();
    await openCredentialStore(dir, fakeEncryption()).modify('openai', async () => login);
    let locked = 2;
    const working = fakeEncryption();
    const flaky = fakeEncryption({
      decrypt: async (data) => {
        if (locked-- > 0) throw new Error('Decryption is temporarily unavailable. Please try again.');
        return working.decrypt(data);
      },
    });

    expect(await openCredentialStore(dir, flaky, { retryDelayMs: 1 }).read('openai')).toEqual(login);
  });

  it('never wipes a login it cannot decrypt', async () => {
    const dir = tempDir();
    await openCredentialStore(dir, fakeEncryption()).modify('openai', async () => login);
    const before = fileText(dir);
    const broken = fakeEncryption({
      decrypt: async () => {
        throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.');
      },
    });

    await expect(openCredentialStore(dir, broken, { retryDelayMs: 1 }).read('openai')).rejects.toThrow();
    expect(fileText(dir)).toBe(before);
  });

  it("lets a new login replace one it can't decrypt, so the candidate is never stuck", async () => {
    const dir = tempDir();
    await openCredentialStore(dir, fakeEncryption()).modify('openai', async () => login);
    const working = fakeEncryption();
    const keyringChanged = fakeEncryption({
      decrypt: async () => {
        throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.');
      },
    });
    const fresh = { ...login, access: 'fresh-access-token' };

    await openCredentialStore(dir, keyringChanged, { retryDelayMs: 1 }).modify('openai', async () => fresh);

    expect(await openCredentialStore(dir, working).read('openai')).toEqual(fresh);
  });

  it('keeps one copy of a corrupt file, and starts again', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'credentials.json'), '{ not json');
    const store = openCredentialStore(dir, fakeEncryption());

    expect(await store.read('openai')).toBeUndefined();
    expect(await store.list()).toEqual([]);
    await store.modify('openai', async () => login);

    const copies = readdirSync(dir).filter((name) => name.startsWith('credentials.json.corrupt'));
    expect(copies.map((name) => readFileSync(join(dir, name), 'utf8'))).toEqual(['{ not json']);
    expect(await openCredentialStore(dir, fakeEncryption()).read('openai')).toEqual(login);
  });

  it('encrypts again when the OS asks, e.g. after its key changed', async () => {
    const dir = tempDir();
    await openCredentialStore(dir, fakeEncryption()).modify('openai', async () => login);
    let encrypted = 0;
    const rotated = fakeEncryption({
      encrypt: async (text) => {
        encrypted += 1;
        return fakeEncryption().encrypt(text);
      },
      decrypt: async (data) => ({ ...(await fakeEncryption().decrypt(data)), shouldReEncrypt: true }),
    });

    expect(await openCredentialStore(dir, rotated).read('openai')).toEqual(login);
    expect(encrypted).toBe(1);
    expect(await openCredentialStore(dir, fakeEncryption()).read('openai')).toEqual(login);
  });

  it('gives this installation a stable id, kept with the logins', async () => {
    const dir = tempDir();
    const id = await openCredentialStore(dir, fakeEncryption()).installId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(await openCredentialStore(dir, fakeEncryption()).installId()).toBe(id);
  });

  it("says when the OS can't really encrypt (Linux with no keyring), so the candidate can be told", () => {
    expect(openCredentialStore(tempDir(), fakeEncryption({ backend: () => 'basic_text' })).encrypted()).toBe(false);
    expect(openCredentialStore(tempDir(), fakeEncryption()).encrypted()).toBe(true);
  });
});
