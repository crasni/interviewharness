import { describe, expect, it } from 'vitest';
import { addable, searchAddable } from './addable.ts';

const names = (found: ReturnType<typeof searchAddable>) => found.map((group) => [group.label, group.items.map((item) => item.name)]);

describe('what can be added', () => {
  it('lists everything grouped by kind, in order, leaving out a group with nothing in it', () => {
    expect(names(searchAddable(addable, ''))).toEqual([
      ['Plans you pay for', ['ChatGPT']],
      ['Sign in', ['OpenRouter']],
      ['API keys', ['OpenAI', 'Anthropic', 'Google', 'OpenRouter']],
      ['On this computer or your network', ['Ollama', 'OpenAI-compatible server']],
    ]);
  });

  it('typing filters across every group, by name or by what else it is known as, ignoring case', () => {
    expect(names(searchAddable(addable, 'open'))).toEqual([
      ['Plans you pay for', ['ChatGPT']],
      ['Sign in', ['OpenRouter']],
      ['API keys', ['OpenAI', 'OpenRouter']],
      ['On this computer or your network', ['OpenAI-compatible server']],
    ]);
    expect(names(searchAddable(addable, 'LM studio'))).toEqual([['On this computer or your network', ['OpenAI-compatible server']]]);
    expect(names(searchAddable(addable, 'gemini'))).toEqual([['API keys', ['Google']]]);
  });

  it('finds nothing for a search that matches nothing', () => {
    expect(searchAddable(addable, 'no such provider')).toEqual([]);
  });

  it('can be narrowed to some items, as the Start screen does to keys and servers', () => {
    const keysAndServers = addable.filter((item) => item.fields === 'key' || item.fields === 'server');
    expect(names(searchAddable(keysAndServers, ''))).toEqual([
      ['API keys', ['OpenAI', 'Anthropic', 'Google', 'OpenRouter']],
      ['On this computer or your network', ['OpenAI-compatible server']],
    ]);
  });

  // ADR 0021: plans the app can't use don't appear at all, not even in search.
  it.each(['Gemini AI Pro', 'Ultra', 'Claude Pro', 'Claude Max', 'Z.ai', 'GLM', 'Qwen', 'Alibaba', 'Copilot', 'Codex', 'SuperGrok', 'Kimi', 'MiniMax'])(
    'never offers a plan it can not use: %s',
    (plan) => {
      expect(searchAddable(addable, plan)).toEqual([]);
    },
  );
});
