import { Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import type { ProviderStatus, Slot } from '../../../shared/api.ts';
import { choiceFromKey, feedbackModel, type ModelChoice, modelKey } from '../../../shared/settings.ts';
import { type KeyProvider, ModelSetup } from '../models/ModelSetup.tsx';
import { useConnect } from '../models/useConnect.ts';
import { Picker, type PickerGroup } from '../ui/Picker.tsx';
import { RefreshButton, useRefresh } from '../ui/RefreshButton.tsx';
import { useSettings } from './settings.tsx';

/**
 * Settings → Model: which model interviews and which writes the Feedback, then where models come from
 * (a ChatGPT login, Ollama, keys, a server). A model picked here is checked to answer first.
 */
export function ModelPage() {
  const { settings, change } = useSettings();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const load = useCallback(() => window.harness.models.providers().then(setProviders), []);
  const refresh = useCallback(() => void load(), [load]);
  const looking = useRefresh(load);
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

  /** Every connected provider's models, grouped by provider. */
  const groups: PickerGroup[] = connected.map((p) => ({
    label: p.name,
    options: p.models.map((m) => ({ value: modelKey({ provider: p.provider, model: m.id }), label: m.name })),
  }));
  /** The model in use stays listed even when its provider isn't connected now. */
  const kept = (current: ModelChoice | null) =>
    current && !groups.some((g) => g.options.some((o) => o.value === modelKey(current))) ? [{ value: modelKey(current), label: current.model }] : [];

  return (
    <>
      <div className="settings-row">
        <label htmlFor={interviewerId}>Interviewer model</label>
        <Picker
          id={interviewerId}
          value={settings.interviewerModel ? modelKey(settings.interviewerModel) : ''}
          options={kept(settings.interviewerModel)}
          groups={groups}
          placeholder="None"
          disabled={!connected.length || picking.step.name === 'checking'}
          onChange={(key) => pick('interviewer', key)}
        />
      </div>

      <div className="settings-row">
        <label htmlFor={feedbackId}>Feedback model</label>
        <Picker
          id={feedbackId}
          value={settings.feedbackModel ? modelKey(settings.feedbackModel) : ''}
          options={[{ value: '', label: 'Same as interviewer' }, ...kept(settings.feedbackModel)]}
          groups={groups}
          disabled={!connected.length || picking.step.name === 'checking'}
          onChange={(key) => pick('feedback', key)}
        />
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
        <div className="connections-head">
          <h3 id="connections-title" className="settings-heading">
            Connections
          </h3>
          {!setup && (
            <button type="button" className="primary with-icon" data-motion="grow" onClick={() => setSetup({})}>
              <Plus size={14} strokeWidth={2} aria-hidden />
              Add
            </button>
          )}
        </div>
        <ul className="connections-list">
          {listed.map((p) => (
            <li key={p.provider} className="connection">
              <span className="connection-name">{p.provider === 'chatgpt' ? 'ChatGPT' : p.provider === 'server' ? 'Server' : p.name}</span>
              {/* Keyed by what it says, so a new state fades in after a refresh. */}
              <span className="connection-state" key={looking.refreshing && answers(p) ? 'looking' : connectionState(p, settings.serverAddress)}>
                {looking.refreshing && answers(p) ? 'Looking…' : connectionState(p, settings.serverAddress)}
              </span>
              <span className="connection-actions">
                {answers(p) && <RefreshButton refreshing={looking.refreshing} onClick={() => void looking.run()} />}
                {p.provider !== 'ollama' && (
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
        {setup && (
          <div className="connections-setup" role="group" aria-label={setup.provider ? 'Replace the key' : 'Add a connection'}>
            <div className="connections-setup-head">
              <p className="settings-hint">
                {setup.provider ? 'Paste the new key. ' : ''}The model you check here becomes the interviewer's model.
              </p>
              <button type="button" onClick={() => setSetup(null)}>
                Cancel
              </button>
            </div>
            <ModelSetup
              start={setup.provider ? 'key' : undefined}
              provider={setup.provider}
              onDone={() => {
                setSetup(null);
                refresh();
              }}
            />
          </div>
        )}
      </section>
    </>
  );
}

/** Ollama and a server are connected when they answer, which can change on its own; those rows can be refreshed. */
const answers = (p: ProviderStatus) => p.provider === 'ollama' || p.provider === 'server';

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
