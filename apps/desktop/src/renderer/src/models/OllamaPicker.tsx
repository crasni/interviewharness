import './models.css';
import { useCallback, useEffect, useId, useState } from 'react';
import type { ModelList } from '../../../shared/api.ts';
import { useSettings } from '../settings/settings.tsx';
import { useConnect } from './useConnect.ts';

/**
 * Ollama on this computer: found at its address by itself, its installed models listed to pick from.
 * When it isn't found, it says so and how to start it, and the address can be changed.
 */
export function OllamaPicker({ onConnected }: { onConnected?: () => void }) {
  const { settings } = useSettings();
  const [address, setAddress] = useState(settings.ollamaAddress);
  const [list, setList] = useState<ModelList | null>(null);
  const [model, setModel] = useState('');
  const { step, connect } = useConnect();
  const modelId = useId();
  const addressId = useId();

  const look = useCallback(async (at: string) => {
    setList(null);
    const found = await window.harness.models.list('ollama', { address: at });
    setList(found);
    if (found.ok) setModel((picked) => (found.models.some((m) => m.id === picked) ? picked : (found.models[0]?.id ?? '')));
  }, []);

  useEffect(() => void look(settings.ollamaAddress), [look, settings.ollamaAddress]);

  if (!list) {
    return (
      <p className="model-option-status" role="status">
        Looking for Ollama…
      </p>
    );
  }

  if (!list.ok) {
    return (
      <form
        className="model-option-form"
        onSubmit={(event) => {
          event.preventDefault();
          void look(address);
        }}
      >
        <p className="model-option-status" role="alert">
          {list.error}
        </p>
        <label className="model-option-field" htmlFor={addressId}>
          <span>Ollama address</span>
          <input id={addressId} type="url" value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} />
        </label>
        <button type="submit">Look again</button>
      </form>
    );
  }

  if (!list.models.length) {
    return (
      <p className="model-option-status" role="status">
        Ollama is running, but has no models yet. Download one with "ollama pull", then look again.
      </p>
    );
  }

  return (
    <form
      className="model-option-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await connect({ slot: 'interviewer', provider: 'ollama', model, address })) onConnected?.();
      }}
    >
      <p className="model-option-status">
        Running · {list.models.length} {list.models.length === 1 ? 'model' : 'models'}
      </p>
      <label className="model-option-field" htmlFor={modelId}>
        <span>Ollama model</span>
        <select id={modelId} value={model} onChange={(event) => setModel(event.target.value)}>
          {list.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={step.name === 'checking'}>
        {step.name === 'checking' ? 'Checking…' : 'Use Ollama'}
      </button>
      {step.name === 'failed' && (
        <p className="model-option-status" role="alert">
          {step.error}
        </p>
      )}
    </form>
  );
}
