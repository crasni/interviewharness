import type { Model } from '@interviewharness/engine';
import { scriptedModel } from '@interviewharness/engine/test';
import { createProviders, defaultChatGPTModel, keyProviders, type ProviderName } from '@interviewharness/providers';
import { app, type BrowserWindow, safeStorage, shell } from 'electron';
import type { LoginResult, ProviderStatus } from '../shared/api.ts';
import { feedbackModel, modelKey, type Server, type Settings, withYourModel } from '../shared/settings.ts';
import { openCredentialStore } from './credential-store.ts';
import { modelChooser, providerNames } from './model-choice.ts';
import { migratedServerId } from './server-migration.ts';

/** The only page a login may open: OpenAI's sign-in. Anything else is refused, never handed to the browser. */
const signInOrigin = 'https://auth.openai.com';
/** The only page OpenRouter's sign-in may open: its own. */
const openRouterOrigin = 'https://openrouter.ai';

/**
 * End-to-end tests set INTERVIEWHARNESS_FAKE_MODEL, so they run with no network or keys: "example-lines"
 * for the example lines as written, or a JSON script of replies (see the engine's scriptedModel).
 * Never in a packaged app. Undefined means a real model, from settings.
 */
function testModel(): Model | null | undefined {
  const script = app.isPackaged ? undefined : process.env.INTERVIEWHARNESS_FAKE_MODEL;
  if (!script) return undefined;
  if (script === 'example-lines') return null;
  try {
    return scriptedModel(JSON.parse(script)).model;
  } catch (error) {
    throw new Error(`INTERVIEWHARNESS_FAKE_MODEL is not "example-lines" or a JSON script of replies: ${String(error)}`, { cause: error });
  }
}

