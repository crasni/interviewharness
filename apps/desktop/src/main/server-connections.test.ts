import { createProviders } from '@interviewharness/providers';
import { fakeKeyServer, memoryCredentials } from '@interviewharness/providers/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings, validSettings } from '../shared/settings.ts';
import { modelChooser } from './model-choice.ts';
import { serverConnections } from './server-connections.ts';

/** Settings in memory, validated as main validates them. */
function memorySettings() {
  let values: Settings = { ...defaultSettings };
  return {
    values: () => values,
    change: (changes: Partial<Settings>) => (values = { ...values, ...validSettings(changes) }),
  };
}

let fake: Awaited<ReturnType<typeof fakeKeyServer>>;
let settings: ReturnType<typeof memorySettings>;
let credentials: ReturnType<typeof memoryCredentials>;
let servers: ReturnType<typeof serverConnections>;
let chooser: ReturnType<typeof modelChooser>;

beforeEach(async () => {
  fake = await fakeKeyServer(['qwen3-8b']);
  settings = memorySettings();
  credentials = memoryCredentials();
  const providers = createProviders({ credentials, appVersion: '0.1.0', servers: () => settings.values().servers });
  let made = 0;
  servers = serverConnections({ providers, settings, newId: () => `s${++made}` });
  chooser = modelChooser({ providers, settings });
});
afterEach(async () => {
  await fake.close();
});

const unauthorized = { status: 401, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid key' } }) };
const notFound = { status: 404, body: JSON.stringify({ error: { message: 'Not found' } }) };

describe('adding a named server, checked before it is saved', () => {
  it('saves an Anthropic-format server that answers, its key under its own id, and its model as one of yours', async () => {
    fake.reply({ text: 'OK' });

    const result = await servers.add({ slot: 'interviewer', name: 'Work gateway', address: fake.origin, format: 'anthropic', key: ' gw-secret ', model: 'qwen3-8b' });

    const added = { provider: 'server', server: 's1', model: 'qwen3-8b' };
    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values()).toMatchObject({
      servers: [{ id: 's1', name: 'Work gateway', address: fake.origin, format: 'anthropic' }],
      yourModels: [added],
      interviewerModel: added,
    });
    expect(Object.fromEntries(credentials.entries)).toEqual({ 'server:s1': { type: 'api_key', key: 'gw-secret' } });
    expect(fake.requests.at(-1)!.headers['x-api-key']).toBe('gw-secret');
  });

  it('keeps each server apart, with its own key', async () => {
    fake.reply({ text: 'OK' }, { text: 'OK' });

    await servers.add({ slot: 'interviewer', name: 'Home', address: `${fake.origin}/v1`, format: 'openai', key: 'home-key', model: 'qwen3-8b' });
    await servers.add({ slot: 'feedback', name: 'Work', address: fake.origin, format: 'anthropic', key: 'work-key', model: 'qwen3-8b' });

    expect(settings.values().servers.map((s) => s.name)).toEqual(['Home', 'Work']);
    expect(Object.fromEntries(credentials.entries)).toEqual({ 'server:s1': { type: 'api_key', key: 'home-key' }, 'server:s2': { type: 'api_key', key: 'work-key' } });
    expect(settings.values().yourModels).toHaveLength(2);
  });

  it('a model picked from the server later is checked on that server', async () => {
    fake.reply({ text: 'OK' }, { text: 'OK' });
    await servers.add({ slot: 'interviewer', name: 'Home', address: `${fake.origin}/v1`, format: 'openai', model: 'qwen3-8b' });

    const result = await chooser.connect({ slot: 'feedback', provider: 'server', server: 's1', model: 'typed-model' });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().feedbackModel).toEqual({ provider: 'server', server: 's1', model: 'typed-model' });
    expect(fake.requests.at(-1)!.body.model).toBe('typed-model');
  });

  it('saves nothing when the server does not answer', async () => {
    const address = `${fake.origin}/v1`;
    await fake.close();

    const result = await servers.add({ slot: 'interviewer', name: 'Home', address, format: 'openai', key: 'k', model: 'qwen3-8b' });

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/^Address: nothing answered at/) });
    expect(settings.values().servers).toEqual([]);
    expect(credentials.entries.size).toBe(0);
  });
});

