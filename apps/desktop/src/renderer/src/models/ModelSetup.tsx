import { ArrowUpRight } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import { defaultChatGPTModel, defaultModels } from '@interviewharness/providers/defaults';
import { useSettings } from '../settings/settings.tsx';
import { iconProps } from '../ui/IconButton.tsx';
import { Picker } from '../ui/Picker.tsx';
import { RefreshButton, useRefresh } from '../ui/RefreshButton.tsx';
import { AddList, PickedHead } from './AddList.tsx';
import { type AddableItem, addable } from './addable.ts';
import { type SignInProvider, useSignIn } from './useSignIn.ts';
import { useConnect } from './useConnect.ts';
import './models.css';

/** The three ways the interviewer can get a model, as the Start screen's rows show them. */
type Way = 'chatgpt' | 'ollama' | 'key';

/** Asks for a key or a server: what the API key row lists. */
const asksForKey = (item: AddableItem) => item.fields === 'key' || item.fields === 'server';
const keysAndServers = addable.filter(asksForKey);

/** The row an item's fields belong to. */
const wayOf = (item: AddableItem): Way => (item.fields === 'sign-in' ? 'chatgpt' : item.fields === 'running' ? 'ollama' : 'key');

/** What a sign-in says, before and after, and the model it starts on. */
const signIns: Record<SignInProvider, { button: string; before: string; after: string; preferred: string | undefined }> = {
  chatgpt: {
    button: 'Continue with ChatGPT',
    before: 'Uses your ChatGPT plan. Signs in through your browser.',
    after: 'Signed in · uses your ChatGPT plan.',
    preferred: defaultChatGPTModel,
  },
  openrouter: {
    button: 'Sign in with OpenRouter',
    before: 'Uses your OpenRouter credits. Signs in through your browser, with no key to copy.',
    after: 'Signed in · uses your OpenRouter credits.',
    preferred: defaultModels.openrouter,
  },
};

const plural = (n: number) => `${n} ${n === 1 ? 'model' : 'models'}`;

/**
 * Picking the interviewer's model, and one button that does what's needed: sign in, or check that the
 * model answers and save it.
 * - With no `item` (the Start screen): three rows (ChatGPT, Ollama, API key), one open at a time. The row
 *   picked at first follows what's on this computer: Ollama if it's running with models. The API key row
 *   opens the list of keys and servers that can be added; picking one shows its fields.
 * - With an `item` picked from what can be added (Settings → Model): only that item's fields.
 */
