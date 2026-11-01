import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CredentialStore, createProviders } from './index.ts';
import { fakeOllama } from './test/fake-ollama.ts';

const noCredentials: CredentialStore = {
  read: async () => undefined,
  list: async () => [],
  modify: async () => undefined,
  delete: async () => {},
};

let ollama: Awaited<ReturnType<typeof fakeOllama>>;
afterEach(async () => {
  await ollama?.close();
});

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };

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

const providersAt = (address: string) => createProviders({ credentials: noCredentials, appVersion: '0.1.0', ollamaAddress: () => address });

describe('Ollama on this computer', () => {
  beforeEach(async () => {
    ollama = await fakeOllama([
      { name: 'llama3.1:8b', parameterSize: '8.0B' },
      { name: 'qwen2.5:32b', parameterSize: '32.8B' },
      { name: 'qwen3:8b', parameterSize: '8.2B', contextLength: 40960, capabilities: ['completion', 'tools', 'thinking'] },
      { name: 'nomic-embed-text:latest', parameterSize: '137M', capabilities: ['embedding'] },
    ]);
  });

  it('lists the installed models that can chat, with the ones under the size threshold marked small', async () => {
    const listed = await providersAt(ollama.origin).listModels('ollama');

    expect(listed).toEqual([
      { id: 'llama3.1:8b', name: 'llama3.1:8b', small: true },
      { id: 'qwen2.5:32b', name: 'qwen2.5:32b', small: false },
      { id: 'qwen3:8b', name: 'qwen3:8b', small: true },
    ]);
  });

  it("fails as offline when nothing listens at Ollama's address", async () => {
    const address = ollama.origin;
    await ollama.close();

    await expect(providersAt(address).listModels('ollama')).rejects.toMatchObject({ kind: 'offline' });
  });

  it("streams the reply's text, and reports usage and which model answered", async () => {
    const model = providersAt(ollama.origin).model({ provider: 'ollama', model: 'llama3.1:8b' });
    ollama.reply({ text: 'Yes, it can be empty.', inputTokens: 90, outputTokens: 6 });
    const pieces: string[] = [];

    const result = await model.streamText(request, (piece) => pieces.push(piece));

    expect(result).toEqual({ text: 'Yes, it can be empty.', usage: { inputTokens: 90, outputTokens: 6 } });
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join('')).toBe('Yes, it can be empty.');
    expect(model.identity).toEqual({ provider: 'ollama', model: 'llama3.1:8b' });
  });

  it('uses the native chat API, sets the context size, and turns thinking off where the model thinks', async () => {
    const providers = providersAt(ollama.origin);
    ollama.reply({ text: 'Yes.' }, { text: 'Yes.' });

    await providers.model({ provider: 'ollama', model: 'qwen3:8b' }).streamText({ ...request, maxOutputTokens: 200 });
    await providers.model({ provider: 'ollama', model: 'llama3.1:8b' }).streamText(request);

    const [thinker, plain] = ollama.chats();
    expect(thinker!.body).toMatchObject({ model: 'qwen3:8b', stream: true, think: false, options: { num_predict: 200 } });
    expect(thinker!.body.messages).toEqual([
      { role: 'system', content: 'You are the interviewer.' },
      { role: 'user', content: 'Can the list be empty?' },
    ]);
    // Ollama's default context is about 4k and cuts longer prompts silently, so it's always set.
    const numCtx = (thinker!.body.options as { num_ctx?: number }).num_ctx!;
    expect(numCtx).toBeGreaterThanOrEqual(8192);
    expect(numCtx).toBeLessThanOrEqual(40960);
    // A model that can't think rejects the setting, so it isn't sent.
    expect(plain!.body).not.toHaveProperty('think');
    expect((plain!.body.options as { num_ctx?: number }).num_ctx).toBeGreaterThanOrEqual(8192);
  });

  it('stops when aborted, as when the candidate talks over the interviewer', async () => {
    ollama.reply({ hang: true });
    const controller = new AbortController();

    const reply = providersAt(ollama.origin).model({ provider: 'ollama', model: 'llama3.1:8b' }).streamText({ ...request, signal: controller.signal });
    setTimeout(() => controller.abort(), 50);

    await expect(reply).rejects.toMatchObject({ kind: 'aborted' });
  });

  it("fails with Ollama's own words when the model isn't installed", async () => {
    const reply = providersAt(ollama.origin).model({ provider: 'ollama', model: 'gone:1b' }).streamText(request);

    await expect(reply).rejects.toMatchObject({ kind: 'other', message: "model 'gone:1b' not found" });
    expect(ollama.chats()).toHaveLength(0);
  });

  it("fails as offline mid-round when Ollama stops", async () => {
    const model = providersAt(ollama.origin).model({ provider: 'ollama', model: 'llama3.1:8b' });
    await ollama.close();

    await expect(model.streamText(request)).rejects.toMatchObject({ kind: 'offline' });
  });

  it("gives a structured reply by constraining the output to the schema with Ollama's format", async () => {
    ollama.reply({ text: '{"words":"Yes.","level":2}', inputTokens: 50, outputTokens: 9 });

    const result = await providersAt(ollama.origin).model({ provider: 'ollama', model: 'llama3.1:8b' }).generateObject({ ...request, schema: sayLevel });

    expect(result).toEqual({ object: { words: 'Yes.', level: 2 }, usage: { inputTokens: 50, outputTokens: 9 } });
    expect(ollama.chats()[0]!.body.format).toEqual(sayLevel.jsonSchema);
  });

  it('asks once more, saying what was wrong, when the reply does not fit, then gives up', async () => {
    const model = providersAt(ollama.origin).model({ provider: 'ollama', model: 'llama3.1:8b' });
    ollama.reply({ text: '{"words":"Yes."}' }, { text: '{"words":"Yes.","level":1}' });

    expect((await model.generateObject({ ...request, schema: sayLevel })).object).toEqual({ words: 'Yes.', level: 1 });
    expect(JSON.stringify(ollama.chats()[1]!.body.messages)).toContain('needs a level');

    ollama.reply({ text: 'not json' }, { text: '{}' });
    await expect(model.generateObject({ ...request, schema: sayLevel })).rejects.toMatchObject({ kind: 'bad-output' });
  });
});
