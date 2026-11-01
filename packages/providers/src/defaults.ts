// Plain values the app's renderer may use too. Nothing here may import anything: the renderer runs in the
// browser, and an import would pull pi-ai and Node in with it.

/** The ChatGPT model the interviewer uses until the candidate picks another in Settings → Model. */
export const defaultChatGPTModel = 'gpt-6.1-sol';

/**
 * The model each provider's list starts on, where one is named; the others start on their first model.
 * The catalog carries no release dates, so "newest" can't be worked out and is named here instead.
 */
export const defaultModels: Partial<Record<'chatgpt' | 'openai' | 'openrouter', string>> = {
  chatgpt: defaultChatGPTModel,
  openai: 'gpt-6.1-sol',
  openrouter: 'openai/gpt-6.1-sol',
};

/** Where Ollama listens unless the candidate changes it. */
export const defaultOllamaAddress = 'http://localhost:11434';
