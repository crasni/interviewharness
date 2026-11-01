import './models.css';
import { useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import type { ModelChoice } from '../../../shared/settings.ts';
import { useConnect } from './useConnect.ts';

type KeyProvider = Extract<ModelChoice['provider'], 'openai' | 'anthropic' | 'google' | 'openrouter' | 'server'>;

const choices: { provider: KeyProvider; name: string }[] = [
  { provider: 'openai', name: 'OpenAI' },
  { provider: 'anthropic', name: 'Anthropic' },
  { provider: 'google', name: 'Google' },
  { provider: 'openrouter', name: 'OpenRouter' },
  { provider: 'server', name: 'Other server (LM Studio, llama.cpp, vLLM)' },
];

/**
 * An API key, or another OpenAI-compatible server: pick the provider, paste the key (or the server's
 * address, with a key if it needs one), pick a model. The model is checked to answer before anything is saved.
 */
export function KeyForm({ onConnected, onUnencrypted }: { onConnected?: () => void; onUnencrypted?: () => void }) {
  const [provider, setProvider] = useState<KeyProvider>('openai');
  const [key, setKey] = useState('');
  const [address, setAddress] = useState('');
  const [list, setList] = useState<ModelList | null>(null);
  const [model, setModel] = useState('');
  const { step, connect, reset } = useConnect({ onUnencrypted });
  const ids = { provider: useId(), key: useId(), address: useId(), model: useId() };
  const server = provider === 'server';

  // A cloud provider's models are known without a key; a server's are asked for once its address is in.
  useEffect(() => {
    setList(null);
    setModel('');
    reset();
    if (server) return;
    void window.harness.models.list(provider).then((found) => {
      setList(found);
      if (found.ok) setModel(found.models[0]?.id ?? '');
    });
  }, [provider, server, reset]);

  async function findServerModels() {
    setList(null);
    const found = await window.harness.models.list('server', { address, ...(key ? { key } : {}) });
    setList(found);
    if (found.ok) setModel(found.models[0]?.id ?? '');
  }

  const ready = !!model && (server ? !!address : !!key.trim());

  return (
    <form
      className="model-option-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready) return;
        const reach = server ? { address, ...(key ? { key } : {}) } : { key };
        if (await connect({ slot: 'interviewer', provider, model, ...reach })) onConnected?.();
      }}
    >
      <label className="model-option-field" htmlFor={ids.provider}>
        <span>Provider</span>
        <select id={ids.provider} value={provider} onChange={(event) => setProvider(event.target.value as KeyProvider)}>
          {choices.map((choice) => (
            <option key={choice.provider} value={choice.provider}>
              {choice.name}
            </option>
          ))}
        </select>
      </label>

      {server && (
        <label className="model-option-field" htmlFor={ids.address}>
          <span>Server address</span>
          <input
            id={ids.address}
            type="url"
            placeholder="http://localhost:1234/v1"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => address && void findServerModels()}
            spellCheck={false}
          />
        </label>
      )}

      <label className="model-option-field" htmlFor={ids.key}>
        <span>{server ? 'Key, if the server needs one' : 'API key'}</span>
        <input id={ids.key} type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>

      {server && !list && (
        <button type="button" disabled={!address} onClick={() => void findServerModels()}>
          Find models
        </button>
      )}

      {list && !list.ok && (
        <p className="model-option-status" role="alert">
          {list.error}
        </p>
      )}

      {list?.ok && (
        <label className="model-option-field" htmlFor={ids.model}>
          <span>Model</span>
          <select id={ids.model} value={model} onChange={(event) => setModel(event.target.value)}>
            {list.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" disabled={!ready || step.name === 'checking'}>
        {step.name === 'checking' ? 'Checking…' : 'Check and save'}
      </button>
      {step.name === 'failed' && (
        <p className="model-option-status" role="alert">
          {step.error}
        </p>
      )}
    </form>
  );
}
