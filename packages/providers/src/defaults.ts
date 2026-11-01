// Plain values the app's renderer may use too. Nothing here may import anything: the renderer runs in the
// browser, and an import would pull pi-ai and Node in with it.

/** The ChatGPT model the interviewer uses until the candidate picks another in Settings → Model. */
export const defaultChatGPTModel = 'gpt-5-mini';

/** Where Ollama listens unless the candidate changes it. */
export const defaultOllamaAddress = 'http://localhost:11434';
