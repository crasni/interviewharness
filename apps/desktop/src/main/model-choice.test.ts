import { createProviders } from '@interviewharness/providers';
import { fakeKeyServer, fakeOllama, memoryCredentials } from '@interviewharness/providers/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings, validSettings } from '../shared/settings.ts';
import { modelChooser } from './model-choice.ts';

/** Settings in memory, validated as main validates them. */
function memorySettings() {
  let values: Settings = { ...defaultSettings };
  return {
    values: () => values,
    change: (changes: Partial<Settings>) => (values = { ...values, ...validSettings(changes) }),
  };
}

let ollama: Awaited<ReturnType<typeof fakeOllama>>;
let cloud: Awaited<ReturnType<typeof fakeKeyServer>>;
let settings: ReturnType<typeof memorySettings>;
let credentials: ReturnType<typeof memoryCredentials>;
let chooser: ReturnType<typeof modelChooser>;

beforeEach(async () => {
  ollama = await fakeOllama([{ name: 'qwen3:0.6b', parameterSize: '751.63M' }]);
  cloud = await fakeKeyServer(['local-model']);
  settings = memorySettings();
  credentials = memoryCredentials();
  const providers = createProviders({
    credentials,
    appVersion: '0.1.0',
    ollamaAddress: () => settings.values().ollamaAddress,
    serverAddress: () => settings.values().serverAddress,
    baseUrls: { anthropic: cloud.origin, openrouter: `${cloud.origin}/api/v1` },
  });
  chooser = modelChooser({ providers, settings });
});
afterEach(async () => {
  await ollama.close();
  await cloud.close();
});

describe('picking a model, checked before it is saved', () => {
  it('saves an Ollama model that answers, with the address it was found at', async () => {
    ollama.reply({ text: 'OK' });

    const result = await chooser.connect({ slot: 'interviewer', provider: 'ollama', model: 'qwen3:0.6b', address: ollama.origin });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().interviewerModel).toEqual({ provider: 'ollama', model: 'qwen3:0.6b' });
    expect(settings.values().ollamaAddress).toBe(ollama.origin);
  });

  it("saves nothing when Ollama isn't running, and says how to start it", async () => {
    const address = ollama.origin;
    await ollama.close();

    const result = await chooser.connect({ slot: 'interviewer', provider: 'ollama', model: 'qwen3:0.6b', address });

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/Ollama isn't running.*ollama serve/s) });
    expect(settings.values().interviewerModel).toBeNull();
    expect(settings.values().ollamaAddress).toBe(defaultSettings.ollamaAddress);
  });

  it('keeps a key that works, and saves the model as the Feedback model when asked', async () => {
    cloud.reply({ text: 'OK' });

    const result = await chooser.connect({ slot: 'feedback', provider: 'openrouter', model: 'z-ai/glm-5v-turbo', key: ' sk-or-good ' });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().feedbackModel).toEqual({ provider: 'openrouter', model: 'z-ai/glm-5v-turbo' });
    expect(credentials.entries.get('openrouter')).toEqual({ type: 'api_key', key: 'sk-or-good' });
  });

  it('keeps neither a refused key nor the model, and says the key was refused', async () => {
    cloud.reply({ status: 401, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });

    const result = await chooser.connect({ slot: 'interviewer', provider: 'anthropic', model: 'claude-sonnet-4-6', key: 'sk-ant-wrong' });

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/refused/) });
    expect(settings.values().interviewerModel).toBeNull();
    expect(credentials.entries.has('anthropic')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('sk-ant-wrong');
  });

  it("keeps the key already saved when a new one is refused", async () => {
    await credentials.modify('anthropic', async () => ({ type: 'api_key', key: 'sk-ant-old' }));
    cloud.reply({ status: 401, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });

    await chooser.connect({ slot: 'interviewer', provider: 'anthropic', model: 'claude-sonnet-4-6', key: 'sk-ant-wrong' });

    expect(credentials.entries.get('anthropic')).toEqual({ type: 'api_key', key: 'sk-ant-old' });
  });

  it('saves a server that answers, with its address', async () => {
    cloud.reply({ text: 'OK' });

    const result = await chooser.connect({ slot: 'interviewer', provider: 'server', model: 'local-model', address: `${cloud.origin}/v1` });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().interviewerModel).toEqual({ provider: 'server', model: 'local-model' });
    expect(settings.values().serverAddress).toBe(`${cloud.origin}/v1`);
  });

  it("says plainly when nothing answers at a server's address", async () => {
    const address = `${cloud.origin}/v1`;
    await cloud.close();

    const result = await chooser.connect({ slot: 'interviewer', provider: 'server', model: 'local-model', address });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(`Nothing answered at ${address}`) });
    expect(settings.values().interviewerModel).toBeNull();
  });

  it("says once that a saved key isn't encrypted, on a machine with no keyring", async () => {
    const unencrypted = modelChooser({ providers: createProviders({ credentials, appVersion: '0.1.0', baseUrls: { openrouter: `${cloud.origin}/api/v1` } }), settings, encrypted: () => false });
    cloud.reply({ text: 'OK' }, { text: 'OK' });

    expect(await unencrypted.connect({ slot: 'interviewer', provider: 'openrouter', model: 'z-ai/glm-5v-turbo', key: 'sk-or-1' })).toEqual({ ok: true, unencryptedNote: true });
    expect(await unencrypted.connect({ slot: 'interviewer', provider: 'openrouter', model: 'z-ai/glm-5v-turbo', key: 'sk-or-2' })).toEqual({ ok: true, unencryptedNote: false });
  });

  it('refuses a request the renderer made up', async () => {
    for (const made of [null, { slot: 'interviewer', provider: 'claude-login', model: 'x' }, { slot: 'boss', provider: 'ollama', model: 'x' }, { slot: 'interviewer', provider: 'server', model: 'x', address: 'file:///etc' }]) {
      expect(await chooser.connect(made)).toMatchObject({ ok: false });
    }
    expect(settings.values().interviewerModel).toBeNull();
  });
});
