import type { MutableModels, Provider, ProviderAuth } from '@earendil-works/pi-ai';
import { basetenProvider } from '@earendil-works/pi-ai/providers/baseten';
import { cerebrasProvider } from '@earendil-works/pi-ai/providers/cerebras';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';
import { fireworksProvider } from '@earendil-works/pi-ai/providers/fireworks';
import { groqProvider } from '@earendil-works/pi-ai/providers/groq';
import { huggingfaceProvider } from '@earendil-works/pi-ai/providers/huggingface';
import { mistralProvider } from '@earendil-works/pi-ai/providers/mistral';
import { moonshotaiProvider } from '@earendil-works/pi-ai/providers/moonshotai';
import { nvidiaProvider } from '@earendil-works/pi-ai/providers/nvidia';
import { togetherProvider } from '@earendil-works/pi-ai/providers/together';
import { vercelAIGatewayProvider } from '@earendil-works/pi-ai/providers/vercel-ai-gateway';
import { xaiProvider } from '@earendil-works/pi-ai/providers/xai';
import { keyProviderTable, type TableKeyProviderName } from './key-providers.ts';

/** The table's providers that providers.ts registers itself, each with something of its own to set up. */
type RegisteredByHand = 'openai' | 'anthropic' | 'google' | 'openrouter';

/**
 * pi-ai's provider for each of the table's other rows. A row without one here fails to typecheck. Only the
 * models and the request code are taken from it: its auth (environment variables, and for xAI a
 * SuperGrok sign-in) is replaced by the saved key.
 */
const factories: Record<Exclude<TableKeyProviderName, RegisteredByHand>, () => Provider> = {
  deepseek: deepseekProvider,
  mistral: mistralProvider,
  xai: xaiProvider,
  groq: groqProvider,
  moonshot: moonshotaiProvider,
  together: togetherProvider,
  fireworks: fireworksProvider,
  cerebras: cerebrasProvider,
  huggingface: huggingfaceProvider,
  vercel: vercelAIGatewayProvider,
  nvidia: nvidiaProvider,
  baseten: basetenProvider,
};

/** Registers each of the table's other key providers, reached with the saved key and nothing else. */
export function registerKeyProviders(models: Pick<MutableModels, 'setProvider'>, savedKeyOnly: (name: string) => ProviderAuth) {
  for (const row of keyProviderTable) {
    if (!Object.hasOwn(factories, row.id)) continue;
    const provider = factories[row.id as keyof typeof factories]();
    // Its key is kept under the pi-ai id the table names, so the two must agree.
    if (provider.id !== row.piProvider) throw new Error(`${row.id} runs on pi-ai's ${provider.id}, not ${row.piProvider}`);
    models.setProvider({ ...provider, auth: savedKeyOnly(`${row.name} API key`) });
  }
}
