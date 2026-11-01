import { type ModelErrorKind, modelErrorKind } from '@interviewharness/engine';
import { type Connection, type KeyProviderName, keyProviders, keyProviderTable, type ModelChoice, type ProviderName, type Providers } from '@interviewharness/providers';
import type { ConnectResult, ModelConnection, ModelList } from '../shared/api.ts';
import { isModelChoice, isServerAddress, type Settings, settingsAfterLogout, settingsAfterRemoving, withYourModel } from '../shared/settings.ts';

/** Each provider as the candidate knows it. */
export const providerNames: Record<ProviderName, string> = {
  chatgpt: 'ChatGPT',
  ollama: 'Ollama',
  server: 'OpenAI-compatible server',
  ...(Object.fromEntries(keyProviderTable.map((row) => [row.id, row.name])) as Record<(typeof keyProviderTable)[number]['id'], string>),
};

/** The providers reached at an address the candidate can change, and the setting that keeps it. */
export const addressSettings = { ollama: 'ollamaAddress', server: 'serverAddress' } as const satisfies Partial<Record<ProviderName, keyof Settings>>;

const isKeyProvider = (provider: ProviderName): provider is KeyProviderName => (keyProviders as readonly string[]).includes(provider);
const hasAddress = (provider: ProviderName): provider is keyof typeof addressSettings => Object.hasOwn(addressSettings, provider);

export const isProviderName = (value: unknown): value is ProviderName => typeof value === 'string' && Object.hasOwn(providerNames, value);

/** Checks a key and address arriving over IPC for `provider`: the renderer is not trusted to send well-formed data. */
function isConnection(provider: ProviderName, value: unknown): value is Connection {
  if (typeof value !== 'object' || value === null) return false;
  const { key, address } = value as Record<string, unknown>;
  if (key !== undefined && (typeof key !== 'string' || key.length > 500 || !isKeyProvider(provider))) return false;
  if (address !== undefined && (!isServerAddress(address) || !hasAddress(provider))) return false;
  return true;
}

function isModelConnection(value: unknown): value is ModelConnection {
  if (typeof value !== 'object' || value === null) return false;
  const { slot, provider, model } = value as Record<string, unknown>;
  if (slot !== 'interviewer' && slot !== 'feedback') return false;
  if (!isProviderName(provider)) return false;
  if (typeof model !== 'string' || !model || model.length > 200) return false;
  return isConnection(provider, value);
}

/**
 * Adding a model to your models, into a slot. The model is asked for one short reply first, through the address or
 * key the candidate just entered, and only a model that answers is saved, with that address and key.
 * Anything that fails leaves everything as it was, and says why in plain words.
 */
export function modelChooser({
  providers,
  settings,
  encrypted = () => true,
}: {
  providers: Providers;
  settings: { values(): Settings; change(changes: Partial<Settings>): unknown };
  /** Whether saved keys are encrypted by the OS (not on Linux with no keyring). */
  encrypted?: () => boolean;
}) {
  return {
    /** The models a provider offers, reached through an address or key not saved yet if given. */
    async list(provider: unknown, connection: unknown = {}): Promise<ModelList> {
      if (!isProviderName(provider) || !isConnection(provider, connection)) return { ok: false, error: "Those models can't be listed." };
      try {
        return { ok: true, models: await providers.listModels(provider, connection) };
      } catch (error) {
        const address = connection.address ?? (hasAddress(provider) ? settings.values()[addressSettings[provider]] : undefined);
        return { ok: false, error: plainError(modelErrorKind(error), { provider, ...connection, address }, error) };
      }
    },

    async connect(request: unknown): Promise<ConnectResult> {
      if (!isModelConnection(request)) return { ok: false, error: "That model can't be picked." };
      const { slot, provider, model, key, address } = request;
      const choice: ModelChoice = { provider, model };
      try {
        await providers.check(choice, { address, key });
      } catch (error) {
        return { ok: false, error: plainError(modelErrorKind(error), request, error) };
      }
      const savesKey = !!key && isKeyProvider(provider);
      if (savesKey) await providers.saveKey(provider, key);
      const unencryptedNote = savesKey && !encrypted() && !settings.values().unencryptedLoginNoted;
      settings.change({
        ...(address && hasAddress(provider) ? { [addressSettings[provider]]: address } : {}),
        yourModels: withYourModel(settings.values().yourModels, choice),
        ...(slot === 'interviewer' ? { interviewerModel: choice } : { feedbackModel: choice }),
        ...(unencryptedNote ? { unencryptedLoginNoted: true } : {}),
      });
      return { ok: true, unencryptedNote };
    },

    /** Takes a model off your models, and unpicks it wherever it was picked. */
    removeModel(model: unknown) {
      if (!isModelChoice(model)) return;
      settings.change(settingsAfterRemoving(settings.values(), model));
    },

    /** Forgets a provider's login or key (a server's address too), and removes its models from your models. */
    async removeConnection(provider: unknown) {
      // Ollama has nothing to forget.
      if (!isProviderName(provider) || provider === 'ollama') return;
      await providers.logout(provider);
      settings.change({ ...settingsAfterLogout(settings.values(), provider), ...(provider === 'server' ? { serverAddress: '' } : {}) });
    },
  };
}

/** Why a model didn't answer, or its models couldn't be listed, in words for the candidate. Never repeats a key. */
function plainError(kind: ModelErrorKind, { provider, model, key, address }: { provider: ProviderName; model?: string } & Connection, error: unknown) {
  const name = provider === 'server' ? 'The server' : providerNames[provider];
  const it = model ?? 'The model';
  switch (kind) {
    case 'offline':
      if (provider === 'ollama') {
        return `Ollama isn't running at ${address ?? 'its address'}. Open the Ollama app, or run "ollama serve" in a terminal, then try again.`;
      }
      if (provider === 'server') return `Nothing answered at ${address ?? 'the server address'}. Check that the server is running and the address is right.`;
      return `Couldn't reach ${name}. Check your connection and try again.`;
    case 'auth':
      if (provider === 'chatgpt') return 'Your ChatGPT login has run out. Sign in again.';
      if (provider === 'server' && !key) return 'The server asks for a key. Add it and try again.';
      return `${name} refused the key. Check it and try again.`;
    case 'rate-limit':
      return `${name} says you've hit a rate limit or used up your quota. Try again later, or check your plan.`;
    case 'timeout':
      return `${it} didn't answer within a minute. A local model may still be loading; try again.`;
    default: {
      const said = error instanceof Error ? error.message : String(error);
      const safe = (key ? said.replaceAll(key.trim(), '…') : said).slice(0, 200);
      return `${it} didn't answer: ${safe}`;
    }
  }
}
