import {
  type Api,
  type AssistantMessage,
  type AuthContext,
  type AuthInteraction,
  type CredentialStore,
  createModels,
  createProvider,
  type Message,
  type Model as PiModel,
  type Models,
  type ProviderAuth,
  type Tool,
  type ToolCall,
  Type,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import { ANTHROPIC_MODELS } from '@earendil-works/pi-ai/providers/anthropic.models';
import { googleProvider } from '@earendil-works/pi-ai/providers/google';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { type Model, ModelError, type ModelErrorKind, type ModelRequest } from '@interviewharness/engine';
import { type ChatGPTLoginConfig, chatgptOAuth } from './chatgpt-login.ts';
import { defaultOllamaAddress, ollamaModel, ollamaModels } from './ollama.ts';
import { adoptOldServerKey, type Server, type ServerFormat, serverCredentialId, serverModel, serverModels, serverProvider } from './servers.ts';

/** The providers the candidate can pick, in our own words. pi-ai's ids stay inside this package. */
export type ProviderName = 'chatgpt' | 'ollama' | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'server';

/** The providers reached with an API key the candidate pastes. (A server's optional key is saved per server.) */
export type KeyProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter';
export const keyProviders: readonly KeyProviderName[] = ['openai', 'anthropic', 'google', 'openrouter'];

/** Which provider and model a slot uses. Stored in settings.json; never holds a credential. */
export interface ModelChoice {
  provider: ProviderName;
  model: string;
  /** For a model on one of the candidate's servers: which server (its id). */
  server?: string;
}

export { defaultChatGPTModel } from './defaults.ts';

/**
 * The small-model rule: a model counts as small, and the Feedback it writes is marked rough, when it runs
 * on this computer with fewer than this many parameters, or when the candidate marks it so. Small local
 * models follow the interviewer's rules less reliably and grade less consistently.
 */
export const smallModelParameters = 14e9;

export interface ModelListing {
  id: string;
  name: string;
  /** Runs on this computer (Ollama and other local servers). */
  local: boolean;
  /** Counts as small (see `smallModelParameters`), so the Feedback it writes is marked rough. */
  small: boolean;
}

type PiProviderName = Exclude<ProviderName, 'ollama' | 'server'>;

/**
 * Our provider names, and the pi-ai provider each one runs on, which is also where its credential is
 * kept. An OpenAI key has its own, so it and the ChatGPT login never replace each other.
 */
const piProviderIds: Record<PiProviderName, string> = {
  chatgpt: 'openai',
  openai: 'openai-key',
  anthropic: 'anthropic',
  google: 'google',
  openrouter: 'openrouter',
};

/**
 * Auth from the key the candidate saved, and nowhere else: no environment variable, no other tool's
 * login. A server may need no key at all; local servers accept any.
 */
function savedKeyOnly(name: string, { optional = false } = {}): ProviderAuth {
  return {
    apiKey: {
      name,
      resolve: async ({ credential }) => {
        if (credential?.key) return { auth: { apiKey: credential.key }, source: 'saved key' };
        return optional ? { auth: { apiKey: 'none' }, source: 'no key' } : undefined;
      },
    },
  };
}

/** pi-ai would read keys from environment variables and other tools' files; the app uses only what the candidate entered. */
const noAmbientCredentials: AuthContext = {
  env: async () => undefined,
  fileExists: async () => false,
};

/**
 * Environment variables pi-ai and the provider SDKs read beyond its auth lookup: OPENAI_ORG_ID,
 * OPENAI_CUSTOM_HEADERS and OPENAI_LOG (which would print request bodies), PI_CACHE_RETENTION and others.
 * There's no switch for them, so they're removed from this process before any request.
 */
const ambientVariables = /^(OPENAI|PI|ANTHROPIC|GEMINI|GOOGLE|OPENROUTER)_/;

function forgetAmbientVariables() {
  for (const name of Object.keys(process.env)) if (ambientVariables.test(name)) delete process.env[name];
}

/** The id a server being added is tried under, before it's saved with one of its own. */
const newServer = 'new';

/** How to reach a provider before it's saved: an address the candidate typed, a key they pasted. */
export interface Connection {
  address?: string;
  key?: string;
  /** A server's API format, when it's new or being changed. */
  format?: ServerFormat;
  /** Which of the candidate's servers, when listing a saved one's models (or a new one's, with no id yet). */
  server?: string;
}

export interface ProvidersOptions {
  /** Where logins are kept, encrypted. */
  credentials: CredentialStore;
  /** Sent as the User-Agent, so providers see requests come from this app. */
  appVersion: string;
  /** Tests send requests to a fake server on loopback with this. */
  fetch?: typeof fetch;
  /** Tests point the ChatGPT sign-in at a fake server on loopback with this. */
  signIn?: ChatGPTLoginConfig;
  /** Where Ollama listens; the candidate can change it. */
  ollamaAddress?: () => string;
  /** The candidate's own servers (LM Studio, llama.cpp, vLLM, a gateway), each OpenAI- or Anthropic-compatible. */
  servers?: () => readonly Server[];
  /** Tests send a provider's requests to a fake server on loopback with this. */
  baseUrls?: Partial<Record<PiProviderName, string>>;
}

export interface ChatGPTLoginOptions {
  /** Opens the sign-in page in the candidate's browser. */
  openBrowser: (url: string) => void | Promise<void>;
  /** A stable UUID for this installation, which OpenAI asks for. */
  deviceId: string;
  signal?: AbortSignal;
}

/** The app's models: logging in to providers, and models that speak the engine's model interface. */
export function createProviders(options: ProvidersOptions): Providers {
  const { credentials, appVersion, fetch: fetchFn, signIn, ollamaAddress = () => defaultOllamaAddress, servers = () => [], baseUrls = {} } = options;
  forgetAmbientVariables();
  const models = createModels({
    credentials,
    authContext: noAmbientCredentials,
    identity: { userAgent: { custom: `InterviewHarness/${appVersion}` } },
  });
  // OpenAI's models and request code, with our ChatGPT sign-in as the only way in: no API key, from anywhere.
  models.setProvider({ ...openaiProvider(), auth: { oauth: chatgptOAuth(signIn) } });
  // The same models with an OpenAI API key, under their own id.
  models.setProvider(
    createProvider({
      id: piProviderIds.openai,
      name: 'OpenAI',
      auth: savedKeyOnly('OpenAI API key'),
      models: openaiProvider().getModels().map((model) => ({ ...model, provider: piProviderIds.openai })),
      api: openAIResponsesApi(),
    }),
  );
  // Our own Anthropic provider: pi-ai's registers the Claude consumer login, which this app never uses (AGENTS.md).
  models.setProvider(
    createProvider({
      id: piProviderIds.anthropic,
      name: 'Anthropic',
      auth: savedKeyOnly('Anthropic API key'),
      models: Object.values(ANTHROPIC_MODELS),
      api: anthropicMessagesApi(),
    }),
  );
  models.setProvider({ ...googleProvider(), auth: savedKeyOnly('Gemini API key') });
  // OpenRouter's own login is left out too: a pasted key is the one way in.
  models.setProvider({ ...openrouterProvider(), auth: savedKeyOnly('OpenRouter API key') });
  /** The pi-ai model for a choice, sent to a test's fake server when one is given. */
  function piModelFor(choice: ModelChoice & { provider: PiProviderName }): PiModel<Api> | undefined {
    const model = models.getModel(piProviderIds[choice.provider], choice.model);
    const baseUrl = baseUrls[choice.provider];
    return model && baseUrl ? { ...model, baseUrl } : model;
  }

  // Each server is its own pi-ai provider, so its key is looked up under its own id. Registered when first used.
  const registered = new Set<string>();
  function serverPiModel(choice: ModelChoice): PiModel<Api> | undefined {
    const server = servers().find((each) => each.id === choice.server);
    if (!server) return undefined;
    if (!registered.has(server.id)) models.setProvider(serverProvider(server.id));
    registered.add(server.id);
    return serverModel(server, choice.model);
  }

  /** A server as `connection` describes it (a saved one, maybe with a new address, format or key; or a new one), and its key. */
  async function reachServer(connection: Connection): Promise<{ server: Server; key: string | undefined }> {
    const id = connection.server ?? newServer;
    const saved = servers().find((each) => each.id === id);
    if (!saved && !connection.address) throw new ModelError('other', 'No such server');
    const server: Server = { id, name: saved?.name ?? '', address: connection.address ?? saved!.address, format: connection.format ?? saved?.format ?? 'openai' };
    const stored = connection.key?.trim() ? undefined : await credentials.read(serverCredentialId(id));
    return { server, key: connection.key?.trim() || (stored?.type === 'api_key' ? stored.key : undefined) };
  }

  /** These providers, but reaching `provider` (or server `server`) through a connection that isn't saved yet. Nothing is saved by it. */
  function withConnection(provider: ProviderName, connection: Connection = {}, server = connection.server ?? newServer): Providers {
    if (!connection.address && !connection.key && !connection.format) return providers;
    const { address, key, format } = connection;
    if (provider === 'server') {
      const saved = servers().find((each) => each.id === server);
      const tried: Server = { id: server, name: saved?.name ?? '', address: address ?? saved?.address ?? '', format: format ?? saved?.format ?? 'openai' };
      return createProviders({
        ...options,
        credentials: key ? withKey(credentials, serverCredentialId(server), key.trim()) : credentials,
        servers: () => [...servers().filter((each) => each.id !== server), tried],
      });
    }
    return createProviders({
      ...options,
      credentials: key && provider !== 'ollama' && provider !== 'chatgpt' ? withKey(credentials, piProviderIds[provider], key.trim()) : credentials,
      ollamaAddress: provider === 'ollama' && address ? () => address : ollamaAddress,
    });
  }

  const providers = {
    /**
     * "Continue with ChatGPT": opens OpenAI's sign-in in the browser and waits for it to come back
     * to a listener on this machine. The candidate never copies a code. The login is saved in `credentials`.
     */
    async loginWithChatGPT({ openBrowser, deviceId, signal }: ChatGPTLoginOptions) {
      // A browser that can't be opened ends the login at once, instead of leaving it waiting for nobody.
      const login = new AbortController();
      const stop = () => login.abort();
      if (signal?.aborted) stop();
      signal?.addEventListener('abort', stop, { once: true });
      let browserFailed: unknown;
      const interaction: AuthInteraction = {
        signal: login.signal,
        notify(event) {
          if (event.type !== 'auth_url') return;
          Promise.resolve()
            .then(() => openBrowser(event.url))
            .catch((error: unknown) => {
              browserFailed = error;
              stop();
            });
        },
        prompt: () => Promise.reject(new Error('Our sign-in never asks for typed input')),
      };
      try {
        await models.login(piProviderIds.chatgpt, 'oauth', interaction, { agentName: 'InterviewHarness', getDeviceId: () => deviceId });
      } catch (error) {
        throw browserFailed ?? error;
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    },

    /** Saves the key the candidate pasted for a provider, replacing any before it. */
    async saveKey(provider: KeyProviderName, key: string) {
      await credentials.modify(piProviderIds[provider], async () => ({ type: 'api_key', key: key.trim() }));
    },

    /** Forgets the login or key for a provider. Ollama has none; a server's key is forgotten with `forgetServer`. */
    async logout(provider: ProviderName) {
      if (provider !== 'ollama' && provider !== 'server') await models.logout(piProviderIds[provider]);
    },

    /** Whether a provider has a saved login or key. */
    async isLoggedIn(provider: ProviderName) {
      return provider !== 'ollama' && provider !== 'server' && (await credentials.read(piProviderIds[provider])) !== undefined;
    },

    /** Saves the key for one of the candidate's servers, replacing any before it. */
    async saveServerKey(server: string, key: string) {
      await credentials.modify(serverCredentialId(server), async () => ({ type: 'api_key', key: key.trim() }));
    },

    /** Forgets a server's key, if it had one. */
    async forgetServer(server: string) {
      await credentials.delete(serverCredentialId(server));
    },

    /** Moves the key v0.1 kept for its one server to `server`, the server it became. */
    async adoptOldServerKey(server: string) {
      await adoptOldServerKey(credentials, server);
    },

    /**
     * The models a provider offers: for Ollama and servers, the ones installed; for the rest, newest first.
     * A connection lists them at an address, or with a key, not saved yet; for a server, it names which one.
     */
    async listModels(provider: ProviderName, connection?: Connection): Promise<ModelListing[]> {
      if (provider === 'server') {
        const { server, key } = await reachServer(connection ?? {});
        return serverModels(server, key, fetchFn ?? fetch);
      }
      if (connection) return withConnection(provider, connection).listModels(provider);
      if (provider === 'ollama') return ollamaModels(ollamaAddress(), fetchFn ?? fetch, smallModelParameters);
      return models
        .getModels(piProviderIds[provider])
        .filter((model) => !/realtime/.test(model.id))
        .map((model) => ({ id: model.id, name: model.name, local: false, small: false }))
        .reverse();
    },

    /** A model the engine can use. Fails at request time, with a typed error, if it can't be reached. */
    model(choice: ModelChoice): Model {
      const { provider } = choice;
      if (provider === 'ollama') return ollamaModel(ollamaAddress, fetchFn ?? fetch, choice);
      if (provider === 'server') return piModel(models, () => serverPiModel(choice), choice, fetchFn);
      return piModel(models, () => piModelFor({ ...choice, provider }), choice, fetchFn);
    },

    /**
     * Asks the model for one short reply, through a connection not saved yet if given, so a typo, a
     * wrong key or a stopped server is caught before the choice is saved. Fails with a typed error; a
     * model that takes longer than `timeoutMs` (local ones may first load) fails as a timeout.
     */
    async check(choice: ModelChoice, connection?: Connection, timeoutMs = 60_000) {
      const timeout = AbortSignal.timeout(timeoutMs);
      try {
        await withConnection(choice.provider, connection, choice.server)
          .model(choice)
          .streamText({ purpose: 'setup-check', system: 'Reply with the single word OK.', messages: [{ role: 'user', text: 'Are you there?' }], maxOutputTokens: 16, signal: timeout });
      } catch (error) {
        throw timeout.aborted ? new ModelError('timeout', `No answer in ${timeoutMs / 1000} s`) : error;
      }
    },

    /** Whether a model counts as small: local and under `smallModelParameters`. A model that can't be listed doesn't. */
    async isSmall(choice: ModelChoice) {
      if (choice.provider !== 'ollama') return false;
      const listed = await providers.listModels('ollama').catch(() => []);
      return listed.some((model) => model.id === choice.model && model.small);
    },
  };
  return providers;
}

/** A credential store that holds `key` for `id`, unsaved, and the real store's credentials for the rest. */
function withKey(credentials: CredentialStore, id: string, key: string): CredentialStore {
  return {
    ...credentials,
    read: async (wanted) => (wanted === id ? { type: 'api_key', key } : credentials.read(wanted)),
    list: async () => [...(await credentials.list()).filter((each) => each.providerId !== id), { providerId: id, type: 'api_key' }],
    modify: async () => {
      throw new Error('A key being tried is not saved');
    },
  };
}

export interface Providers {
  loginWithChatGPT(options: ChatGPTLoginOptions): Promise<void>;
  saveKey(provider: KeyProviderName, key: string): Promise<void>;
  logout(provider: ProviderName): Promise<void>;
  isLoggedIn(provider: ProviderName): Promise<boolean>;
  saveServerKey(server: string, key: string): Promise<void>;
  forgetServer(server: string): Promise<void>;
  adoptOldServerKey(server: string): Promise<void>;
  listModels(provider: ProviderName, connection?: Connection): Promise<ModelListing[]>;
  model(choice: ModelChoice): Model;
  check(choice: ModelChoice, connection?: Connection, timeoutMs?: number): Promise<void>;
  isSmall(choice: ModelChoice): Promise<boolean>;
}

function piModel(models: Models, lookUp: () => PiModel<Api> | undefined, choice: ModelChoice, fetchFn: typeof fetch | undefined): Model {
  const identity = { provider: choice.provider, model: choice.model };

  function find() {
    const model = lookUp();
    if (!model) throw new ModelError('other', `Unknown model ${choice.model}`);
    return model;
  }

  /** One request, streamed to its end. Resolves with the finished message; fails with a typed error. */
  async function run(request: ModelRequest, messages: Message[], extra: { tools?: Tool[]; toolChoice?: unknown }, onText?: (delta: string) => void) {
    const model = find();
    // Resolving auth may refresh the login's token, which can fail for being offline as much as for a revoked login.
    const auth = await models.getAuth(model).catch((error: unknown) => {
      throw new ModelError(errorKind(String(error)) === 'offline' ? 'offline' : 'auth', String(error));
    });
    if (!auth) throw new ModelError('auth', 'Not logged in');
    const stream = models.stream(
      model,
      { systemPrompt: request.system, messages, tools: extra.tools },
      {
        signal: request.signal,
        // Reasoning tokens count as output, so a cap could leave a reasoning model with no words at all.
        maxTokens: model.reasoning ? undefined : request.maxOutputTokens,
        // An interviewer reply needs little thought, and every second of it is silence in the room.
        ...(model.reasoning ? { reasoningEffort: 'low' } : {}),
        ...(extra.toolChoice ? { toolChoice: extra.toolChoice } : {}),
        // A failed reply falls back to an example line at once; retrying would only stretch the silence.
        maxRetries: 0,
        fetch: fetchFn,
      } as Parameters<Models['stream']>[2],
    );
    for await (const event of stream) {
      if (event.type === 'text_delta') onText?.(event.delta);
      if (event.type === 'error') {
        throw event.reason === 'aborted' ? new ModelError('aborted') : new ModelError(errorKind(event.error.errorMessage), event.error.errorMessage);
      }
      if (event.type === 'done') return event.message;
    }
    throw new ModelError('bad-output', 'The reply ended without finishing');
  }

  const usageOf = (message: AssistantMessage) => ({ inputTokens: message.usage.input, outputTokens: message.usage.output });

  return {
    identity,

    async streamText(request, onText) {
      const message = await run(request, toPiMessages(request, find()), {}, onText);
      const text = message.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
      return { text, usage: usageOf(message) };
    },

    /**
     * pi-ai has no structured-output call, so the model is made to call one tool whose parameters are the
     * schema. The arguments are checked; on a mismatch the model is told what was wrong and asked once more.
     */
    async generateObject(request) {
      const { schema } = request;
      const tool: Tool = {
        name: schema.name,
        description: 'Give your reply by calling this tool.',
        parameters: Type.Unsafe(schema.jsonSchema),
        constrainedSampling: { type: 'json_schema', strict: 'prefer' },
      };
      const messages = toPiMessages(request, find());
      for (let tries = 0; ; tries++) {
        const message = await run(request, messages, { tools: [tool], toolChoice: forcedTool(find().api, tool.name) });
        const call = message.content.find((part): part is ToolCall => part.type === 'toolCall' && part.name === tool.name);
        try {
          if (!call) throw new Error(`Call the ${tool.name} tool to reply.`);
          return { object: schema.parse(call.arguments), usage: usageOf(message) };
        } catch (error) {
          if (tries === 1) throw new ModelError('bad-output', String(error));
          messages.push(message);
          if (call) {
            messages.push({ role: 'toolResult', toolCallId: call.id, toolName: call.name, content: [{ type: 'text', text: String(error) }], isError: true, timestamp: Date.now() });
          } else {
            messages.push({ role: 'user', content: String(error), timestamp: Date.now() });
          }
        }
      }
    },
  };
}

/** The tool choice that forces one named tool, which each API spells its own way. */
function forcedTool(api: Api, name: string): unknown {
  if (api === 'openai-responses') return { type: 'function', name };
  if (api === 'openai-completions') return { type: 'function', function: { name } };
  if (api === 'anthropic-messages') return { type: 'tool', name };
  // Google can only require some tool; there is just the one.
  return 'any';
}

/** Our messages as pi-ai's. Earlier assistant turns are labelled as the model's own, as they're only context. */
function toPiMessages(request: ModelRequest, model: { api: string; provider: string; id: string }): Message[] {
  return request.messages.map((m) =>
    m.role === 'user'
      ? { role: 'user', content: m.text, timestamp: Date.now() }
      : { role: 'assistant', content: [{ type: 'text', text: m.text }], api: model.api, provider: model.provider, model: model.id, usage: emptyUsage, stopReason: 'stop', timestamp: Date.now() },
  );
}

const emptyUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

/** What kind of failure a provider's error message describes. */
export function errorKind(message: string | undefined): ModelErrorKind {
  const text = message ?? '';
  if (/\b(401|403)\b|unauthori[sz]ed|invalid[_ ](api[_ ]key|token|grant)|not logged in/i.test(text)) return 'auth';
  if (/\b429\b|rate.?limit|too many requests|quota/i.test(text)) return 'rate-limit';
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|fetch failed|network|connection error/i.test(text)) return 'offline';
  return 'other';
}
