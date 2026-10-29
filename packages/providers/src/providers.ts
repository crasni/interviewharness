import {
  type Api,
  type AuthContext,
  type AuthInteraction,
  type CredentialStore,
  createModels,
  type Model as PiModel,
  type Models,
} from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { type Model, ModelError, type ModelErrorKind, type ModelRequest } from '@interviewharness/engine';

/** The providers the candidate can pick, in our own words. pi-ai's ids stay inside this package. */
export type ProviderName = 'chatgpt';

/** Which provider and model a slot uses. Stored in settings.json; never holds a credential. */
export interface ModelChoice {
  provider: ProviderName;
  model: string;
}

/** The ChatGPT model the interviewer uses until the candidate picks another (in Settings → Model, later). */
export const defaultChatGPTModel = 'gpt-5-mini';

/** Our provider names, and the pi-ai provider each one runs on. */
const piProviderIds: Record<ProviderName, string> = { chatgpt: 'openai' };

/** pi-ai would read keys from environment variables and other tools' files; the app uses only what the candidate entered. */
const noAmbientCredentials: AuthContext = {
  env: async () => undefined,
  fileExists: async () => false,
};

export interface ProvidersOptions {
  /** Where logins are kept, encrypted. */
  credentials: CredentialStore;
  /** Sent as the User-Agent, so providers see requests come from this app. */
  appVersion: string;
  /** Tests send requests to a fake server on loopback with this. */
  fetch?: typeof fetch;
}

export interface ChatGPTLoginOptions {
  /** Opens the sign-in page in the candidate's browser. */
  openBrowser: (url: string) => void | Promise<void>;
  /** A stable UUID for this installation, which OpenAI asks for. */
  deviceId: string;
  signal?: AbortSignal;
}

/** The app's models: logging in to providers, and models that speak the engine's model interface. */
export function createProviders({ credentials, appVersion, fetch: fetchFn }: ProvidersOptions) {
  const models = createModels({
    credentials,
    authContext: noAmbientCredentials,
    identity: { userAgent: { custom: `InterviewHarness/${appVersion}` } },
  });
  models.setProvider(openaiProvider());

  return {
    /**
     * "Continue with ChatGPT": opens OpenAI's sign-in in the browser and waits for it to come back
     * to a listener on this machine. The candidate never copies a code. The login is saved in `credentials`.
     */
    async loginWithChatGPT({ openBrowser, deviceId, signal }: ChatGPTLoginOptions) {
      const interaction: AuthInteraction = {
        signal,
        notify(event) {
          if (event.type === 'auth_url') void openBrowser(event.url);
        },
        // pi-ai also offers pasting the redirect URL by hand; the browser's redirect is the only way here.
        prompt: (prompt) =>
          new Promise<string>((_resolve, reject) => {
            prompt.signal?.addEventListener('abort', () => reject(new Error('Not needed')), { once: true });
          }),
      };
      await models.login(piProviderIds.chatgpt, 'oauth', interaction, { agentName: 'InterviewHarness', getDeviceId: () => deviceId });
    },

    /** Forgets the login for a provider. */
    logout: (provider: ProviderName) => models.logout(piProviderIds[provider]),

    /** Whether a provider has a saved login. */
    async isLoggedIn(provider: ProviderName) {
      return (await credentials.read(piProviderIds[provider])) !== undefined;
    },

    /** A model the engine can use. Fails at request time, with a typed error, if it can't be reached. */
    model(choice: ModelChoice): Model {
      return piModel(models, choice, fetchFn);
    },
  };
}

export type Providers = ReturnType<typeof createProviders>;

function piModel(models: Models, choice: ModelChoice, fetchFn: typeof fetch | undefined): Model {
  const identity = { provider: choice.provider, model: choice.model };
  const find = (): PiModel<Api> => {
    const model = models.getModel(piProviderIds[choice.provider], choice.model);
    if (!model) throw new ModelError('other', `Unknown model ${choice.model}`);
    return model;
  };

  return {
    identity,

    async streamText(request: ModelRequest, onText) {
      const model = find();
      if (!(await models.getAuth(model).catch(() => undefined))) throw new ModelError('auth', 'Not logged in');
      const stream = models.stream(
        model,
        {
          systemPrompt: request.system,
          messages: request.messages.map((m) =>
            m.role === 'user'
              ? { role: 'user', content: m.text, timestamp: Date.now() }
              : { role: 'assistant', content: [{ type: 'text', text: m.text }], api: model.api, provider: model.provider, model: model.id, usage: emptyUsage, stopReason: 'stop', timestamp: Date.now() },
          ),
        },
        {
          signal: request.signal,
          // Reasoning tokens count as output, so a cap could leave a reasoning model with no words at all.
          maxTokens: model.reasoning ? undefined : request.maxOutputTokens,
          // An interviewer reply needs little thought, and every second of it is silence in the room.
          ...(model.reasoning ? { reasoningEffort: 'low' } : {}),
          // A failed reply falls back to an example line at once; retrying would only stretch the silence.
          maxRetries: 0,
          fetch: fetchFn,
        },
      );
      for await (const event of stream) {
        if (event.type === 'text_delta') onText?.(event.delta);
        if (event.type === 'error') {
          throw event.reason === 'aborted' ? new ModelError('aborted') : new ModelError(errorKind(event.error.errorMessage), event.error.errorMessage);
        }
        if (event.type === 'done') {
          const text = event.message.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
          return { text, usage: { inputTokens: event.message.usage.input, outputTokens: event.message.usage.output } };
        }
      }
      throw new ModelError('bad-output', 'The reply ended without finishing');
    },

    async generateObject() {
      throw new ModelError('other', 'Structured replies arrive with grading and hints');
    },
  };
}

const emptyUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

/** What kind of failure a provider's error message describes. */
export function errorKind(message: string | undefined): ModelErrorKind {
  const text = message ?? '';
  if (/\b(401|403)\b|unauthori[sz]ed|invalid.*(token|key)|not logged in|oauth/i.test(text)) return 'auth';
  if (/\b429\b|rate.?limit|too many requests|quota/i.test(text)) return 'rate-limit';
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|fetch failed|network|connection error/i.test(text)) return 'offline';
  return 'other';
}
