import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import { defaultChatGPTModel, defaultModels } from '@interviewharness/providers/defaults';
import { useSettings } from '../settings/settings.tsx';
import { Picker } from '../ui/Picker.tsx';
import { RefreshButton, useRefresh } from '../ui/RefreshButton.tsx';
import { AddList, PickedHead } from './AddList.tsx';
import { type AddableItem, addable } from './addable.ts';
import { useChatGPTLogin } from './useChatGPTLogin.ts';
import { useConnect } from './useConnect.ts';
import { useServerSetup } from './useServerSetup.tsx';
import type { Server } from '../../../shared/settings.ts';
import './models.css';

/** The three ways the interviewer can get a model, as the Start screen's rows show them. */
type Way = 'chatgpt' | 'ollama' | 'key';

/** Asks for a key or a server: what the API key row lists. */
const asksForKey = (item: AddableItem) => item.fields === 'key' || item.fields === 'server';
const keysAndServers = addable.filter(asksForKey);

/** The row an item's fields belong to. */
const wayOf = (item: AddableItem): Way => (item.fields === 'sign-in' ? 'chatgpt' : item.fields === 'running' ? 'ollama' : 'key');

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
  editing,
  onDone,
  onUnencrypted,
}: {
  /** Show only this item's fields. */
  item?: AddableItem;
  /** With a server `item`: the saved server to edit. */
  editing?: Server;
  /** After a model is saved or a login comes back. */
  onDone?: () => void;
  /** A login or key was saved without encryption on this machine, which is said once. */
  onUnencrypted?: () => void;
}) {
  const { settings } = useSettings();
  const ids = { way: useId(), chatgptModel: useId(), ollamaModel: useId(), ollamaAddress: useId(), key: useId(), model: useId() };
  const [way, setWay] = useState<Way | null>(item ? wayOf(item) : null);
  const login = useChatGPTLogin({ onUnencrypted });
  const check = useConnect({ onUnencrypted });
  const serverSetup = useServerSetup({ server: editing, onDone, onUnencrypted });

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

  // A key or a server, once one is picked: a cloud provider's models are known without a key; a server's
  // once its address is in (its fields are useServerSetup's).
  const [keyItem, setKeyItem] = useState<AddableItem | null>(item && asksForKey(item) ? item : null);
  const [key, setKey] = useState('');
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

  const open = (next: Way) => {
    setWay(next);
    check.reset();
  };
  const pickKey = (next: AddableItem | null) => {
    setKeyItem(next);
    setKey('');
    check.reset();
    serverSetup.reset();
  };

  // A server checks and saves through its own setup; everything else through `check`.
  const checkStep = way === 'key' && server ? serverSetup.step : check.step;
  const busy = checkStep.name === 'checking' || login.step.name === 'waiting';
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
        : way === 'key' && server
          ? serverSetup.action
          : way === 'key'
            ? {
                label: 'Check and save',
                ready: !!provider && !!keyModel && !!key.trim(),
                run: async () => {
                  if (!provider) return;
                  if (await check.connect({ slot: 'interviewer', provider, model: keyModel, key })) onDone?.();
                },
              }
            : null;
  const checkingModel = way === 'chatgpt' ? chatgptModel : way === 'ollama' ? ollamaModel : server ? serverSetup.checking : keyModel;

  const chatgptDescription = chatgpt.signedIn ? 'Signed in · uses your ChatGPT plan.' : 'Uses your ChatGPT plan. Signs in through your browser.';
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

  const keyFields = server ? (
    serverSetup.fields
  ) : (
    <>
      <div className="model-setup-field">
        <label htmlFor={ids.key}>API key</label>
        <input id={ids.key} type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} />
      </div>
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
            {checkStep.name === 'checking' && (
              <p className="model-setup-status" role="status">
                Checking that {checkingModel} answers…
              </p>
            )}
            {(checkStep.name === 'failed' || login.step.name === 'failed') && (
              <p className="model-setup-status" role="alert">
                {checkStep.name === 'failed' ? checkStep.error : login.step.name === 'failed' ? login.step.error : ''}
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
