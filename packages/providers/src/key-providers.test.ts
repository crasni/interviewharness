import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CredentialStore, createProviders, keyProviderTable } from './index.ts';
import { fakeKeyServer } from './test/fake-key-server.ts';
import { memoryCredentials } from './test/loopback.ts';

// Every provider in the table of key providers, checked the same way: adding a row is covered by these
// tests without writing new ones.

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };
const unauthorized = { status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'invalid api key', code: 401 } }) };

/** The variable each provider's own SDK or pi-ai would read a key from, if the app let it. From pi-ai 1.4.0's providers. */
const environmentKeys: Record<(typeof keyProviderTable)[number]['id'], string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  together: 'TOGETHER_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  huggingface: 'HF_TOKEN',
  vercel: 'AI_GATEWAY_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  baseten: 'BASETEN_API_KEY',
};

let fake: Awaited<ReturnType<typeof fakeKeyServer>>;
beforeEach(async () => {
  fake = await fakeKeyServer();
});
afterEach(async () => {
  await fake.close();
});

/** Providers whose every key provider is reached at the fake. */
function providersWith(credentials: CredentialStore = memoryCredentials()) {
  const baseUrls = Object.fromEntries(keyProviderTable.map(({ id }) => [id, `${fake.origin}/v1`]));
  return createProviders({ credentials, appVersion: '0.1.1', baseUrls });
}

/** The key a request carried, in whichever header its API puts it. */
const sentKey = (headers: Record<string, unknown>) =>
  (headers['x-api-key'] as string | undefined) ?? (headers['x-goog-api-key'] as string | undefined) ?? (headers.authorization as string | undefined)?.replace(/^Bearer /, '');

describe('the table of key providers', () => {
  it('names the providers candidates come with keys for', () => {
    expect(keyProviderTable.map((p) => p.name)).toEqual(
      expect.arrayContaining(['DeepSeek', 'Mistral', 'xAI', 'Groq', 'Moonshot AI', 'Together', 'Fireworks', 'Cerebras', 'Hugging Face', 'Vercel AI Gateway']),
    );
  });

  // ADR 0021: plans with unclear or refusing terms are not named; their keys don't work at these addresses anyway.
  it('names no coding plan, Kimi or MiniMax plan, OpenCode Go or Copilot', () => {
    const said = keyProviderTable.map((p) => `${p.id} ${p.name}`).join(' ');
    expect(said).not.toMatch(/z\.?ai|zhipu|kimi|minimax|qwen|xiaomi|opencode|copilot|codex|coding/i);
  });

  it('imports nothing, so the renderer can use it without pulling pi-ai in', () => {
    expect(readFileSync(new URL('./key-providers.ts', import.meta.url), 'utf8')).not.toMatch(/^\s*import\b/m);
  });

  for (const provider of keyProviderTable) {
    describe(provider.name, () => {
      it('lists its models from its catalog, and starts on its named default when it has one', async () => {
        const listed = await providersWith().listModels(provider.id);

        expect(listed.length).toBeGreaterThan(0);
        expect(listed.every((m) => !m.local && !m.small)).toBe(true);
        if (provider.defaultModel) expect(listed.map((m) => m.id)).toContain(provider.defaultModel);
      });

      it('sends the saved key and nothing else, and a rejected key fails as auth', async () => {
        const providers = providersWith();
        const [model] = await providers.listModels(provider.id);
        await providers.saveKey(provider.id, `saved-key-for-${provider.id}`);
        process.env[environmentKeys[provider.id]] = 'key-from-the-environment';
        fake.reply(unauthorized);
        try {
          await expect(providers.model({ provider: provider.id, model: model!.id }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
        } finally {
          delete process.env[environmentKeys[provider.id]];
        }

        expect(fake.requests).toHaveLength(1);
        expect(sentKey(fake.requests[0]!.headers)).toBe(`saved-key-for-${provider.id}`);
        expect(JSON.stringify(fake.requests[0])).not.toContain('key-from-the-environment');
        expect(await providers.isLoggedIn(provider.id)).toBe(true);
      });

      it('with no saved key, sends nothing, even with a key in the environment', async () => {
        const providers = providersWith();
        const [model] = await providers.listModels(provider.id);
        process.env[environmentKeys[provider.id]] = 'key-from-the-environment';
        try {
          await expect(providers.model({ provider: provider.id, model: model!.id }).streamText(request)).rejects.toMatchObject({ kind: 'auth' });
        } finally {
          delete process.env[environmentKeys[provider.id]];
        }

        expect(fake.requests).toHaveLength(0);
        expect(await providers.isLoggedIn(provider.id)).toBe(false);
      });

      it('has a key page on its own https site', () => {
        expect(new URL(provider.keyPage).protocol).toBe('https:');
      });
    });
  }

  it('streams a reply from an OpenAI-compatible key provider', async () => {
    const providers = providersWith();
    await providers.saveKey('deepseek', 'sk-deepseek-test');
    fake.reply({ text: 'Yes, it can be empty.', inputTokens: 80, outputTokens: 7 });

    const result = await providers.model({ provider: 'deepseek', model: 'deepseek-flash' }).streamText(request);

    expect(result).toEqual({ text: 'Yes, it can be empty.', usage: { inputTokens: 80, outputTokens: 7 } });
    expect(fake.requests[0]!.headers.authorization).toBe('Bearer sk-deepseek-test');
  });

  it("forces Mistral's one tool for a structured reply, in its API's words", async () => {
    const providers = providersWith();
    await providers.saveKey('mistral', 'mistral-test');
    fake.reply(unauthorized);
    const schema = {
      name: 'say',
      jsonSchema: { type: 'object', properties: { words: { type: 'string' } }, required: ['words'] },
      parse: (value: unknown) => value as { words: string },
    };

    await expect(providers.model({ provider: 'mistral', model: 'mistral-medium-latest' }).generateObject({ ...request, schema })).rejects.toMatchObject({ kind: 'auth' });

    expect(fake.requests[0]!.body.tool_choice).toEqual({ type: 'function', function: { name: 'say' } });
  });
});
