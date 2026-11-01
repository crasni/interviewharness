import { describe, expect, it } from 'vitest';
import { defaultSettings, validSettings } from '../shared/settings.ts';
import { migratedServerId, oneServerBecomesNamed } from './server-migration.ts';

describe("v0.1's one server becomes a named server", () => {
  it('is named after its host, speaks the OpenAI format, and its picked models follow it', () => {
    const v1 = {
      version: 1,
      theme: 'dark',
      serverAddress: 'http://localhost:1234/v1',
      interviewerModel: { provider: 'server', model: 'qwen/qwen3-8b' },
      feedbackModel: { provider: 'ollama', model: 'qwen3:8b' },
      smallModels: ['server/qwen/qwen3-8b', 'ollama/qwen3:8b'],
    };

    const migrated = oneServerBecomesNamed(v1);

    expect(migrated).toEqual({
      version: 1,
      theme: 'dark',
      servers: [{ id: migratedServerId, name: 'localhost:1234', address: 'http://localhost:1234/v1', format: 'openai' }],
      interviewerModel: { provider: 'server', server: migratedServerId, model: 'qwen/qwen3-8b' },
      feedbackModel: { provider: 'ollama', model: 'qwen3:8b' },
      smallModels: [`server/${migratedServerId}/qwen/qwen3-8b`, 'ollama/qwen3:8b'],
    });
    // What it makes is valid in the new shape.
    const { version: _, ...settings } = migrated;
    expect(validSettings(settings)).toEqual(settings);
  });

  it('leaves no server, and nothing picked from one, when there was none', () => {
    expect(oneServerBecomesNamed({ version: 1, serverAddress: '', interviewerModel: { provider: 'server', model: 'x' } })).toEqual({
      version: 1,
      servers: [],
      interviewerModel: null,
    });
    expect(oneServerBecomesNamed({ theme: 'light' })).toEqual({ theme: 'light', servers: [] });
  });

  it('a file whose server address was never valid loses it, as v0.1 would have', () => {
    expect(oneServerBecomesNamed({ serverAddress: 'file:///etc/passwd' })).toEqual({ servers: [] });
  });

  it('opens with the defaults when nothing else was set', () => {
    expect({ ...defaultSettings, ...validSettings(oneServerBecomesNamed({ version: 1 })) }.servers).toEqual([]);
  });
});
