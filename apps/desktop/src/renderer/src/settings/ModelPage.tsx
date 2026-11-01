import { useCallback, useEffect, useId, useState } from 'react';
import type { ProviderStatus, Slot } from '../../../shared/api.ts';
import { choiceFromKey, feedbackModel, type ModelChoice, modelKey } from '../../../shared/settings.ts';
import { type KeyProvider, ModelSetup } from '../models/ModelSetup.tsx';
import { useConnect } from '../models/useConnect.ts';
import { useSettings } from './settings.tsx';

/**
 * Settings → Model: which model interviews and which writes the Feedback, then where models come from
 * (a ChatGPT login, Ollama, keys, a server). A model picked here is checked to answer first.
 */
export function ModelPage() {
  const { settings, change } = useSettings();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const refresh = useCallback(() => void window.harness.models.providers().then(setProviders), []);
  const picking = useConnect();
  /** The setup open below the connections: to add one, or to replace a key. */
  const [setup, setSetup] = useState<{ provider?: KeyProvider } | null>(null);
  const interviewerId = useId();
  const feedbackId = useId();

  // Picked models arrive through settings; the connections may have changed with them.
  useEffect(refresh, [refresh, settings.interviewerModel, settings.feedbackModel, settings.serverAddress, settings.ollamaAddress]);

  if (!providers.length) return null;

  const connected = providers.filter((p) => p.connected);
  // Ollama is always listed, running or not; a saved server stays listed while it's down, so it can be removed.
  const listed = providers.filter((p) => p.provider === 'ollama' || p.connected || (p.provider === 'server' && settings.serverAddress));

  const grader = feedbackModel(settings);
  const graderKey = grader && modelKey(grader);
  const markedSmall = graderKey !== null && settings.smallModels.includes(graderKey);

  const pick = (slot: Slot, key: string) => {
    if (slot === 'feedback' && !key) return change({ feedbackModel: null });
    const choice = choiceFromKey(key);
    if (choice) void picking.connect({ slot, ...choice });
  };

  const remove = async (provider: ProviderStatus['provider']) => {
    await window.harness.models.logout(provider);
    refresh();
  };

  /** Every connected provider's models, grouped by provider; the one in use stays listed even if its provider isn't. */
  const options = (current: ModelChoice | null) => (
    <>
      {current && !connected.some((p) => p.provider === current.provider && p.models.some((m) => m.id === current.model)) && (
        <option value={modelKey(current)}>{current.model}</option>
      )}
      {connected.map((p) => (
        <optgroup key={p.provider} label={p.name}>
          {p.models.map((m) => (
            <option key={m.id} value={modelKey({ provider: p.provider, model: m.id })}>
              {m.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );

  return (
    <>
      <div className="settings-row">
        <label htmlFor={interviewerId}>Interviewer model</label>
        <select
          id={interviewerId}
          value={settings.interviewerModel ? modelKey(settings.interviewerModel) : ''}
          disabled={!connected.length || picking.step.name === 'checking'}
          onChange={(event) => pick('interviewer', event.target.value)}
        >
          {!settings.interviewerModel && <option value="">None</option>}
          {options(settings.interviewerModel)}
        </select>
      </div>

      <div className="settings-row">
        <label htmlFor={feedbackId}>Feedback model</label>
        <select
          id={feedbackId}
          value={settings.feedbackModel ? modelKey(settings.feedbackModel) : ''}
          disabled={!connected.length || picking.step.name === 'checking'}
          onChange={(event) => pick('feedback', event.target.value)}
        >
          <option value="">Same as interviewer</option>
          {options(settings.feedbackModel)}
        </select>
      </div>
      {picking.step.name === 'checking' && (
        <p className="settings-hint" role="status">
          Checking that the model answers…
        </p>
      )}
      {picking.step.name === 'failed' && (
        <p className="settings-hint" role="alert">
          {picking.step.error}
        </p>
      )}

      <label className="settings-row">
        <span>Treat the Feedback model as small</span>
        <input
          type="checkbox"
          role="switch"
          checked={markedSmall}
          disabled={!graderKey}
          onChange={(event) =>
            graderKey &&
            change({
              smallModels: event.target.checked
                ? [...settings.smallModels, graderKey]
                : settings.smallModels.filter((key) => key !== graderKey),
            })
          }
        />
      </label>
      <p className="settings-hint">
        Feedback from a small model is marked rough. A model counts as small when it runs on this computer with fewer than
        14 billion parameters, or when you mark it here.
      </p>

      <section className="connections" aria-labelledby="connections-title">
        <h3 id="connections-title" className="settings-heading">
          Connections
        </h3>
        <ul className="connections-list">
          {listed.map((p) => (
            <li key={p.provider} className="connection">
              <span className="connection-name">{p.provider === 'chatgpt' ? 'ChatGPT' : p.provider === 'server' ? 'Server' : p.name}</span>
              <span className="connection-state">{connectionState(p, settings.serverAddress)}</span>
              <span className="connection-actions">
                {p.provider === 'ollama' ? (
                  <button type="button" onClick={refresh}>
                    Look again
                  </button>
                ) : (
                  <>
                    {p.provider !== 'chatgpt' && p.provider !== 'server' && (
                      <button type="button" onClick={() => setSetup({ provider: p.provider as KeyProvider })}>
                        Replace
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(p.provider)}>
                      {p.provider === 'chatgpt' ? 'Sign out' : 'Remove'}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        {setup ? (
          <div className="connections-setup">
            <ModelSetup
              start={setup.provider ? 'key' : undefined}
              provider={setup.provider}
              onDone={() => {
                setSetup(null);
                refresh();
              }}
            />
            <button type="button" className="connections-cancel" onClick={() => setSetup(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="connections-add" onClick={() => setSetup({})}>
            Add a connection
          </button>
        )}
        <p className="settings-hint">A model you add becomes the interviewer's model.</p>
      </section>
    </>
  );
}

/** A connection's state in a few words. */
function connectionState(p: ProviderStatus, serverAddress: string) {
  switch (p.provider) {
    case 'chatgpt':
      return 'Signed in';
    case 'ollama':
      return p.connected ? `Running · ${p.models.length} ${p.models.length === 1 ? 'model' : 'models'}` : 'Not running';
    case 'server':
      return p.connected ? serverAddress : `Not answering at ${serverAddress}`;
    default:
      return 'Key saved';
  }
}
