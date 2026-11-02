import { type ModelErrorKind, modelErrorKind } from '@interviewharness/engine';
import { type Connection, defaultChatGPTModel, type KeyProviderName, keyProviders, keyProviderTable, type ModelChoice, type ProviderName, type Providers } from '@interviewharness/providers';
import type { ConnectResult, KeyReplacement, ModelConnection, ModelList } from '../shared/api.ts';
import { isModelChoice, isServerAddress, isServerId, type Settings, settingsAfterAdding, settingsAfterLogout, settingsAfterRemoving } from '../shared/settings.ts';
import { plainServerError, serverConnections } from './server-connections.ts';

/** Each provider as the candidate knows it. */
export const providerNames: Record<ProviderName, string> = {
  chatgpt: 'ChatGPT',
  ollama: 'Ollama',
  server: 'Server',
  ...(Object.fromEntries(keyProviderTable.map((row) => [row.id, row.name])) as Record<(typeof keyProviderTable)[number]['id'], string>),
};

/** The providers reached at an address the candidate can change, and the setting that keeps it. (Servers keep theirs in `servers`.) */
export const addressSettings = { ollama: 'ollamaAddress' } as const satisfies Partial<Record<ProviderName, keyof Settings>>;

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
  const { slot, provider, model, server, ...connection } = value as Record<string, unknown>;
  if (slot !== undefined && slot !== 'interviewer' && slot !== 'feedback') return false;
  if (!isProviderName(provider)) return false;
  if (typeof model !== 'string' || !model || model.length > 200) return false;
  // A server's model is picked from a saved server (added through serverConnections), by its id.
  if (provider === 'server') return isServerId(server) && !Object.keys(connection).length;
  return server === undefined && isConnection(provider, value);
}

/** One check in the log: which model was asked for its short reply, and how it went. Never a key or a message that could quote one. */
export interface CheckLogEntry {
  check: { provider: ProviderName; model: string; server?: string; outcome: 'answered' | 'failed'; error?: ModelErrorKind; ms: number };
}

/** `providers`, with every check written to `log`. */
function loggingChecks(providers: Providers, log: (entry: CheckLogEntry) => void): Providers {
  return {
    ...providers,
    async check(choice, connection, timeoutMs) {
      const startedAt = performance.now();
      const which = { provider: choice.provider, model: choice.model, ...(choice.server ? { server: choice.server } : {}) };
      try {
        await providers.check(choice, connection, timeoutMs);
      } catch (error) {
        log({ check: { ...which, outcome: 'failed', error: modelErrorKind(error), ms: Math.round(performance.now() - startedAt) } });
        throw error;
      }
      log({ check: { ...which, outcome: 'answered', ms: Math.round(performance.now() - startedAt) } });
    },
  };
}

function isKeyReplacement(value: unknown): value is KeyReplacement & { provider: KeyProviderName } {
  if (typeof value !== 'object' || value === null) return false;
  const { provider, model, key, ...rest } = value as Record<string, unknown>;
  if (!isProviderName(provider) || !isKeyProvider(provider) || Object.keys(rest).length) return false;
  return typeof model === 'string' && !!model && model.length <= 200 && typeof key === 'string' && !!key.trim() && key.length <= 500;
}

/**
 * Adding a model to your models, into a slot. The model is asked for one short reply first, through the address or
 * key the candidate just entered, and only a model that answers is saved, with that address and key.
 * Anything that fails leaves everything as it was, and says why in plain words.
 */
