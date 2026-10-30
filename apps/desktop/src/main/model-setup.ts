import type { Model } from '@interviewharness/engine';
import { scriptedModel } from '@interviewharness/engine/test';
import { createProviders, defaultChatGPTModel } from '@interviewharness/providers';
import { app, type BrowserWindow, safeStorage, shell } from 'electron';
import type { LoginResult, ProviderStatus } from '../shared/api.ts';
import { feedbackModel, modelKey, type Settings, settingsAfterLogout } from '../shared/settings.ts';
import { openCredentialStore } from './credential-store.ts';

/** The only page a login may open: OpenAI's sign-in. Anything else is refused, never handed to the browser. */
const signInOrigin = 'https://auth.openai.com';

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
  const providers = createProviders({ credentials, appVersion: app.getVersion() });
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
    feedbackModel(): { model: Model; rough: boolean } | null {
      if (fake !== undefined) return fake && { model: fake, rough: false };
      const choice = feedbackModel(settings.values());
      if (!choice) return null;
      // Local models under the size threshold count as small too, once there are local providers (Ollama).
      return { model: providers.model(choice), rough: settings.values().smallModels.includes(modelKey(choice)) };
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
      settings.change({
        interviewerModel: { provider: 'chatgpt', model: defaultChatGPTModel },
        ...(unencryptedNote ? { unencryptedLoginNoted: true } : {}),
      });
      return { ok: true, unencryptedNote };
    },

    cancelLogin() {
      login?.abort();
    },

    async providers(): Promise<ProviderStatus[]> {
      return [{ provider: 'chatgpt', name: 'ChatGPT', loggedIn: await providers.isLoggedIn('chatgpt'), models: providers.listModels('chatgpt') }];
    },

    async logout(provider: unknown) {
      if (provider !== 'chatgpt') return; // the renderer is not trusted to name a provider that exists
      await providers.logout(provider);
      settings.change(settingsAfterLogout(settings.values(), provider));
    },
  };
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
