import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CredentialStore, createProviders } from './index.ts';
import { fakeKeyServer } from './test/fake-key-server.ts';
import { memoryCredentials } from './test/loopback.ts';


const here = dirname(fileURLToPath(import.meta.url));

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };

let fake: Awaited<ReturnType<typeof fakeKeyServer>>;
beforeEach(async () => {
  fake = await fakeKeyServer(['qwen2.5-7b-instruct']);
});
afterEach(async () => {
  await fake.close();
});

/** Providers whose every address points at the fake. */
function providersWith(credentials: CredentialStore = memoryCredentials()) {
  return createProviders({
    credentials,
    appVersion: '0.1.0',
    baseUrls: { openai: `${fake.origin}/v1`, anthropic: fake.origin, google: `${fake.origin}/v1beta`, openrouter: `${fake.origin}/api/v1` },
  });
}

const unauthorized = { status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key', code: 401, status: 'UNAUTHENTICATED' } }) };

describe('a model reached with an API key', () => {
  const cases = [
    { provider: 'openai', model: 'gpt-5-mini', key: 'sk-openai-test', header: 'authorization', sent: 'Bearer sk-openai-test' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6', key: 'sk-ant-test', header: 'x-api-key', sent: 'sk-ant-test' },
    { provider: 'google', model: 'gemini-pro-latest', key: 'AIza-test', header: 'x-goog-api-key', sent: 'AIza-test' },
    { provider: 'openrouter', model: 'z-ai/glm-5v-turbo', key: 'sk-or-test', header: 'authorization', sent: 'Bearer sk-or-test' },
  ] as const;

  for (const { provider, model, key, header, sent } of cases) {
    it(`${provider}: sends the saved key, and a rejected key fails as auth`, async () => {
      const providers = providersWith();
      await providers.saveKey(provider, key);
      fake.reply(unauthorized);

      await expect(providers.model({ provider, model }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });

      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0]!.headers[header]).toBe(sent);
      expect(await providers.isLoggedIn(provider)).toBe(true);
    });

    it(`${provider}: with no saved key, sends nothing, even with a key in the environment`, async () => {
      const variable = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY' }[provider];
      process.env[variable] = 'key-from-the-environment';
      try {
        const providers = providersWith();

        await expect(providers.model({ provider, model }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
        expect(fake.requests).toHaveLength(0);
        expect(await providers.isLoggedIn(provider)).toBe(false);
      } finally {
        delete process.env[variable];
      }
    });
  }

  const schema = {
    name: 'say',
    jsonSchema: { type: 'object', properties: { words: { type: 'string' } }, required: ['words'] },
    parse: (value: unknown) => value as { words: string },
  };

  for (const { provider, model, forced } of [
    { provider: 'openai', model: 'gpt-5-mini', forced: (body: Record<string, unknown>) => body.tool_choice },
    { provider: 'anthropic', model: 'claude-sonnet-4-6', forced: (body: Record<string, unknown>) => body.tool_choice },
    { provider: 'google', model: 'gemini-pro-latest', forced: (body: Record<string, unknown>) => (body.toolConfig as { functionCallingConfig?: unknown })?.functionCallingConfig },
  ] as const) {
    it(`${provider}: asks for a structured reply by forcing the one tool, in its own API's words`, async () => {
      const providers = providersWith();
      await providers.saveKey(provider, 'test-key');
      fake.reply(unauthorized);

      await expect(providers.model({ provider, model }).generateObject({ ...request, schema })).rejects.toMatchObject({ kind: 'auth' });

      expect(forced(fake.requests[0]!.body)).toEqual(
        { openai: { type: 'function', name: 'say' }, anthropic: { type: 'tool', name: 'say' }, google: { mode: 'ANY' } }[provider],
      );
    });
  }

  it('keeps an OpenAI key apart from the ChatGPT login, so neither replaces the other', async () => {
    const credentials = memoryCredentials();
    const providers = providersWith(credentials);
    await credentials.modify('openai', async () => ({ type: 'oauth', access: 'chatgpt-access', refresh: 'r', expires: Date.now() + 3_600_000 }));

    await providers.saveKey('openai', 'sk-openai-test');

    expect(await providers.isLoggedIn('chatgpt')).toBe(true);
    expect(await providers.isLoggedIn('openai')).toBe(true);
    await providers.logout('openai');
    expect(await providers.isLoggedIn('chatgpt')).toBe(true);
    expect(await providers.isLoggedIn('openai')).toBe(false);
  });

  it("never loads pi-ai's Anthropic provider, which registers the Claude consumer login", () => {
    const sources = readdirSync(here, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));

    for (const file of sources) {
      expect(readFileSync(join(here, file), 'utf8'), file).not.toMatch(/pi-ai\/providers\/anthropic['"]|providers\/all|auth\/oauth/);
    }
  });

  it('lists each key provider’s models from its catalog', async () => {
    const providers = providersWith();

    for (const provider of ['openai', 'anthropic', 'google', 'openrouter'] as const) {
      const listed = await providers.listModels(provider);
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.every((m) => !m.small)).toBe(true);
    }
  });
});
