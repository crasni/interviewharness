import { describe, expect, it } from 'vitest';
import { defaultSettings, feedbackModel, modelKey, settingsAfterLogout, validSettings } from './settings.ts';

const chatgpt = (model: string) => ({ provider: 'chatgpt' as const, model });

describe('model settings', () => {
  it('uses the interviewer model for Feedback unless another is picked', () => {
    expect(feedbackModel({ ...defaultSettings, interviewerModel: chatgpt('gpt-5-mini') })).toEqual(chatgpt('gpt-5-mini'));
    expect(feedbackModel({ ...defaultSettings, interviewerModel: chatgpt('gpt-5-mini'), feedbackModel: chatgpt('gpt-5.5') })).toEqual(
      chatgpt('gpt-5.5'),
    );
  });

  it('logging out of a provider unpicks its models, and keeps the rest', () => {
    const local = { provider: 'ollama' as const, model: 'qwen3:0.6b' };
    const settings = { ...defaultSettings, yourModels: [chatgpt('gpt-5-mini'), local, chatgpt('gpt-5.5')], interviewerModel: chatgpt('gpt-5-mini'), feedbackModel: chatgpt('gpt-5.5') };

    expect(settingsAfterLogout(settings, 'chatgpt')).toEqual({ yourModels: [local], interviewerModel: null, feedbackModel: null });
    expect(settingsAfterLogout({ ...settings, feedbackModel: local }, 'chatgpt')).toEqual({ yourModels: [local], interviewerModel: null });
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
