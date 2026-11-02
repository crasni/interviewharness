import { ModelError } from '@interviewharness/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CredentialStore, createProviders } from './index.ts';
import { fakeOpenAI } from './test/fake-openai.ts';
import { memoryCredentials } from './test/loopback.ts';


const loggedIn = () =>
  memoryCredentials({
    openai: { type: 'oauth', access: 'chatgpt-access-token', refresh: 'refresh-token', expires: Date.now() + 3_600_000, clientId: 'oaiapp_1' },
  });

/** A small schema for structured replies: some words and a level. */
const sayLevel = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: { words: { type: 'string' }, level: { type: 'number' } },
    required: ['words', 'level'],
    additionalProperties: false,
  },
  parse(value: unknown) {
    const { words, level } = value as { words?: unknown; level?: unknown };
    if (typeof words !== 'string') throw new Error('The reply needs words');
    if (typeof level !== 'number') throw new Error('The reply needs a level');
    return { words, level };
  },
};

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

  it('gives a structured reply by calling one tool, forced, with the schema as its parameters', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ toolCall: { name: 'say', arguments: { words: 'Yes.', level: 2 } } });

    const result = await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).generateObject({ ...request, schema: sayLevel });

    expect(result).toEqual({ object: { words: 'Yes.', level: 2 }, usage: { inputTokens: 150, outputTokens: 20 } });
    const { body } = openai.requests[0]!;
    expect(body.tool_choice).toEqual({ type: 'function', name: 'say' });
    expect(body.tools).toMatchObject([{ type: 'function', name: 'say', parameters: sayLevel.jsonSchema }]);
  });

  it('asks once more, saying what was wrong, when the reply does not fit the schema', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ toolCall: { name: 'say', arguments: { words: 'Yes.' } } }, { toolCall: { name: 'say', arguments: { words: 'Yes.', level: 1 } } });

    const result = await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).generateObject({ ...request, schema: sayLevel });

    expect(result.object).toEqual({ words: 'Yes.', level: 1 });
    expect(JSON.stringify(openai.requests[1]!.body.input)).toContain('needs a level');
  });

  it('gives up with a bad-output error after a second reply that does not fit', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0', fetch: openai.fetchVia });
    openai.reply({ toolCall: { name: 'say', arguments: {} } }, { toolCall: { name: 'say', arguments: {} } });

    await expect(providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).generateObject({ ...request, schema: sayLevel })).rejects.toMatchObject({
      kind: 'bad-output',
    });
  });

  it('fails as not logged in when there is no ChatGPT login', async () => {
    const providers = createProviders({ credentials: memoryCredentials(), appVersion: '0.1.0', fetch: openai.fetchVia });

    await expect(providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
    expect(openai.requests).toHaveLength(0);
  });

  it("says a login that couldn't be read failed, in plain words and its code, never the error's own text", async () => {
    const failing = { ...loggedIn(), read: async () => Promise.reject(Object.assign(new Error('refresh with token rt-secret-123 failed: ECONNRESET'), { code: 'ECONNRESET' })) };
    const providers = createProviders({ credentials: failing, appVersion: '0.1.0', fetch: openai.fetchVia });

    const failed = await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request).catch((error: unknown) => error);

    expect(failed).toMatchObject({ kind: 'offline', message: "Couldn't read the login (ECONNRESET)" });
  });

  it("says a login that couldn't be read failed, without a code when the error has none", async () => {
    const failing = { ...loggedIn(), read: async () => Promise.reject(new Error('invalid_grant for token rt-secret-123')) };
    const providers = createProviders({ credentials: failing, appVersion: '0.1.0', fetch: openai.fetchVia });

    const failed = await providers.model({ provider: 'chatgpt', model: 'gpt-5-mini' }).streamText(request).catch((error: unknown) => error);

    expect(failed).toMatchObject({ kind: 'auth', message: "Couldn't read the login" });
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
      const providers = createProviders({ credentials: memoryCredentials(), appVersion: '0.1.0', fetch: openai.fetchVia });

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
    const credentials = memoryCredentials();
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
    const credentials = memoryCredentials();
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

    const login = loginProviders(memoryCredentials()).loginWithChatGPT({
      openBrowser: async (url) => {
        pages.push(new URL(url));
        throw new Error('No browser');
      },
      deviceId,
    });

    await expect(login).rejects.toThrow('No browser');
    expect(await listening(pages[0]!)).toBe(false);
  });

  it('lists the models ChatGPT offers, including the default', async () => {
    const listed = await createProviders({ credentials: memoryCredentials(), appVersion: '0.1.0' }).listModels('chatgpt');

    expect(listed.map((m) => m.id)).toContain('gpt-5-mini');
  });

  it('logs out by forgetting the login', async () => {
    const providers = createProviders({ credentials: loggedIn(), appVersion: '0.1.0' });

    await providers.logout('chatgpt');

    expect(await providers.isLoggedIn('chatgpt')).toBe(false);
  });
});
