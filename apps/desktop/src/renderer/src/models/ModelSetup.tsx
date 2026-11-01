import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import { defaultChatGPTModel, defaultModels } from '@interviewharness/providers/defaults';
import type { ModelChoice } from '../../../shared/settings.ts';
import { useSettings } from '../settings/settings.tsx';
import { Picker } from '../ui/Picker.tsx';
import { RefreshButton, useRefresh } from '../ui/RefreshButton.tsx';
import { useChatGPTLogin } from './useChatGPTLogin.ts';
import { useConnect } from './useConnect.ts';
import './models.css';

/** The three ways the interviewer can get a model. */
export type Way = 'chatgpt' | 'ollama' | 'key';

export type KeyProvider = Extract<ModelChoice['provider'], 'openai' | 'anthropic' | 'google' | 'openrouter' | 'server'>;

const keyProviders: { provider: KeyProvider; name: string }[] = [
  { provider: 'openai', name: 'OpenAI' },
  { provider: 'anthropic', name: 'Anthropic' },
  { provider: 'google', name: 'Google' },
  { provider: 'openrouter', name: 'OpenRouter' },
  { provider: 'server', name: 'Other server (LM Studio, llama.cpp, vLLM)' },
];

const plural = (n: number) => `${n} ${n === 1 ? 'model' : 'models'}`;

/**
 * Picking the interviewer's model: three rows (ChatGPT, Ollama, API key), one open at a time, and one
 * button that does what the open row needs: sign in, or check that the model answers and save it.
 * The row picked at first follows what's on this computer: Ollama if it's running with models.
 */
