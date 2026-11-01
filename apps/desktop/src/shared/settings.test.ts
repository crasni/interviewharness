import { describe, expect, it } from 'vitest';
import { choiceFromKey, defaultSettings, feedbackModel, modelKey, type Settings, settingsAfterLogout, settingsAfterRemovingServer, validSettings } from './settings.ts';

const chatgpt = (model: string) => ({ provider: 'chatgpt' as const, model });

describe('model settings', () => {
  it('uses the interviewer model for Feedback unless another is picked', () => {
    expect(feedbackModel({ ...defaultSettings, interviewerModel: chatgpt('gpt-5-mini') })).toEqual(chatgpt('gpt-5-mini'));
    expect(feedbackModel({ ...defaultSettings, interviewerModel: chatgpt('gpt-5-mini'), feedbackModel: chatgpt('gpt-5.5') })).toEqual(
      chatgpt('gpt-5.5'),
    );
  });

  it('logging out of a provider unpicks its models, and keeps the rest', () => {
    const settings = { ...defaultSettings, interviewerModel: chatgpt('gpt-5-mini'), feedbackModel: chatgpt('gpt-5.5') };

    expect(settingsAfterLogout(settings, 'chatgpt')).toEqual({ interviewerModel: null, feedbackModel: null });
  });

  it('keeps only well-formed model choices and marks', () => {
    expect(
      validSettings({
        feedbackModel: { provider: 'chatgpt', model: 'gpt-5.5', apiKey: 'sk-sneaky' },
        smallModels: [modelKey(chatgpt('gpt-5-nano')), 42],
      }),
    ).toEqual({});
    expect(validSettings({ feedbackModel: null, smallModels: ['chatgpt/gpt-5-nano'] })).toEqual({
      feedbackModel: null,
      smallModels: ['chatgpt/gpt-5-nano'],
    });
  });
});

describe('named servers in settings', () => {
  const home = { id: 'home', name: 'Home', address: 'http://localhost:1234/v1', format: 'openai' };
  const gateway = { id: 'work', name: 'Work gateway', address: 'https://gateway.example/anthropic', format: 'anthropic' };

  it('keeps well-formed servers, each OpenAI- or Anthropic-compatible', () => {
    expect(validSettings({ servers: [home, gateway] })).toEqual({ servers: [home, gateway] });
  });

  it.each([
    ['a key riding along', [{ ...home, key: 'sk-sneaky' }]],
    ['an unknown format', [{ ...home, format: 'gemini' }]],
    ['an address that is not http(s)', [{ ...home, address: 'file:///etc/passwd' }]],
    ['an address with a password in it', [{ ...home, address: 'http://me:secret@localhost:1234/v1' }]],
    ['no name', [{ ...home, name: '  ' }]],
    ['two servers with one id', [home, { ...gateway, id: 'home' }]],
  ])('drops servers with %s', (_, servers) => {
    expect(validSettings({ servers })).toEqual({});
  });

  it("a server's model names its server, and only a server's model does", () => {
    const choice = { provider: 'server', server: 'home', model: 'qwen/qwen3-8b' };

    expect(validSettings({ interviewerModel: choice })).toEqual({ interviewerModel: choice });
    expect(validSettings({ interviewerModel: { provider: 'server', model: 'qwen3' } })).toEqual({});
    expect(validSettings({ interviewerModel: { provider: 'ollama', server: 'home', model: 'qwen3' } })).toEqual({});
  });

  it("a server's model as one string names its server, and comes back from it", () => {
    const choice = { provider: 'server' as const, server: 'home', model: 'qwen/qwen3-8b' };

    expect(modelKey(choice)).toBe('server/home/qwen/qwen3-8b');
    expect(choiceFromKey(modelKey(choice))).toEqual(choice);
    expect(choiceFromKey('ollama/qwen3:8b')).toEqual({ provider: 'ollama', model: 'qwen3:8b' });
  });

  it("removing a server unpicks its models, and keeps another server's", () => {
    const settings = {
      ...defaultSettings,
      servers: [home, gateway] as Settings['servers'],
      interviewerModel: { provider: 'server' as const, server: 'home', model: 'a' },
      feedbackModel: { provider: 'server' as const, server: 'work', model: 'b' },
    };

    expect(settingsAfterRemovingServer(settings, 'home')).toEqual({ servers: [gateway], interviewerModel: null });
  });
});
