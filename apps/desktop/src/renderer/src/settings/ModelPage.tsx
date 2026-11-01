import { useCallback, useEffect, useId, useState } from 'react';
import type { ProviderStatus } from '../../../shared/api.ts';
import type { Slot } from '../../../shared/api.ts';
import { choiceFromKey, feedbackModel, type ModelChoice, modelKey } from '../../../shared/settings.ts';
import { KeyForm } from '../models/KeyForm.tsx';
import { OllamaPicker } from '../models/OllamaPicker.tsx';
import { useChatGPTLogin } from '../models/useChatGPTLogin.ts';
import { useConnect } from '../models/useConnect.ts';
import { useSettings } from './settings.tsx';

/**
 * Settings → Model: what the app is connected to (a ChatGPT login, Ollama, keys, a server), then which
 * of their models the interviewer and the Feedback use. A model picked here is checked to answer first.
 */
export function ModelPage() {
  const { settings, change } = useSettings();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const refresh = useCallback(() => void window.harness.models.providers().then(setProviders), []);
  const login = useChatGPTLogin();
  const picking = useConnect();
  const [adding, setAdding] = useState<'key' | 'ollama' | null>(null);
  const interviewerId = useId();
  const feedbackId = useId();

  // Picked models arrive through settings; the connections may have changed with them.
  useEffect(refresh, [refresh, settings.interviewerModel, settings.feedbackModel, settings.serverAddress, settings.ollamaAddress]);

  if (!providers.length) return null;

  const chatgpt = providers.find((p) => p.provider === 'chatgpt')!;
  const ollama = providers.find((p) => p.provider === 'ollama')!;
  const connected = providers.filter((p) => p.connected);
  // A saved server stays listed while it's down, so it can still be removed.
  const keys = providers.filter((p) => p.provider !== 'chatgpt' && p.provider !== 'ollama' && (p.connected || p.error));

  const grader = feedbackModel(settings);
  const graderKey = grader && modelKey(grader);
  const markedSmall = graderKey !== null && settings.smallModels.includes(graderKey);

  const pick = (slot: Slot, key: string) => {
    if (slot === 'feedback' && !key) return change({ feedbackModel: null });
    const choice = choiceFromKey(key);
    if (choice) void picking.connect({ slot, ...choice });
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
      <h3 className="settings-heading">Connections</h3>

      <div className="settings-row">
        <span>{chatgpt.connected ? 'Signed in with ChatGPT' : 'ChatGPT'}</span>
        {chatgpt.connected ? (
          <button
            type="button"
            onClick={async () => {
              await window.harness.models.logout('chatgpt');
              refresh();
            }}
          >
            Log out
          </button>
        ) : login.step.name === 'waiting' ? (
          <button type="button" onClick={login.cancel}>
            Cancel sign-in
          </button>
        ) : (
          <button type="button" className="primary" onClick={async () => (await login.start()) && refresh()}>
            Continue with ChatGPT
          </button>
        )}
      </div>
      {login.step.name === 'failed' && (
        <p className="settings-hint" role="alert">
          {login.step.error}
        </p>
      )}

      <div className="settings-row">
        <span>{ollama.connected ? `Ollama · ${ollama.models.length} ${ollama.models.length === 1 ? 'model' : 'models'}` : 'Ollama · not running'}</span>
        {adding !== 'ollama' && (
          <button type="button" onClick={() => setAdding('ollama')}>
            {ollama.connected ? 'Change' : 'Set up'}
          </button>
        )}
      </div>
      {adding === 'ollama' && <OllamaPicker onConnected={() => setAdding(null)} />}

      {keys.map((p) => (
        <div key={p.provider}>
          <div className="settings-row">
            <span>{p.provider === 'server' ? `Server at ${settings.serverAddress}` : `${p.name} · key saved`}</span>
            <button
              type="button"
              onClick={async () => {
                await window.harness.models.logout(p.provider);
                refresh();
              }}
            >
              Remove
            </button>
          </div>
          {p.error && <p className="settings-hint">{p.error}</p>}
        </div>
      ))}

      {adding === 'key' ? (
        <KeyForm onConnected={() => setAdding(null)} />
      ) : (
        <div className="settings-row">
          <span>API key or other server</span>
          <button type="button" onClick={() => setAdding('key')}>
            Add
          </button>
        </div>
      )}

      <h3 className="settings-heading">Models</h3>

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
    </>
  );
}
