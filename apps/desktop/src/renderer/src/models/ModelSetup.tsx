import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import type { ModelChoice } from '../../../shared/settings.ts';
import { useSettings } from '../settings/settings.tsx';
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
  const ids = { way: useId(), ollamaModel: useId(), ollamaAddress: useId(), provider: useId(), key: useId(), address: useId(), model: useId() };
  const [way, setWay] = useState<Way | null>(start ?? null);
  const login = useChatGPTLogin({ onUnencrypted });
  const check = useConnect({ onUnencrypted });

  // Ollama, looked for at once, so its row can say something true and be picked first when it's there.
  const [ollamaAddress, setOllamaAddress] = useState(settings.ollamaAddress);
  const [ollama, setOllama] = useState<ModelList | null>(null);
  const [ollamaModel, setOllamaModel] = useState('');
  const lookForOllama = useCallback(async (address: string) => {
    setOllama(null);
    const found = await window.harness.models.list('ollama', { address });
    setOllama(found);
    if (found.ok) setOllamaModel((picked) => (found.models.some((m) => m.id === picked) ? picked : (found.models[0]?.id ?? '')));
    return found;
  }, []);
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
      if (found.ok) setKeyModel(found.models[0]?.id ?? '');
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
      ? { label: 'Continue with ChatGPT', ready: true, run: async () => (await login.start()) && onDone?.() }
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
  const checkingModel = way === 'ollama' ? ollamaModel : keyModel;

  return (
    <form
      className="model-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (action?.ready && !busy) void action.run();
      }}
    >
      <div className="model-setup-ways" role="radiogroup" aria-label="How the interviewer gets a model">
        <Row way="chatgpt" open={way} onOpen={open} name={ids.way} title="ChatGPT" description="Uses your ChatGPT plan. Signs in through your browser." />

        <Row
          way="ollama"
          open={way}
          onOpen={open}
          name={ids.way}
          title="Ollama"
          description={
            !ollama
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
              <label className="model-setup-field" htmlFor={ids.ollamaAddress}>
                <span>Ollama address</span>
                <input id={ids.ollamaAddress} type="url" value={ollamaAddress} onChange={(event) => setOllamaAddress(event.target.value)} spellCheck={false} />
              </label>
              <button type="button" className="model-setup-aside" onClick={() => void lookForOllama(ollamaAddress)}>
                Look again
              </button>
            </>
          )}
          {ollama?.ok && !ollama.models.length && (
            <p className="model-setup-note">Ollama has no models yet. Download one with "ollama pull", then look again.</p>
          )}
          {ollama?.ok && ollama.models.length > 0 && (
            <label className="model-setup-field" htmlFor={ids.ollamaModel}>
              <span>Model</span>
              <select id={ids.ollamaModel} value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)}>
                {ollama.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Row>

        <Row way="key" open={way} onOpen={open} name={ids.way} title="API key" description="OpenAI, Anthropic, Google, OpenRouter, or another OpenAI-compatible server.">
          <label className="model-setup-field" htmlFor={ids.provider}>
            <span>Provider</span>
            <select id={ids.provider} value={provider} onChange={(event) => setProvider(event.target.value as KeyProvider)}>
              {keyProviders.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {server && (
            <label className="model-setup-field" htmlFor={ids.address}>
              <span>Server address</span>
              <input
                id={ids.address}
                type="url"
                placeholder="http://localhost:1234/v1"
                value={serverAddress}
                onChange={(event) => setServerAddress(event.target.value)}
                onBlur={() => serverAddress && void findServerModels()}
                spellCheck={false}
              />
            </label>
          )}
          <label className="model-setup-field" htmlFor={ids.key}>
            <span>{server ? 'Key, if it needs one' : 'API key'}</span>
            <input id={ids.key} type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
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
            <label className="model-setup-field" htmlFor={ids.model}>
              <span>Model</span>
              <select id={ids.model} value={keyModel} onChange={(event) => setKeyModel(event.target.value)}>
                {keyModels.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
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