/** Models for the main process: logins kept encrypted by the OS, and the interviewer's model from settings. */
export function setUpModels({
  dataDir,
  settings,
  window,
}: {
  dataDir: string;
  settings: { values(): Settings; change(changes: Partial<Settings>): Settings };
  window: () => BrowserWindow | null;
}) {
  // safeStorage only works once the app is ready; nothing here touches it before a login or a round.
  const credentials = openCredentialStore(dataDir, {
    backend: () => (process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os'),
    encrypt: (text) => safeStorage.encryptStringAsync(text),
    decrypt: (data) => safeStorage.decryptStringAsync(data),
  });
  const providers = createProviders({
    credentials,
    appVersion: app.getVersion(),
    ollamaAddress: () => settings.values().ollamaAddress,
    servers: () => settings.values().servers,
  });
  const chooser = modelChooser({ providers, settings, encrypted: () => credentials.encrypted() });
  // v0.1's one server became a named server (settings v1 → v2); its key follows it, once safeStorage is ready.
  const oldServerKeyMoved = settings.values().servers.some((server) => server.id === migratedServerId)
    ? app.whenReady().then(() => providers.adoptOldServerKey(migratedServerId)).catch((error: unknown) => console.error("Could not move v0.1's server key:", error))
    : Promise.resolve();
  // End-to-end tests keep away from any real Ollama on the machine running them.
  const testOllama = app.isPackaged ? undefined : process.env.INTERVIEWHARNESS_OLLAMA_ADDRESS;
  if (testOllama) settings.change({ ollamaAddress: testOllama });
  const fake = testModel();
  let login: AbortController | null = null;

  return {
    /** The model for a new round's interviewer: null says the example lines. Throws if none is picked. */
    interviewerModel(): Model | null {
      if (fake !== undefined) return fake;
      const choice = settings.values().interviewerModel;
      if (!choice) throw new Error('Pick a model before starting a round');
      return providers.model(choice);
    },

    /**
     * The model that writes the Feedback (the Feedback model, else the interviewer's), and whether it
     * counts as small, so the Feedback is marked rough. Null when there's no model to write it.
     */
    async feedbackModel(): Promise<{ model: Model; rough: boolean } | null> {
      if (fake !== undefined) return fake && { model: fake, rough: false };
      const choice = feedbackModel(settings.values());
      if (!choice) return null;
      const rough = settings.values().smallModels.includes(modelKey(choice)) || (await providers.isSmall(choice));
      return { model: providers.model(choice), rough };
    },

    async continueWithChatGPT(): Promise<LoginResult> {
      login?.abort();
      const controller = new AbortController();
      login = controller;
      try {
        await providers.loginWithChatGPT({
          deviceId: await credentials.installId(),
          signal: controller.signal,
          async openBrowser(url) {
            if (new URL(url).origin !== signInOrigin) throw new Error(`Refused to open ${new URL(url).origin}`);
            await shell.openExternal(url);
          },
        });
      } catch (error) {
        const cancelled = controller.signal.aborted;
        return { ok: false, cancelled, error: cancelled ? 'Login cancelled' : plainLoginError(error) };
      } finally {
        if (login === controller) login = null;
      }
      // The browser had the candidate's attention; bring them back to the app.
      window()?.show();
      window()?.focus();
      const unencryptedNote = !credentials.encrypted() && !settings.values().unencryptedLoginNoted;
      // Signing in is ChatGPT's check: the login works, so its default model joins your models.
      const choice = { provider: 'chatgpt', model: defaultChatGPTModel } as const;
      settings.change({
        yourModels: withYourModel(settings.values().yourModels, choice),
        interviewerModel: choice,
        ...(unencryptedNote ? { unencryptedLoginNoted: true } : {}),
      });
      return { ok: true, unencryptedNote };
    },

    cancelLogin() {
      login?.abort();
    },

    /**
     * Sign in with OpenRouter: opens OpenRouter's sign-in in the browser and resolves once it comes back,
     * with the key it issues saved. Picks no model: the candidate then picks one, checked to answer.
     * Cancelled with `cancelLogin`, like ChatGPT's.
     */
    async signInToOpenRouter(): Promise<LoginResult> {
      login?.abort();
      const controller = new AbortController();
      login = controller;
      try {
        await providers.signInToOpenRouter({
          signal: controller.signal,
          async openBrowser(url) {
            if (new URL(url).origin !== openRouterOrigin) throw new Error(`Refused to open ${new URL(url).origin}`);
            await shell.openExternal(url);
          },
        });
      } catch (error) {
        const cancelled = controller.signal.aborted;
        return { ok: false, cancelled, error: cancelled ? 'Sign-in cancelled' : plainOpenRouterError(error) };
      } finally {
        if (login === controller) login = null;
      }
      window()?.show();
      window()?.focus();
      const unencryptedNote = !credentials.encrypted() && !settings.values().unencryptedLoginNoted;
      if (unencryptedNote) settings.change({ unencryptedLoginNoted: true });
      return { ok: true, unencryptedNote };
    },

    /** Every provider: ChatGPT and keys are connected once saved; Ollama and each server once they answer. */
    async providers(): Promise<ProviderStatus[]> {
      const names: ProviderName[] = ['chatgpt', 'ollama', ...keyProviders];
      const rows = await Promise.all(
        names.map(async (provider): Promise<ProviderStatus> => {
          const name = providerNames[provider];
          if (provider === 'ollama') {
            const listed = await chooser.list(provider);
            return listed.ok ? { provider, name, connected: true, models: listed.models } : { provider, name, connected: false, models: [], error: listed.error };
          }
          const connected = await providers.isLoggedIn(provider);
          const signedIn = connected && (await providers.isSignedIn(provider));
          return { provider, name, connected, ...(signedIn ? { signedIn } : {}), models: connected ? await providers.listModels(provider) : [] };
        }),
      );
      await oldServerKeyMoved;
      return [...rows, ...(await Promise.all(settings.values().servers.map((server) => serverStatus(chooser, server))))];
    },

    list: chooser.list,
    connect: chooser.connect,
    logout: chooser.removeConnection,
    removeModel: chooser.removeModel,
    listServer: chooser.servers.list,
    addServer: chooser.servers.add,
    editServer: chooser.servers.edit,
  };
}

/** One of the candidate's servers as a connection: connected while it answers with its models. */
async function serverStatus(chooser: ReturnType<typeof modelChooser>, server: Server): Promise<ProviderStatus> {
  const listed = await chooser.servers.list({ server: server.id });
  const row = { provider: 'server' as const, name: server.name, server };
  return listed.ok ? { ...row, connected: true, models: listed.models } : { ...row, connected: false, models: [], error: listed.error };
}

/** A login error in words for the candidate. The raw error may quote a server's reply, so it goes no further than this. */
function plainLoginError(error: unknown) {
  const message = String(error);
  if (/port 1455 is in use/i.test(message)) {
    return 'Another app (probably the Codex CLI) is already signing in to ChatGPT. Finish or cancel that, then try again.';
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) return "Couldn't reach OpenAI. Check your connection and try again.";
  return 'ChatGPT sign-in didn\'t finish. Try again.';
}

/** An OpenRouter sign-in error in words for the candidate; the raw error may quote OpenRouter's reply. */
function plainOpenRouterError(error: unknown) {
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(String(error))) return "Couldn't reach OpenRouter. Check your connection and try again.";
  return "OpenRouter sign-in didn't finish. Try again.";
}