export function modelChooser({
  providers: unlogged,
  settings,
  encrypted = () => true,
  log = () => {},
}: {
  providers: Providers;
  settings: { values(): Settings; change(changes: Partial<Settings>): unknown };
  /** Whether saved keys are encrypted by the OS (not on Linux with no keyring). */
  encrypted?: () => boolean;
  /** Where each check is recorded, with its provider and model and never a key. */
  log?: (entry: CheckLogEntry) => void;
}) {
  const providers = loggingChecks(unlogged, log);
  const servers = serverConnections({ providers, settings, encrypted });
  const chooser = {
    /** The candidate's own servers: list, add, edit (each checked first). */
    servers,

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

    /**
     * Adds a model to your models once it answers, saving the address or key it was reached with, and picks it
     * for its slot. With no slot (a connection added in Settings), it's the interviewer's only if none is picked.
     */
    async connect(request: unknown): Promise<ConnectResult> {
      if (!isModelConnection(request)) return { ok: false, error: "That model can't be picked." };
      const { slot, provider, model, key, address, server } = request;
      const choice: ModelChoice = provider === 'server' ? { provider, server, model } : { provider, model };
      const onServer = provider === 'server' ? settings.values().servers.find((each) => each.id === server) : undefined;
      if (provider === 'server' && !onServer) return { ok: false, error: 'That server has been removed.' };
      try {
        await providers.check(choice, { address, key });
      } catch (error) {
        const kind = modelErrorKind(error);
        return { ok: false, error: onServer ? plainServerError(kind, { ...onServer, model }, error, 'check') : plainError(kind, request, error) };
      }
      const savesKey = !!key && isKeyProvider(provider);
      if (savesKey) await providers.saveKey(provider, key);
      const unencryptedNote = savesKey && !encrypted() && !settings.values().unencryptedLoginNoted;
      settings.change({
        ...(address && hasAddress(provider) ? { [addressSettings[provider]]: address } : {}),
        ...settingsAfterAdding(settings.values(), choice, slot),
        ...(unencryptedNote ? { unencryptedLoginNoted: true } : {}),
      });
      return { ok: true, unencryptedNote };
    },

    /**
     * After signing in to ChatGPT: its default model is checked like any other, and joins your models (and the
     * interviewer, if none is picked) only once it answers. If it doesn't, the sign-in stays and the reason is given.
     */
    async afterSignIn(): Promise<{ ok: true } | { ok: false; error: string }> {
      const added = await chooser.connect({ provider: 'chatgpt', model: defaultChatGPTModel });
      return added.ok ? { ok: true } : added;
    },

    /**
     * Replaces a provider's saved key once `model` answers through the new one. Your models and both picks
     * stay as they are; a refused key leaves the old one.
     */
    async replaceKey(request: unknown): Promise<ConnectResult> {
      if (!isKeyReplacement(request)) return { ok: false, error: "That key can't be saved." };
      const { provider, model, key } = request;
      try {
        await providers.check({ provider, model }, { key });
      } catch (error) {
        return { ok: false, error: plainError(modelErrorKind(error), request, error) };
      }
      await providers.saveKey(provider, key);
      const unencryptedNote = !encrypted() && !settings.values().unencryptedLoginNoted;
      if (unencryptedNote) settings.change({ unencryptedLoginNoted: true });
      return { ok: true, unencryptedNote };
    },

    /** Takes a model off your models, and unpicks it wherever it was picked. */
    removeModel(model: unknown) {
      if (!isModelChoice(model)) return;
      settings.change(settingsAfterRemoving(settings.values(), model));
    },

    /** Forgets a provider's login or key, and removes its models from your models. For a server, `server` says which; it goes too. */
    async removeConnection(provider: unknown, server?: unknown) {
      // Ollama has nothing to forget.
      if (!isProviderName(provider) || provider === 'ollama') return;
      if (provider === 'server') return servers.remove(server);
      await providers.logout(provider);
      settings.change(settingsAfterLogout(settings.values(), provider));
    },
  };
  return chooser;
}

/** Why a model didn't answer, or its models couldn't be listed, in words for the candidate. Never repeats a key. */
function plainError(kind: ModelErrorKind, { provider, model, key, address }: { provider: ProviderName; model?: string } & Connection, error: unknown) {
  const name = providerNames[provider];
  const it = model ?? 'The model';
  switch (kind) {
    case 'offline':
      if (provider === 'ollama') {
        return `Ollama isn't running at ${address ?? 'its address'}. Open the Ollama app, or run "ollama serve" in a terminal, then try again.`;
      }
      return `Couldn't reach ${name}. Check your connection and try again.`;
    case 'auth':
      if (provider === 'chatgpt') return 'Your ChatGPT login has run out. Sign in again.';
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
