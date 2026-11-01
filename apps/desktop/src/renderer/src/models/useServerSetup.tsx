import { useCallback, useEffect, useId, useState } from 'react';
import type { ModelList, ServerSetup, Slot } from '../../../shared/api.ts';
import type { Server } from '../../../shared/settings.ts';
import { Picker } from '../ui/Picker.tsx';
import type { ConnectStep } from './useConnect.ts';

const formats = [
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'anthropic', label: 'Anthropic-compatible' },
] satisfies { value: Server['format']; label: string }[];

/** What each format's address looks like: OpenAI's with its /v1, Anthropic's without (it's added). */
const examples: Record<Server['format'], string> = {
  openai: 'http://localhost:1234/v1',
  anthropic: 'http://localhost:4000',
};

/** A host to name a server after until the candidate names it, e.g. "localhost:1234". */
function hostOf(address: string) {
  try {
    return new URL(address).host;
  } catch {
    return '';
  }
}

/**
 * The fields for one of the candidate's servers, and the action that checks a model on it and saves it:
 * a name, an address, its API format, a key if it needs one, and a model it lists or one typed in.
 * With `server`, edits that saved server (its key is never shown; an empty key keeps it).
 */
export function useServerSetup({
  server,
  slot,
  onDone,
  onUnencrypted,
}: {
  server?: Server;
  /** The slot a server added picks its model for; with none, the interviewer's only if none is picked yet. */
  slot?: Slot;
  onDone?: () => void;
  onUnencrypted?: () => void;
}) {
  const ids = { name: useId(), address: useId(), format: useId(), key: useId(), model: useId() };
  const [name, setName] = useState(server?.name ?? '');
  const [address, setAddress] = useState(server?.address ?? '');
  const [format, setFormat] = useState<Server['format']>(server?.format ?? 'openai');
  const [key, setKey] = useState('');
  const [listed, setListed] = useState<ModelList | null>(null);
  const [model, setModel] = useState('');
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<ConnectStep>({ name: 'idle' });

  /** Asks the server for its models with the fields as they are now. */
  const findModels = useCallback(
    async (fields: { address: string; format: Server['format']; key: string }) => {
      if (!fields.address) return;
      const found = await window.harness.models.listServer({
        ...(server ? { server: server.id } : {}),
        address: fields.address,
        format: fields.format,
        ...(fields.key ? { key: fields.key } : {}),
      });
      setListed(found);
      if (found.ok) setModel((picked) => (found.models.some((m) => m.id === picked) ? picked : (found.models[0]?.id ?? picked)));
    },
    [server],
  );
  // A saved server's models are looked for at once.
  useEffect(() => {
    if (server) void findModels({ address: server.address, format: server.format, key: '' });
  }, [server, findModels]);

  const lists = listed?.ok && listed.models.length > 0;
  const typed = typing || !lists;
  const fields = { address, format, key };

  async function run() {
    setStep({ name: 'checking' });
    const setup: ServerSetup = { name: name.trim() || hostOf(address), address: address.trim(), format, model: model.trim(), ...(key.trim() ? { key } : {}) };
    const result = server ? await window.harness.models.editServer({ ...setup, server: server.id }) : await window.harness.models.addServer({ ...setup, ...(slot ? { slot } : {}) });
    setStep(result.ok ? { name: 'idle' } : { name: 'failed', error: result.error });
    if (result.ok && result.unencryptedNote) onUnencrypted?.();
    if (result.ok) onDone?.();
  }

  const view = (
    <>
      <div className="model-setup-field">
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} type="text" value={name} placeholder={hostOf(address) || 'Home server'} onChange={(event) => setName(event.target.value)} spellCheck={false} />
      </div>
      <div className="model-setup-field">
        <label htmlFor={ids.address}>Address</label>
        <input
          id={ids.address}
          type="url"
          placeholder={examples[format]}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onBlur={() => void findModels(fields)}
          spellCheck={false}
        />
      </div>
      <div className="model-setup-field">
        <label htmlFor={ids.format}>API format</label>
        <Picker
          id={ids.format}
          value={format}
          options={formats}
          onChange={(next) => {
            setFormat(next as Server['format']);
            void findModels({ ...fields, format: next as Server['format'] });
          }}
        />
      </div>
      <div className="model-setup-field">
        <label htmlFor={ids.key}>Key, if it needs one</label>
        <input
          id={ids.key}
          type="password"
          value={key}
          placeholder={server ? 'Leave empty to keep the saved key' : ''}
          onChange={(event) => setKey(event.target.value)}
          onBlur={() => key && void findModels(fields)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {!listed && !server && (
        <button type="button" className="model-setup-aside" disabled={!address} onClick={() => void findModels(fields)}>
          Find models
        </button>
      )}
      {listed && !listed.ok && (
        <p className="model-setup-note" role="alert">
          {listed.error}
        </p>
      )}
      {listed && (
        <div className="model-setup-field">
          <label htmlFor={ids.model}>{typed ? 'Model id' : 'Model'}</label>
          {typed ? (
            <input id={ids.model} type="text" value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
          ) : (
            <Picker id={ids.model} value={model} options={listed.ok ? listed.models.map((m) => ({ value: m.id, label: m.name })) : []} onChange={setModel} />
          )}
        </div>
      )}
      {lists && (
        <button type="button" className="model-setup-aside" onClick={() => setTyping(!typing)}>
          {typing ? 'Pick from the list' : 'Type an id instead'}
        </button>
      )}
    </>
  );

  return {
    fields: view,
    step,
    reset: () => setStep({ name: 'idle' }),
    checking: model,
    action: { label: 'Check and save', ready: !!address.trim() && !!model.trim(), run },
  };
}
