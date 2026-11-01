// Plain values the app's renderer may use too. Nothing here may import anything: the renderer runs in the
// browser, and an import would pull pi-ai and Node in with it.

/** Where Ollama listens unless the candidate changes it. */
export const defaultOllamaAddress = 'http://localhost:11434';
