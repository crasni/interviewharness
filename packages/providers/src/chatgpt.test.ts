import { ModelError } from '@interviewharness/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Credential, type CredentialStore, createProviders } from './index.ts';
import { fakeOpenAI } from './test/fake-openai.ts';

/** A credential store in memory, holding a ChatGPT login unless told otherwise. */
function memoryStore(initial: Record<string, Credential> = {}): CredentialStore & { entries: Map<string, Credential> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    read: async (id) => entries.get(id),
    list: async () => [...entries].map(([providerId, credential]) => ({ providerId, type: credential.type })),
    async modify(id, fn) {
      const next = await fn(entries.get(id));
      if (next) entries.set(id, next);
      return entries.get(id);
    },
    delete: async (id) => void entries.delete(id),
  };
}

const loggedIn = () =>
  memoryStore({
    openai: { type: 'oauth', access: 'chatgpt-access-token', refresh: 'refresh-token', expires: Date.now() + 3_600_000, clientId: 'oaiapp_1' },
  });

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };

let openai: Awaited<ReturnType<typeof fakeOpenAI>>;
beforeEach(async () => {
  openai = await fakeOpenAI();
});
afterEach(async () => {
  await openai.close();
});

describe('a model on the ChatGPT plan', () => {
  it("streams the reply's text, and reports usage and which model answered", async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    const model = providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' });
    openai.reply({ text: 'Yes, it can be empty.', inputTokens: 120, outputTokens: 7 });
    const pieces: string[] = [];

    const result = await model.streamText(request, (piece) => pieces.push(piece));

    expect(result).toEqual({ text: 'Yes, it can be empty.', usage: { inputTokens: 120, outputTokens: 7 } });
    expect(pieces.join('')).toBe('Yes, it can be empty.');
    expect(pieces.length).toBeGreaterThan(1);
    expect(model.identity).toEqual({ provider: 'chatgpt', model: 'gpt-5-mini' });
  });

  it("sends the plan's token, the prompt, and nothing the plan rejects", async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ text: 'Yes.' });

    await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText({ ...request, maxOutputTokens: 200 });

    const [sent] = openai.requests;
    expect(sent!.path).toBe('/v1/responses');
    expect(sent!.headers.authorization).toBe('Bearer chatgpt-access-token');
    expect(sent!.headers['user-agent']).toBe('InterviewHarness/0.1.0');
    expect(JSON.stringify(sent!.body.input)).toContain('Can the list be empty?');
    expect(JSON.stringify(sent!.body)).toContain('You are the interviewer.');
    expect(sent!.body).toMatchObject({ store: false, stream: true });
    expect(sent!.body).not.toHaveProperty('temperature');
    expect(sent!.body).not.toHaveProperty('max_output_tokens');
  });

  it('stops when aborted, as when the candidate talks over the interviewer', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ hang: true });
    const controller = new AbortController();

    const reply = providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText({ ...request, signal: controller.signal });
    setTimeout(() => controller.abort(), 50);

    await expect(reply).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('fails with a typed error the room can explain', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    const model = providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' });

    openai.reply({ status: 401, body: JSON.stringify({ error: { message: 'Invalid token' } }) });
    await expect(model.streamText(request)).rejects.toMatchObject({ kind: 'auth' });

    openai.reply(...Array(3).fill({ status: 429, body: JSON.stringify({ error: { message: 'Slow down' } }) }));
    const limited = model.streamText(request);
    await expect(limited).rejects.toBeInstanceOf(ModelError);
    await expect(limited).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('fails as not logged in when there is no ChatGPT login', async () => {
    const providers = createProviders({ credentials: memoryStore(), appVersion: '0.1.0', fetch: openai.fetchVia });

    await expect(providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
    expect(openai.requests).toHaveLength(0);
  });

  it('sends nothing from provider environment variables, which would add headers or log requests', async () => {
    Object.assign(process.env, { OPENAI_ORG_ID: 'org-env', OPENAI_PROJECT_ID: 'proj-env', OPENAI_CUSTOM_HEADERS: 'x-from-env: 1' });
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ text: 'Yes.' });

    await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request);

    const { headers } = openai.requests[0]!;
    expect(headers['openai-organization']).toBeUndefined();
    expect(headers['openai-project']).toBeUndefined();
    expect(headers['x-from-env']).toBeUndefined();
  });

  it('never uses a key from the environment', async () => {
    process.env.OPENAI_API_KEY = 'sk-from-the-environment';
    try {
      const providers = createProviders({ credentials: memoryStore(), appVersion: '0.1.0', fetch: openai.fetchVia });

      await expect(providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
      expect(openai.requests).toHaveLength(0);
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });
});