export function ModelSetup({
  start,
  provider: startProvider,
  onDone,
  onUnencrypted,
}: {
  /** The row to open first; by default, Ollama when it's running with models, else ChatGPT. */
  start?: Way;
  /** The API key row's provider to start with. */
  provider?: KeyProvider;
  /** After a model is saved or a login comes back. */
  onDone?: () => void;
  /** A login or key was saved without encryption on this machine, which is said once. */
  onUnencrypted?: () => void;
}) {
  const { settings } = useSettings();
  const ids = { way: useId(), chatgptModel: useId(), ollamaModel: useId(), ollamaAddress: useId(), provider: useId(), key: useId(), address: useId(), model: useId() };
  const [way, setWay] = useState<Way | null>(start ?? null);
  const login = useChatGPTLogin({ onUnencrypted });
  const check = useConnect({ onUnencrypted });

  // A ChatGPT login already saved: then the row offers its models instead of signing in again.
  const [chatgpt, setChatgpt] = useState<{ signedIn: boolean; models: { value: string; label: string }[] }>({ signedIn: false, models: [] });
  const [chatgptModel, setChatgptModel] = useState('');
  useEffect(() => {
    void window.harness.models.providers().then((all) => {
      const found = all.find((p) => p.provider === 'chatgpt');
      if (!found?.connected) return;
      setChatgpt({ signedIn: true, models: found.models.map((m) => ({ value: m.id, label: m.name })) });
      setChatgptModel(found.models.some((m) => m.id === defaultChatGPTModel) ? defaultChatGPTModel : (found.models[0]?.id ?? ''));
    });
  }, []);

  // Ollama, looked for at once, so its row can say something true and be picked first when it's there.
  // A second look keeps the last answer on show until the new one comes.
  const [ollamaAddress, setOllamaAddress] = useState(settings.ollamaAddress);
  const [ollama, setOllama] = useState<ModelList | null>(null);
  const [ollamaModel, setOllamaModel] = useState('');
  const lookForOllama = useCallback(async (address: string) => {
    const found = await window.harness.models.list('ollama', { address });
    setOllama(found);
    if (found.ok) setOllamaModel((picked) => (found.models.some((m) => m.id === picked) ? picked : (found.models[0]?.id ?? '')));
    return found;
  }, []);
  const ollamaRefresh = useRefresh(useCallback(() => lookForOllama(ollamaAddress), [lookForOllama, ollamaAddress]));
  useEffect(() => {
    void lookForOllama(settings.ollamaAddress).then((found) => setWay((open) => open ?? (found.ok && found.models.length ? 'ollama' : 'chatgpt')));
  }, [lookForOllama, settings.ollamaAddress]);

  // The API key row: a cloud provider's models are known without a key; a server's once its address is in.
  const [provider, setProvider] = useState<KeyProvider>(startProvider ?? 'openai');
  const [key, setKey] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [keyModels, setKeyModels] = useState<ModelList | null>(null);
  const [keyModel, setKeyModel] = useState('');
  const server = provider === 'server';
  useEffect(() => {
    setKeyModels(null);
    setKeyModel('');
    if (server) return;
    void window.harness.models.list(provider).then((found) => {
      setKeyModels(found);
      if (!found.ok) return;
      const preferred = defaultModels[provider as keyof typeof defaultModels];
      setKeyModel(found.models.some((m) => m.id === preferred) ? preferred! : (found.models[0]?.id ?? ''));
    });
  }, [provider, server]);
  async function findServerModels() {
    setKeyModels(null);
    const found = await window.harness.models.list('server', { address: serverAddress, ...(key ? { key } : {}) });
    setKeyModels(found);
    if (found.ok) setKeyModel(found.models[0]?.id ?? '');
  }

  const open = (next: Way) => {
    setWay(next);
    check.reset();
  };

  const busy = check.step.name === 'checking' || login.step.name === 'waiting';
  const action =
    way === 'chatgpt'
      ? chatgpt.signedIn
        ? {
            label: 'Use this model',
            ready: !!chatgptModel,
            run: async () => (await check.connect({ slot: 'interviewer', provider: 'chatgpt', model: chatgptModel })) && onDone?.(),
          }
        : { label: 'Continue with ChatGPT', ready: true, run: async () => (await login.start()) && onDone?.() }
      : way === 'ollama'
        ? {
            label: 'Use this model',
            ready: !!ollamaModel && !!ollama?.ok,
            run: async () => (await check.connect({ slot: 'interviewer', provider: 'ollama', model: ollamaModel, address: ollamaAddress })) && onDone?.(),
          }
        : way === 'key'
          ? {
              label: 'Check and save',
              ready: !!keyModel && (server ? !!serverAddress : !!key.trim()),
              run: async () => {
                const reach = server ? { address: serverAddress, ...(key ? { key } : {}) } : { key };
                if (await check.connect({ slot: 'interviewer', provider, model: keyModel, ...reach })) onDone?.();
              },
            }
          : null;
  const checkingModel = way === 'chatgpt' ? chatgptModel : way === 'ollama' ? ollamaModel : keyModel;

  return (
    <form
      className="model-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (action?.ready && !busy) void action.run();
      }}
    >
      <div className="model-setup-ways" role="radiogroup" aria-label="How the interviewer gets a model">
        <Row
          way="chatgpt"
          open={way}
          onOpen={open}
          name={ids.way}
          title="ChatGPT"
          description={chatgpt.signedIn ? 'Signed in · uses your ChatGPT plan.' : 'Uses your ChatGPT plan. Signs in through your browser.'}
        >
          {chatgpt.signedIn && (
            <div className="model-setup-field">
              <label htmlFor={ids.chatgptModel}>Model</label>
              <Picker id={ids.chatgptModel} value={chatgptModel} options={chatgpt.models} onChange={setChatgptModel} />
            </div>
          )}
        </Row>

        <Row
          way="ollama"
          open={way}
          onOpen={open}
          name={ids.way}
          title="Ollama"
          description={
            !ollama || ollamaRefresh.refreshing
              ? 'Looking for Ollama on this computer…'
              : ollama.ok
                ? `Running on this computer · ${plural(ollama.models.length)}`
                : "Not running on this computer"
          }
        >
          {ollama && !ollama.ok && (
            <>
              <p className="model-setup-note" role="alert">
                {ollama.error}
              </p>
              <div className="model-setup-field">
                <label htmlFor={ids.ollamaAddress}>Ollama address</label>
                <input id={ids.ollamaAddress} type="url" value={ollamaAddress} onChange={(event) => setOllamaAddress(event.target.value)} spellCheck={false} />
              </div>
              <RefreshButton className="model-setup-aside" refreshing={ollamaRefresh.refreshing} onClick={() => void ollamaRefresh.run()} />
            </>
          )}
          {ollama?.ok && !ollama.models.length && (
            <>
              <p className="model-setup-note">Ollama has no models yet. Download one with "ollama pull", then refresh.</p>
              <RefreshButton className="model-setup-aside" refreshing={ollamaRefresh.refreshing} onClick={() => void ollamaRefresh.run()} />
            </>
          )}
          {ollama?.ok && ollama.models.length > 0 && (
            <div className="model-setup-field">
              <label htmlFor={ids.ollamaModel}>Model</label>
              <Picker id={ids.ollamaModel} value={ollamaModel} options={ollama.models.map((m) => ({ value: m.id, label: m.name }))} onChange={setOllamaModel} />
            </div>
          )}
        </Row>

        <Row way="key" open={way} onOpen={open} name={ids.way} title="API key" description="OpenAI, Anthropic, Google, OpenRouter, or another OpenAI-compatible server.">
          <div className="model-setup-field">
            <label htmlFor={ids.provider}>Provider</label>
            <Picker
              id={ids.provider}
              value={provider}
              options={keyProviders.map((p) => ({ value: p.provider, label: p.name }))}
              onChange={(next) => setProvider(next as KeyProvider)}
            />
          </div>
          {server && (
            <div className="model-setup-field">
              <label htmlFor={ids.address}>Server address</label>
              <input
                id={ids.address}
                type="url"
                placeholder="http://localhost:1234/v1"
                value={serverAddress}
                onChange={(event) => setServerAddress(event.target.value)}
                onBlur={() => serverAddress && void findServerModels()}
                spellCheck={false}
              />
            </div>
          )}
          <div className="model-setup-field">
            <label htmlFor={ids.key}>{server ? 'Key, if it needs one' : 'API key'}</label>
            <input id={ids.key} type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} />
          </div>
          {server && !keyModels && (
            <button type="button" className="model-setup-aside" disabled={!serverAddress} onClick={() => void findServerModels()}>
              Find models
            </button>
          )}
          {keyModels && !keyModels.ok && (
            <p className="model-setup-note" role="alert">
              {keyModels.error}
            </p>
          )}
          {keyModels?.ok && (
            <div className="model-setup-field">
              <label htmlFor={ids.model}>Model</label>
              <Picker id={ids.model} value={keyModel} options={keyModels.models.map((m) => ({ value: m.id, label: m.name }))} onChange={setKeyModel} />
            </div>
          )}
        </Row>
      </div>

      <div className="model-setup-action">
        {login.step.name === 'waiting' ? (
          <>
            <p className="model-setup-status" role="status">
              Finish signing in in your browser…
            </p>
            <button type="button" onClick={login.cancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {check.step.name === 'checking' && (
              <p className="model-setup-status" role="status">
                Checking that {checkingModel} answers…
              </p>
            )}
            {(check.step.name === 'failed' || login.step.name === 'failed') && (
              <p className="model-setup-status" role="alert">
                {check.step.name === 'failed' ? check.step.error : login.step.name === 'failed' ? login.step.error : ''}
              </p>
            )}
            <button type="submit" className="primary" disabled={!action?.ready || busy}>
              {action?.label ?? 'Continue'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

/** One way in: a radio with its name and one line, and its fields under it while it's the open one. */
function Row({
  way,
  open,
  onOpen,
  name,
  title,
  description,
  children,
}: {
  way: Way;
  open: Way | null;
  onOpen: (way: Way) => void;
  name: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const isOpen = open === way;
  return (
    <div className="model-setup-way" data-open={isOpen}>
      <label className="model-setup-choice">
        <input type="radio" name={name} value={way} checked={isOpen} onChange={() => onOpen(way)} />
        <span className="model-setup-title">{title}</span>
        <span className="model-setup-description">{description}</span>
      </label>
      {isOpen && children && <div className="model-setup-fields">{children}</div>}
    </div>
  );
}