describe('server errors name the field to fix', () => {
  const add = (request: Partial<Parameters<typeof servers.add>[0]> = {}) =>
    servers.add({ slot: 'interviewer', name: 'Home', address: `${fake.origin}/v1`, format: 'openai', model: 'qwen3-8b', ...request });

  it('a key the server asks for', async () => {
    fake.reply(unauthorized);
    expect(await add()).toMatchObject({ error: expect.stringMatching(/^Key: the server asks for a key/) });
  });

  it('a key the server refuses, never repeated', async () => {
    fake.reply(unauthorized);
    const result = await add({ key: 'wrong-key' });
    expect(result).toMatchObject({ error: expect.stringMatching(/^Key: the server refused/) });
    expect(JSON.stringify(result)).not.toContain('wrong-key');
  });

  it('an OpenAI-format address without /v1', async () => {
    fake.reply(notFound);
    expect(await add({ address: fake.origin })).toMatchObject({ error: expect.stringMatching(/^Address: .*The address usually ends in \/v1/) });
  });

  it('an Anthropic-format address with /v1', async () => {
    fake.reply(notFound);
    expect(await add({ address: `${fake.origin}/v1`, format: 'anthropic' })).toMatchObject({ error: expect.stringMatching(/^Address: .*without \/v1/) });
  });

  it('a model the server does not have', async () => {
    fake.reply(notFound);
    expect(await add({ model: 'no-such-model' })).toMatchObject({ error: expect.stringMatching(/^Model: /) });
  });

  it('no name, or a name another server has', async () => {
    expect(await add({ name: '  ' })).toMatchObject({ error: expect.stringMatching(/^Name: /) });
    fake.reply({ text: 'OK' });
    await add();
    expect(await add({ name: 'home' })).toMatchObject({ error: expect.stringMatching(/^Name: another server is called/) });
  });

  it('an address that is not a web address', async () => {
    expect(await add({ address: 'localhost:1234' })).toMatchObject({ error: expect.stringMatching(/^Address: /) });
  });

  it('when listing models, too', async () => {
    fake.reply(notFound);
    expect(await servers.list({ address: fake.origin, format: 'openai' })).toMatchObject({ ok: false, error: expect.stringMatching(/^Address: .*\/v1/) });
    expect(await servers.list({ address: fake.origin, format: 'anthropic' })).toMatchObject({ ok: true, models: [{ id: 'qwen3-8b' }] });
  });

  it('refuses a request the renderer made up', async () => {
    for (const made of [null, { name: 'x' }, { slot: 'interviewer', name: 'x', address: 'file:///etc', format: 'openai', model: 'm' }, { slot: 'interviewer', name: 'x', address: fake.origin, format: 'gemini', model: 'm' }, { slot: 'interviewer', name: 'x', address: fake.origin, format: 'openai', model: 'm', key: 'k'.repeat(501) }]) {
      expect(await servers.add(made)).toMatchObject({ ok: false });
    }
    expect(await servers.edit({ server: '../etc', name: 'x', address: fake.origin, format: 'openai', model: 'm' })).toMatchObject({ ok: false });
    expect(settings.values().servers).toEqual([]);
  });
});

describe('editing and removing a server', () => {
  beforeEach(async () => {
    fake.reply({ text: 'OK' });
    await servers.add({ slot: 'interviewer', name: 'Home', address: `${fake.origin}/v1`, format: 'openai', key: 'old-key', model: 'qwen3-8b' });
  });

  it('a new name, address and format are checked, and the saved key kept when none is typed', async () => {
    fake.reply({ text: 'OK' });

    const result = await servers.edit({ server: 's1', name: 'Home (Anthropic)', address: fake.origin, format: 'anthropic', model: 'qwen3-8b' });

    expect(result).toEqual({ ok: true, unencryptedNote: false });
    expect(settings.values().servers).toEqual([{ id: 's1', name: 'Home (Anthropic)', address: fake.origin, format: 'anthropic' }]);
    expect(fake.requests.at(-1)!.headers['x-api-key']).toBe('old-key');
    expect(credentials.entries.get('server:s1')).toEqual({ type: 'api_key', key: 'old-key' });
  });

  it('a refused new key leaves the server and its key as they were', async () => {
    fake.reply(unauthorized);

    await servers.edit({ server: 's1', name: 'Home', address: `${fake.origin}/v1`, format: 'openai', key: 'new-key', model: 'qwen3-8b' });

    expect(settings.values().servers[0]!.address).toBe(`${fake.origin}/v1`);
    expect(credentials.entries.get('server:s1')).toEqual({ type: 'api_key', key: 'old-key' });
  });

  it('removing it forgets its key and takes its models off your models and the slots', async () => {
    await chooser.removeConnection('server', 's1');

    expect(settings.values()).toMatchObject({ servers: [], yourModels: [], interviewerModel: null });
    expect(credentials.entries.size).toBe(0);
  });
});
