import { createProviders } from '@interviewharness/providers';
import { fakeKeyServer, memoryCredentials } from '@interviewharness/providers/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings, validSettings } from '../shared/settings.ts';
import { keyPageFor } from './key-pages.ts';
import { modelChooser } from './model-choice.ts';

/** Settings in memory, validated as main validates them. */
function memorySettings() {
  let values: Settings = { ...defaultSettings };
  return {
    values: () => values,
    change: (changes: Partial<Settings>) => (values = { ...values, ...validSettings(changes) }),
  };
}

let cloud: Awaited<ReturnType<typeof fakeKeyServer>>;
let settings: ReturnType<typeof memorySettings>;
let credentials: ReturnType<typeof memoryCredentials>;
let chooser: ReturnType<typeof modelChooser>;

beforeEach(async () => {
  cloud = await fakeKeyServer();
  settings = memorySettings();
  credentials = memoryCredentials();
  const providers = createProviders({ credentials, appVersion: '0.1.1', baseUrls: { deepseek: `${cloud.origin}/v1`, mistral: cloud.origin } });
  chooser = modelChooser({ providers, settings });
});
afterEach(async () => {
  await cloud.close();
});

describe('a key provider from the table', () => {
  it('keeps a key that works, and the model it answered with', async () => {
    cloud.reply({ text: 'OK' });

    const result = await chooser.connect({ slot: 'interviewer', provider: 'deepseek', model: 'deepseek-flash', key: 'sk-deepseek-good' });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().interviewerModel).toEqual({ provider: 'deepseek', model: 'deepseek-flash' });
    expect(credentials.entries.get('deepseek')).toEqual({ type: 'api_key', key: 'sk-deepseek-good' });
  });

  it('says by name that a key was refused, and keeps nothing', async () => {
    cloud.reply({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) });

    const result = await chooser.connect({ slot: 'interviewer', provider: 'mistral', model: 'mistral-medium-latest', key: 'bad-key' });

    expect(result).toEqual({ ok: false, error: 'Mistral refused the key. Check it and try again.' });
    expect(settings.values().interviewerModel).toBeNull();
    expect(credentials.entries.size).toBe(0);
  });

  it('lists its models before a key is saved', async () => {
    const listed = await chooser.list('groq');

    expect(listed).toMatchObject({ ok: true, models: expect.arrayContaining([expect.objectContaining({ id: 'openai/gpt-oss-120b' })]) });
  });
});

describe('where keys are made', () => {
  it("opens a provider's own key page", () => {
    expect(keyPageFor('deepseek')).toBe('https://platform.deepseek.com/api_keys');
    expect(keyPageFor('huggingface')).toBe('https://huggingface.co/settings/tokens');
  });

  it('opens nothing for anything else the renderer sends', () => {
    for (const asked of ['ollama', 'chatgpt', 'server', 'https://example.com', 'toString', '__proto__', 42, null, undefined, { provider: 'deepseek' }]) {
      expect(keyPageFor(asked)).toBeUndefined();
    }
  });
});
