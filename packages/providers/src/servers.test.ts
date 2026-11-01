import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProviders, type CredentialStore, type Server } from './index.ts';
import { fakeKeyServer } from './test/fake-key-server.ts';
import { memoryCredentials } from './test/loopback.ts';

const request = { purpose: 'interviewer-reply' as const, system: 'You are the interviewer.', messages: [{ role: 'user' as const, text: 'Can the list be empty?' }] };
const schema = {
  name: 'say',
  jsonSchema: { type: 'object', properties: { words: { type: 'string' } }, required: ['words'] },
  parse: (value: unknown) => value as { words: string },
};

let fake: Awaited<ReturnType<typeof fakeKeyServer>>;
beforeEach(async () => {
  fake = await fakeKeyServer(['qwen2.5-7b-instruct']);
});
afterEach(async () => {
  await fake.close();
});

/** The two formats a server can speak, and the address each is given at: OpenAI's with its /v1, Anthropic's without. */
const formats = [
  { format: 'openai', address: () => `${fake.origin}/v1`, path: '/v1/chat/completions', keyHeader: 'authorization', sent: (key: string) => `Bearer ${key}` },
  { format: 'anthropic', address: () => fake.origin, path: '/v1/messages', keyHeader: 'x-api-key', sent: (key: string) => key },
] as const;

function providersWith(servers: Server[], credentials: CredentialStore = memoryCredentials()) {
  return createProviders({ credentials, appVersion: '0.1.0', servers: () => servers });
}

describe.each(formats)('a named server speaking the $format format', ({ format, address, path, keyHeader, sent }) => {
  const home = (): Server => ({ id: 'home', name: 'Home', address: address(), format });
  const choice = { provider: 'server' as const, server: 'home', model: 'qwen2.5-7b-instruct' };

  it('lists the models the server serves, as local', async () => {
    expect(await providersWith([home()]).listModels('server', { server: 'home' })).toEqual([{ id: 'qwen2.5-7b-instruct', name: 'qwen2.5-7b-instruct', local: true, small: false }]);
  });

  it('streams a reply with no key at all, as local servers need none', async () => {
    fake.reply({ text: 'Yes, it can be empty.', inputTokens: 80, outputTokens: 7 });

    const result = await providersWith([home()]).model(choice).streamText(request);

    expect(result).toEqual({ text: 'Yes, it can be empty.', usage: { inputTokens: 80, outputTokens: 7 } });
    expect(fake.requests.at(-1)!.path.split('?')[0]).toBe(path);
    expect(JSON.stringify(fake.requests.at(-1)!.body.messages)).toContain('Can the list be empty?');
  });

  it("sends the key saved for this server, and only this server's", async () => {
    const credentials = memoryCredentials();
    const providers = providersWith([home(), { id: 'work', name: 'Work', address: address(), format }], credentials);
    await providers.saveServerKey('home', 'home-secret');
    await providers.saveServerKey('work', 'work-secret');
    fake.reply({ text: 'Yes.' }, { text: 'Yes.' });

    await providers.model(choice).streamText(request);
    await providers.listModels('server', { server: 'work' });

    expect(fake.requests.at(-2)!.headers[keyHeader]).toBe(sent('home-secret'));
    expect(fake.requests.at(-1)!.headers[keyHeader]).toBe(sent('work-secret'));
  });

  it('gives a structured reply through a forced tool call', async () => {
    fake.reply({ toolCall: { name: 'say', arguments: { words: 'Yes.' } } });

    const result = await providersWith([home()]).model(choice).generateObject({ ...request, schema });

    expect(result.object).toEqual({ words: 'Yes.' });
  });

  it('checks a server not saved yet, with the address, format and key just entered, saving nothing', async () => {
    const credentials = memoryCredentials();
    const providers = providersWith([], credentials);
    fake.reply({ text: 'OK' });

    await providers.check({ ...choice, server: 'new' }, { address: address(), format, key: 'typed-key' });
    const listed = await providers.listModels('server', { address: address(), format, key: 'typed-key' });

    expect(fake.requests.at(-2)!.path.split('?')[0]).toBe(path);
    expect(fake.requests.at(-2)!.headers[keyHeader]).toBe(sent('typed-key'));
    expect(fake.requests.at(-1)!.headers[keyHeader]).toBe(sent('typed-key'));
    expect(listed.map((m) => m.id)).toEqual(['qwen2.5-7b-instruct']);
    expect(credentials.entries.size).toBe(0);
  });

  it('fails as offline when nothing listens at its address', async () => {
    const providers = providersWith([home()]);
    await fake.close();

    await expect(providers.listModels('server', { server: 'home' })).rejects.toMatchObject({ kind: 'offline' });
    await expect(providers.model(choice).streamText(request)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('fails as auth when the server refuses the key', async () => {
    fake.reply({ status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'invalid key' } }) });

    await expect(providersWith([home()]).listModels('server', { server: 'home' })).rejects.toMatchObject({ kind: 'auth' });
  });
});

describe('servers and their keys', () => {
  it('forgets a removed server’s key, and keeps the others', async () => {
    const credentials = memoryCredentials();
    const providers = providersWith([], credentials);
    await providers.saveServerKey('home', 'home-secret');
    await providers.saveServerKey('work', 'work-secret');

    await providers.forgetServer('home');

    expect([...credentials.entries.keys()]).toEqual(['server:work']);
  });

  it("moves v0.1's one server key to the server it became", async () => {
    const credentials = memoryCredentials({ server: { type: 'api_key', key: 'old-secret' } });
    const providers = providersWith([], credentials);

    await providers.adoptOldServerKey('first');

    expect(Object.fromEntries(credentials.entries)).toEqual({ 'server:first': { type: 'api_key', key: 'old-secret' } });
  });

  it('an unknown server has no models and no reply', async () => {
    const providers = providersWith([]);

    await expect(providers.listModels('server', { server: 'gone' })).rejects.toMatchObject({ kind: 'other' });
    await expect(providers.model({ provider: 'server', server: 'gone', model: 'x' }).streamText(request)).rejects.toMatchObject({ kind: 'other' });
  });
});