describe('Continue with ChatGPT', () => {
  const deviceId = '0b6f6a3e-6f2e-4c55-9a51-3d1f1c2b7a10';
  const loginProviders = (credentials: CredentialStore) =>
    createProviders({ credentials, appVersion: '0.1.0', signIn: { authOrigin: openai.origin } });

  /** Plays the candidate's browser: approves the sign-in, and OpenAI redirects back to the app. */
  function browserThatApproves(seen: URL[]) {
    return async (url: string) => {
      const page = new URL(url);
      seen.push(page);
      const back = new URL(page.searchParams.get('redirect_uri')!);
      back.search = new URLSearchParams({ code: 'the-code', state: page.searchParams.get('state')!, client_id: 'oaiapp_issued' }).toString();
      await fetch(back);
    };
  }

  /** Whether anything still listens where the sign-in page would send the browser back. */
  const listening = (page: URL) =>
    fetch(page.searchParams.get('redirect_uri')!).then(
      () => true,
      () => false,
    );

  it('signs in through the browser, comes back by itself, and saves the login', async () => {
    openai.replyToToken(200, {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      id_token: 'id-token',
      expires_in: 3600,
      scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
    });
    const credentials = memoryStore();
    const providers = loginProviders(credentials);
    const pages: URL[] = [];

    await providers.loginWithChatGPT({ openBrowser: browserThatApproves(pages), deviceId });

    expect(`${pages[0]!.origin}${pages[0]!.pathname}`).toBe(`${openai.origin}/api/accounts/authorize`);
    expect(Object.fromEntries(pages[0]!.searchParams)).toMatchObject({
      client_id: 'dynamic_agent_client',
      agent_name_hint: 'InterviewHarness',
      ext_agent_host_id: `urn:uuid:${deviceId}`,
      code_challenge_method: 'S256',
    });
    expect(pages[0]!.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
    expect(openai.requests.at(-1)).toMatchObject({
      path: '/api/accounts/oauth/token',
      body: { grant_type: 'authorization_code', code: 'the-code', client_id: 'oaiapp_issued' },
    });
    expect(credentials.entries.get('openai')).toMatchObject({ type: 'oauth', access: 'new-access', refresh: 'new-refresh', clientId: 'oaiapp_issued' });
    expect(await providers.isLoggedIn('chatgpt')).toBe(true);
    expect(await listening(pages[0]!)).toBe(false);
  });

  it('can be cancelled while waiting for the browser; it saves nothing and stops listening', async () => {
    const credentials = memoryStore();
    const controller = new AbortController();
    const pages: URL[] = [];

    const login = loginProviders(credentials).loginWithChatGPT({
      openBrowser: (url) => {
        pages.push(new URL(url));
        controller.abort();
      },
      deviceId,
      signal: controller.signal,
    });

    await expect(login).rejects.toThrow();
    expect(credentials.entries.size).toBe(0);
    expect(await listening(pages[0]!)).toBe(false);
  });

  it("ends at once, and stops listening, when the browser can't be opened", async () => {
    const pages: URL[] = [];

    const login = loginProviders(memoryStore()).loginWithChatGPT({
      openBrowser: async (url) => {
        pages.push(new URL(url));
        throw new Error('No browser');
      },
      deviceId,
    });

    await expect(login).rejects.toThrow('No browser');
    expect(await listening(pages[0]!)).toBe(false);
  });

  it('logs out by forgetting the login', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0' });

    await providers.logout('chatgpt');

    expect(await providers.isLoggedIn('chatgpt')).toBe(false);
  });
});
