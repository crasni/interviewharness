// Plain values the app's renderer may use too. Nothing here may import anything but other files of plain
// values (key-providers.ts): the renderer runs in the browser, and an import would pull pi-ai and Node in with it.

import { keyProviderTable, type TableKeyProviderName } from './key-providers.ts';

export { keyProviderTable } from './key-providers.ts';
export type { KeyProviderRow, TableKeyProviderName } from './key-providers.ts';

/** The ChatGPT model the interviewer uses until the candidate picks another in Settings → Model. */
export const defaultChatGPTModel = 'gpt-6.1-sol';

/**
 * The model each provider's list starts on, where one is named; the others start on their first model.
 * The catalog carries no release dates, so "newest" can't be worked out and is named here instead.
 */
export const defaultModels: Partial<Record<'chatgpt' | TableKeyProviderName, string>> = {
  chatgpt: defaultChatGPTModel,
  ...Object.fromEntries(keyProviderTable.flatMap((row) => (row.defaultModel ? [[row.id, row.defaultModel]] : []))),
};

/** Where Ollama listens unless the candidate changes it. */
export const defaultOllamaAddress = 'http://localhost:11434';