export function ModelSetup({
  item,
  onDone,
  onUnencrypted,
}: {
  /** Show only this item's fields. */
  item?: AddableItem;
  /** After a model is saved or a login comes back. */
  onDone?: () => void;
  /** A login or key was saved without encryption on this machine, which is said once. */
  onUnencrypted?: () => void;
}) {
  const { settings } = useSettings();
  const ids = { way: useId(), chatgptModel: useId(), ollamaModel: useId(), ollamaAddress: useId(), key: useId(), address: useId(), model: useId() };
  const [way, setWay] = useState<Way | null>(item ? wayOf(item) : null);
  // What the sign-in row signs in to: ChatGPT, unless OpenRouter's sign-in was picked from what can be added.
  const signInProvider: SignInProvider = item?.fields === 'sign-in' && item.provider === 'openrouter' ? 'openrouter' : 'chatgpt';
  const signInCopy = signIns[signInProvider];
  const login = useSignIn({ provider: signInProvider, onUnencrypted });
  const check = useConnect({ onUnencrypted });

  // A sign-in already saved: then the row offers its models instead of signing in again.
  const [chatgpt, setChatgpt] = useState<{ signedIn: boolean; models: { value: string; label: string }[] }>({ signedIn: false, models: [] });
  const [chatgptModel, setChatgptModel] = useState('');
  const lookForSignIn = useCallback(async () => {
    const found = (await window.harness.models.providers()).find((p) => p.provider === signInProvider);
    if (!found?.signedIn) return;
    setChatgpt({ signedIn: true, models: found.models.map((m) => ({ value: m.id, label: m.name })) });
    const { preferred } = signIns[signInProvider];
    setChatgptModel(found.models.some((m) => m.id === preferred) ? preferred! : (found.models[0]?.id ?? ''));
  }, [signInProvider]);
  useEffect(() => {
    void lookForSignIn();
  }, [lookForSignIn]);

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

  // A key or a server, once one is picked: a cloud provider's models are known without a key; a server's
  // once its address is in.
  const [keyItem, setKeyItem] = useState<AddableItem | null>(item && asksForKey(item) ? item : null);
  const [key, setKey] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [keyModels, setKeyModels] = useState<ModelList | null>(null);
  const [keyModel, setKeyModel] = useState('');
  const provider = keyItem?.provider;
  const server = keyItem?.fields === 'server';
  useEffect(() => {
    setKeyModels(null);
    setKeyModel('');
    if (!provider || server) return;
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
  const pickKey = (next: AddableItem | null) => {
    setKeyItem(next);
    setKey('');
    setServerAddress('');
    check.reset();
  };

  const busy = check.step.name === 'checking' || login.step.name === 'waiting';
  const action =
    way === 'chatgpt'
      ? chatgpt.signedIn
        ? {
            label: 'Use this model',
            ready: !!chatgptModel,
            run: async () => (await check.connect({ slot: 'interviewer', provider: signInProvider, model: chatgptModel })) && onDone?.(),
          }
        : {
            label: signInCopy.button,
            ready: true,
            // ChatGPT's sign-in picks its model; OpenRouter's then offers its models to pick from.
            run: async () => (await login.start()) && (signInProvider === 'chatgpt' ? onDone?.() : await lookForSignIn()),
          }
      : way === 'ollama'
        ? {
            label: 'Use this model',
            ready: !!ollamaModel && !!ollama?.ok,
            run: async () => (await check.connect({ slot: 'interviewer', provider: 'ollama', model: ollamaModel, address: ollamaAddress })) && onDone?.(),
          }
        : way === 'key'
          ? {
              label: 'Check and save',
              ready: !!provider && !!keyModel && (server ? !!serverAddress : !!key.trim()),
              run: async () => {
                if (!provider) return;
                const reach = server ? { address: serverAddress, ...(key ? { key } : {}) } : { key };
                if (await check.connect({ slot: 'interviewer', provider, model: keyModel, ...reach })) onDone?.();
              },
            }
          : null;
  const checkingModel = way === 'chatgpt' ? chatgptModel : way === 'ollama' ? ollamaModel : keyModel;

  const chatgptDescription = chatgpt.signedIn ? signInCopy.after : signInCopy.before;
  const chatgptFields = chatgpt.signedIn && (
    <div className="model-setup-field">
      <label htmlFor={ids.chatgptModel}>Model</label>
      <Picker id={ids.chatgptModel} value={chatgptModel} options={chatgpt.models} onChange={setChatgptModel} />
    </div>
  );

  const ollamaDescription =
    !ollama || ollamaRefresh.refreshing
      ? 'Looking for Ollama on this computer…'
      : ollama.ok
        ? `Running on this computer · ${plural(ollama.models.length)}`
        : 'Not running on this computer';
  const ollamaFields = (
    <>
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
    </>
  );

  const keyFields = (
    <>
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
      {provider && !server && (
        // Main opens only this provider's key page, from the table of key providers.
        <button type="button" className="model-setup-aside with-icon" data-motion="out" onClick={() => window.harness.models.openKeyPage(provider)}>
          <ArrowUpRight {...iconProps} size={16} />
          Get a key
        </button>
      )}
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
    </>
  );

  return (
    <form
      className="model-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (action?.ready && !busy) void action.run();
      }}
    >
      {item ? (
        // One item picked from what can be added: only its fields.
        <div className="model-setup-one">
          {way === 'chatgpt' && (
            <>
              <p className="model-setup-note">{chatgptDescription}</p>
              {chatgptFields}
            </>
          )}
          {way === 'ollama' && (
            <>
              <p className="model-setup-note">{ollamaDescription}</p>
              {ollamaFields}
            </>
          )}
          {way === 'key' && keyFields}
        </div>
      ) : (
        <div className="model-setup-ways" role="radiogroup" aria-label="How the interviewer gets a model">
          <Row way="chatgpt" open={way} onOpen={open} name={ids.way} title="ChatGPT" description={chatgptDescription}>
            {chatgptFields}
          </Row>

          <Row way="ollama" open={way} onOpen={open} name={ids.way} title="Ollama" description={ollamaDescription}>
            {ollamaFields}
          </Row>

          <Row way="key" open={way} onOpen={open} name={ids.way} title="API key" description="A key from a provider like OpenAI or Anthropic, or a server of your own.">
            {keyItem ? (
              <>
                <PickedHead item={keyItem} onCancel={() => pickKey(null)} />
                {keyFields}
              </>
            ) : (
              <AddList items={keysAndServers} onPick={pickKey} />
            )}
          </Row>
        </div>
      )}

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
