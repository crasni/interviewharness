import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CredentialStore, createProviders } from './index.ts';
import { fakeKeyServer } from './test/fake-key-server.ts';
import { listenOnLoopback, memoryCredentials, readBody } from './test/loopback.ts';

/** OpenRouter's sign-in on loopback: the key exchange answers with whatever the test scripts. */
async function fakeOpenRouter() {
  const exchanges: { path: string; body: unknown }[] = [];
  let answer: { status: number; body: unknown } = { status: 200, body: { key: 'sk-or-issued' } };
  const server = await listenOnLoopback(async (request, response) => {
    const body = await readBody(request);
    exchanges.push({ path: request.url ?? '', body: body ? JSON.parse(body) : undefined });
    response.writeHead(request.method === 'POST' && request.url === '/api/v1/auth/keys' ? answer.status : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify(answer.body));
  });
  return { ...server, exchanges, answer: (next: typeof answer) => (answer = next) };
}

let openrouter: Awaited<ReturnType<typeof fakeOpenRouter>>;
let chat: Awaited<ReturnType<typeof fakeKeyServer>>;
beforeEach(async () => {
  openrouter = await fakeOpenRouter();
  chat = await fakeKeyServer([]);
});
afterEach(async () => {
  await openrouter.close();
  await chat.close();
});

const signInProviders = (credentials: CredentialStore) =>
  createProviders({ credentials, appVersion: '0.1.0', openRouterSignIn: { origin: openrouter.origin }, baseUrls: { openrouter: `${chat.origin}/api/v1` } });

/** Plays the candidate's browser: approves the sign-in, and OpenRouter sends it back to the app with a code. */
function browserThatApproves(seen: URL[]) {
  return async (url: string) => {
    const page = new URL(url);
    seen.push(page);
    const back = new URL(page.searchParams.get('callback_url')!);
    back.searchParams.set('code', 'the-code');
    await fetch(back);
  };
}

/** Whether anything still listens where the sign-in page would send the browser back. */
const listening = (page: URL) =>
  fetch(page.searchParams.get('callback_url')!).then(
    () => true,
    () => false,
  );

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };

describe('Sign in to OpenRouter', () => {
  it('signs in through the browser, comes back by itself, and saves the key OpenRouter issues', async () => {
    const credentials = memoryCredentials();
    const providers = signInProviders(credentials);
    const pages: URL[] = [];

    await providers.signInToOpenRouter({ openBrowser: browserThatApproves(pages) });

    const page = pages[0]!;
    expect(`${page.origin}${page.pathname}`).toBe(`${openrouter.origin}/auth`);
    expect(page.searchParams.get('code_challenge_method')).toBe('S256');
    expect(page.searchParams.get('callback_url')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback\/[0-9a-f-]{36}$/);
    expect(openrouter.exchanges).toEqual([
      { path: '/api/v1/auth/keys', body: { code: 'the-code', code_verifier: expect.any(String), code_challenge_method: 'S256' } },
    ]);
    expect(await providers.isLoggedIn('openrouter')).toBe(true);
    expect(await providers.isSignedIn('openrouter')).toBe(true);
    expect(await listening(page)).toBe(false);
  });

  it("sends the challenge of the verifier it later exchanges, so only this app can use the code", async () => {
    const pages: URL[] = [];

    await signInProviders(memoryCredentials()).signInToOpenRouter({ openBrowser: browserThatApproves(pages) });

    const { code_verifier: verifier } = openrouter.exchanges[0]!.body as { code_verifier: string };
    const { createHash } = await import('node:crypto');
    expect(pages[0]!.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('then reaches OpenRouter with the issued key, as with a pasted one', async () => {
    const providers = signInProviders(memoryCredentials());
    await providers.signInToOpenRouter({ openBrowser: browserThatApproves([]) });
    chat.reply({ status: 401, body: JSON.stringify({ error: { message: 'No auth credentials found', code: 401 } }) });

    await expect(providers.model({ provider: 'openrouter', model: 'z-ai/glm-5v-turbo' }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });

    expect(chat.requests[0]!.headers.authorization).toBe('Bearer sk-or-issued');
  });

  it('can be cancelled while waiting for the browser; it saves nothing and stops listening', async () => {
    const credentials = memoryCredentials();
    const controller = new AbortController();
    const pages: URL[] = [];

    const signIn = signInProviders(credentials).signInToOpenRouter({
      openBrowser: (url) => {
        pages.push(new URL(url));
        controller.abort();
      },
      signal: controller.signal,
    });

    await expect(signIn).rejects.toThrow();
    expect(credentials.entries.size).toBe(0);
    expect(openrouter.exchanges).toHaveLength(0);
    expect(await listening(pages[0]!)).toBe(false);
  });

  it("ends at once, and stops listening, when the browser can't be opened", async () => {
    const pages: URL[] = [];

    const signIn = signInProviders(memoryCredentials()).signInToOpenRouter({
      openBrowser: async (url) => {
        pages.push(new URL(url));
        throw new Error('No browser');
      },
    });

    await expect(signIn).rejects.toThrow('No browser');
    expect(await listening(pages[0]!)).toBe(false);
  });

  it('saves nothing when OpenRouter refuses the code', async () => {
    openrouter.answer({ status: 400, body: { error: { message: 'Invalid code' } } });
    const credentials = memoryCredentials();

    await expect(signInProviders(credentials).signInToOpenRouter({ openBrowser: browserThatApproves([]) })).rejects.toThrow('Invalid code');

    expect(credentials.entries.size).toBe(0);
  });

  it('saves nothing when the candidate turns it down in the browser', async () => {
    const credentials = memoryCredentials();
    const browserThatDeclines = async (url: string) => {
      const back = new URL(new URL(url).searchParams.get('callback_url')!);
      back.searchParams.set('error', 'access_denied');
      await fetch(back);
    };

    await expect(signInProviders(credentials).signInToOpenRouter({ openBrowser: browserThatDeclines })).rejects.toThrow();

    expect(credentials.entries.size).toBe(0);
    expect(openrouter.exchanges).toHaveLength(0);
  });

  it('only completes on its own callback path, and only once', async () => {
    const replies: number[] = [];
    await signInProviders(memoryCredentials()).signInToOpenRouter({
      openBrowser: async (url) => {
        const back = new URL(new URL(url).searchParams.get('callback_url')!);
        const stray = new URL(back);
        stray.pathname = '/oauth/callback/not-this-one';
        stray.searchParams.set('code', 'stray');
        replies.push((await fetch(stray)).status);
        back.searchParams.set('code', 'the-code');
        replies.push((await fetch(back)).status);
      },
    });

    expect(replies).toEqual([404, 200]);
    expect(openrouter.exchanges).toHaveLength(1);
  });

  it('tells a pasted key apart from a sign-in; pasting one replaces the sign-in', async () => {
    const providers = signInProviders(memoryCredentials());
    await providers.signInToOpenRouter({ openBrowser: browserThatApproves([]) });

    await providers.saveKey('openrouter', 'sk-or-pasted');

    expect(await providers.isLoggedIn('openrouter')).toBe(true);
    expect(await providers.isSignedIn('openrouter')).toBe(false);
  });

  it('signs out by forgetting the issued key', async () => {
    const providers = signInProviders(memoryCredentials());
    await providers.signInToOpenRouter({ openBrowser: browserThatApproves([]) });

    await providers.logout('openrouter');

    expect(await providers.isLoggedIn('openrouter')).toBe(false);
  });
});
