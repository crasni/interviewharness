// The table of key providers. Plain values the renderer may use too, so nothing here may import anything:
// an import would pull pi-ai and Node into the renderer with it.

/**
 * Every provider reached with an API key the candidate pastes, as one table: the app's names, its lists,
 * its "Get a key" links and its model lists' starting points all come from here, so adding a provider is
 * one more row (and, for a provider new to the app, its pi-ai factory in key-provider-factories.ts).
 *
 * - `id`: our name for it, kept in settings.json.
 * - `name`: as the candidate knows it.
 * - `piProvider`: the pi-ai provider it runs on, which is also the id its key is kept under.
 * - `keyPage`: where its keys are made. The only page "Get a key" may open for it.
 * - `defaultModel`: the model its list starts on, where one is named; otherwise its newest.
 * - `alsoKnownAs`: other words the Add list finds it by.
 *
 * Only providers whose pi-ai auth is a plain API key belong here: no subscription logins, no coding-plan
 * endpoints, no plans with unclear terms (ADR 0021).
 */
const rows = [
  { id: 'openai', name: 'OpenAI', piProvider: 'openai-key', keyPage: 'https://platform.openai.com/api-keys', defaultModel: 'gpt-6.1-sol', alsoKnownAs: ['GPT'] },
  { id: 'anthropic', name: 'Anthropic', piProvider: 'anthropic', keyPage: 'https://console.anthropic.com/settings/keys', alsoKnownAs: ['Claude API'] },
  { id: 'google', name: 'Google', piProvider: 'google', keyPage: 'https://aistudio.google.com/apikey', alsoKnownAs: ['Gemini API', 'AI Studio'] },
  { id: 'openrouter', name: 'OpenRouter', piProvider: 'openrouter', keyPage: 'https://openrouter.ai/settings/keys', defaultModel: 'openai/gpt-6.1-sol' },
  { id: 'deepseek', name: 'DeepSeek', piProvider: 'deepseek', keyPage: 'https://platform.deepseek.com/api_keys', defaultModel: 'deepseek-flash' },
  { id: 'mistral', name: 'Mistral', piProvider: 'mistral', keyPage: 'https://console.mistral.ai/api-keys', defaultModel: 'mistral-medium-latest', alsoKnownAs: ['Codestral'] },
  { id: 'xai', name: 'xAI', piProvider: 'xai', keyPage: 'https://console.x.ai', defaultModel: 'grok-4.7', alsoKnownAs: ['Grok API'] },
  { id: 'groq', name: 'Groq', piProvider: 'groq', keyPage: 'https://console.groq.com/keys', defaultModel: 'openai/gpt-oss-120b' },
  { id: 'moonshot', name: 'Moonshot AI', piProvider: 'moonshotai', keyPage: 'https://platform.moonshot.ai/console/api-keys', defaultModel: 'kimi-k3' },
  { id: 'together', name: 'Together', piProvider: 'together', keyPage: 'https://api.together.ai/settings/api-keys', alsoKnownAs: ['Together AI'] },
  { id: 'fireworks', name: 'Fireworks', piProvider: 'fireworks', keyPage: 'https://fireworks.ai/account/api-keys', alsoKnownAs: ['Fireworks AI'] },
  { id: 'cerebras', name: 'Cerebras', piProvider: 'cerebras', keyPage: 'https://cloud.cerebras.ai', defaultModel: 'gpt-oss-120b' },
  { id: 'huggingface', name: 'Hugging Face', piProvider: 'huggingface', keyPage: 'https://huggingface.co/settings/tokens', alsoKnownAs: ['HF', 'Inference Providers'] },
  { id: 'vercel', name: 'Vercel AI Gateway', piProvider: 'vercel-ai-gateway', keyPage: 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys' },
  { id: 'nvidia', name: 'NVIDIA', piProvider: 'nvidia', keyPage: 'https://build.nvidia.com/settings/api-keys', alsoKnownAs: ['NIM'] },
  { id: 'baseten', name: 'Baseten', piProvider: 'baseten', keyPage: 'https://app.baseten.co/settings/api_keys' },
] as const satisfies readonly KeyProviderRow<string>[];

/** Our names for the providers in the table. */
export type TableKeyProviderName = (typeof rows)[number]['id'];

export const keyProviderTable: readonly KeyProviderRow[] = rows;

export interface KeyProviderRow<Id extends string = TableKeyProviderName> {
  id: Id;
  name: string;
  piProvider: string;
  keyPage: string;
  defaultModel?: string;
  alsoKnownAs?: readonly string[];
}
