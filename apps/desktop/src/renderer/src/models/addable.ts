import { keyProviderTable } from '@interviewharness/providers/defaults';
import type { ModelChoice } from '../../../shared/settings.ts';

/**
 * Everything a candidate can add as a connection, as one table: Settings → Model's Add list and the Start
 * screen's API key row are both drawn from it. Adding a provider is one more row here (and adding a new
 * kind of form, one more value of `Fields`), never edits across the screens.
 *
 * Plans the app can't use (a Claude plan login, Gemini AI Pro/Ultra, Z.ai and Qwen coding plans, Copilot)
 * are simply not in it, so they appear nowhere, not even in search (ADR 0021).
 */

/** The kinds of access, in the order the list shows them. A group with nothing in it isn't shown. */
export const addGroups = [
  { id: 'plans', label: 'Plans you pay for' },
  { id: 'sign-in', label: 'Sign in' },
  { id: 'keys', label: 'API keys' },
  { id: 'local', label: 'On this computer or your network' },
] as const;

export type AddGroup = (typeof addGroups)[number]['id'];

/**
 * The fields an item asks for once it's picked, and so what its one button does:
 * - `sign-in`: nothing to type; signs in through the browser (once signed in, a model to use).
 * - `running`: finds what's running at an address on this computer; asks for the address only when nothing answers.
 * - `key`: an API key and a model from the provider's list.
 * - `server`: a name, the server's address and API format (OpenAI- or Anthropic-compatible), a key if it needs
 *   one, and a model it lists or one typed in.
 */
export type Fields = 'sign-in' | 'running' | 'key' | 'server';

export interface AddableItem {
  /** Unique in the table; also names the item to tests and to the screens. */
  id: string;
  group: AddGroup;
  /** What the list shows, and what the open item is titled. */
  name: string;
  /** What else it's known as, found by search but not shown (e.g. "Gemini" for Google). */
  alsoKnownAs?: string[];
  /** The provider the item connects. */
  provider: ModelChoice['provider'];
  fields: Fields;
}

export const addable: readonly AddableItem[] = [
  { id: 'chatgpt', group: 'plans', name: 'ChatGPT', alsoKnownAs: ['OpenAI', 'Plus', 'Pro'], provider: 'chatgpt', fields: 'sign-in' },

  // Every provider in the table of key providers, in its order: OpenAI, Anthropic, Google, OpenRouter, DeepSeek…
  ...keyProviderTable.map(({ id, name, alsoKnownAs }): AddableItem => ({ id, group: 'keys', name, alsoKnownAs: alsoKnownAs && [...alsoKnownAs], provider: id, fields: 'key' })),

  { id: 'ollama', group: 'local', name: 'Ollama', alsoKnownAs: ['local'], provider: 'ollama', fields: 'running' },
  // Any number of them, each by name, in either API format (picked in its fields).
  {
    id: 'server',
    group: 'local',
    name: 'Custom server',
    alsoKnownAs: ['OpenAI-compatible', 'Anthropic-compatible', 'LM Studio', 'llama.cpp', 'vLLM', 'Jan', 'LiteLLM', 'local', 'gateway'],
    provider: 'server',
    fields: 'server',
  },

  { id: 'openrouter-sign-in', group: 'sign-in', name: 'OpenRouter', provider: 'openrouter', fields: 'sign-in' },
];

export interface FoundGroup {
  id: AddGroup;
  label: string;
  items: AddableItem[];
}

/**
 * `items` grouped by kind, in the groups' order, keeping those that match every word typed in their name
 * or what else they're known as (ignoring case). Groups left with nothing are dropped.
 */
export function searchAddable(items: readonly AddableItem[], query: string): FoundGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (item: AddableItem) => {
    const said = [item.name, ...(item.alsoKnownAs ?? [])].join(' ').toLowerCase();
    return words.every((word) => said.includes(word));
  };
  return addGroups
    .map(({ id, label }) => ({ id, label, items: items.filter((item) => item.group === id && matches(item)) }))
    .filter((group) => group.items.length > 0);
}
