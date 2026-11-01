import { Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import type { ProviderStatus, Slot } from '../../../shared/api.ts';
import { choiceFromKey, feedbackModel, type ModelChoice, modelKey } from '../../../shared/settings.ts';
import { AddList, PickedHead } from '../models/AddList.tsx';
import { type AddableItem, addable } from '../models/addable.ts';
import { ModelSetup } from '../models/ModelSetup.tsx';
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
  /**
   * The well open below the connections: what can be added, then the picked item's fields; or, to replace
   * a key, that provider's fields alone.
   */
  const [setup, setSetup] = useState<{ item: AddableItem | null; replacing?: boolean } | null>(null);
  const interviewerId = useId();
  const feedbackId = useId();
  const addId = useId();
  /** "Add a model…" open, and the slot it was opened from. */
  const [adding, setAdding] = useState<Slot | null>(null);

  // Picked models arrive through settings; the connections may have changed with them.
  useEffect(refresh, [refresh, settings.interviewerModel, settings.feedbackModel, settings.yourModels, settings.serverAddress, settings.ollamaAddress]);

  if (!providers.length) return null;

  const connected = providers.filter((p) => p.connected);
  // Ollama is always listed, running or not; a saved server stays listed while it's down, so it can be removed.
  const listed = providers.filter((p) => p.provider === 'ollama' || p.connected || (p.provider === 'server' && settings.serverAddress));

  const grader = feedbackModel(settings);
  const graderKey = grader && modelKey(grader);
  const markedSmall = graderKey !== null && settings.smallModels.includes(graderKey);

  /** Picking one of your models needs no check: it answered when it was added. */
  const pick = (slot: Slot, key: string) => {
    if (slot === 'feedback' && !key) return change({ feedbackModel: null });
    const choice = choiceFromKey(key);
    if (choice) change(slot === 'interviewer' ? { interviewerModel: choice } : { feedbackModel: choice });
  };

  const remove = async (provider: ProviderStatus['provider']) => {
    await window.harness.models.logout(provider);
    refresh();
  };

  const removeModel = (key: string) => {
    const choice = choiceFromKey(key);
    if (choice) void window.harness.models.removeModel(choice);
  };

  /** Your models, grouped by the connection each comes from, in the order they were added. */
  const yours = groupByConnection(settings.yourModels, providers);
  const addModel = (slot: Slot) => ({
    label: 'Add a model…',
    onPick: () => {
      picking.reset();
      setAdding(slot);
    },
  });
  /** Every connection's models that aren't yours yet: what "Add a model…" searches. */
  const catalog: PickerGroup[] = connected
    .map((p) => ({
      label: p.name,
      options: p.models
        .filter((m) => !settings.yourModels.some((y) => y.provider === p.provider && y.model === m.id))
        .map((m) => ({ value: modelKey({ provider: p.provider, model: m.id }), label: m.name })),
    }))
    .filter((g) => g.options.length);
  const add = async (key: string) => {
    const choice = choiceFromKey(key);
    if (choice && adding && (await picking.connect({ slot: adding, ...choice }))) setAdding(null);
  };

  return (
    <>
      <div className="settings-row">
        <label htmlFor={interviewerId}>Interviewer model</label>
        <Picker
          id={interviewerId}
          value={settings.interviewerModel ? modelKey(settings.interviewerModel) : ''}
          groups={yours}
          placeholder="None"
          disabled={picking.step.name === 'checking'}
          action={addModel('interviewer')}
          onRemove={removeModel}
          onChange={(key) => pick('interviewer', key)}
        />
      </div>

      <div className="settings-row">
        <label htmlFor={feedbackId}>Feedback model</label>
        <Picker
          id={feedbackId}
          value={settings.feedbackModel ? modelKey(settings.feedbackModel) : ''}
          options={[{ value: '', label: 'Same as interviewer' }]}
          groups={yours}
          disabled={picking.step.name === 'checking'}
          action={addModel('feedback')}
          onRemove={removeModel}
          onChange={(key) => pick('feedback', key)}
        />
      </div>
      {adding && (
        <div className="add-model" role="group" aria-label="Add a model">
          <div className="add-model-head">
            <p className="settings-hint">
              {catalog.length
                ? `Search every connection's models. The one you pick is checked to answer, then added to your models as the ${adding === 'interviewer' ? 'interviewer' : 'Feedback'} model.`
                : 'Every model your connections offer is already yours. Add a connection below for more.'}
            </p>
            <button type="button" onClick={() => setAdding(null)}>
              Cancel
            </button>
          </div>
          {catalog.length > 0 && (
            <div className="settings-row">
              <label htmlFor={addId}>Model</label>
              <Picker
                id={addId}
                value=""
                groups={catalog}
                placeholder="Choose a model"
                defaultOpen
                disabled={picking.step.name === 'checking'}
                onChange={(key) => void add(key)}
              />
            </div>
          )}
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
        </div>
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
            <button type="button" className="primary with-icon" data-motion="grow" onClick={() => setSetup({ item: null })}>
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
                      <button type="button" onClick={() => setSetup({ item: addable.find((item) => item.provider === p.provider) ?? null, replacing: true })}>
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
          <div className="connections-setup" role="group" aria-label={setup.replacing ? 'Replace the key' : 'Add a connection'}>
            {setup.item ? (
              <>
                {/* Cancel goes back to the list, or closes the well when it opened on one key to replace. */}
                <PickedHead item={setup.item} onCancel={() => setSetup(setup.replacing ? null : { item: null })} />
                <p className="settings-hint">
                  {setup.replacing ? 'Paste the new key. ' : ''}The model you check here becomes the interviewer's model.
                </p>
                <ModelSetup
                  key={setup.item.id}
                  item={setup.item}
                  onDone={() => {
                    setSetup(null);
                    refresh();
                  }}
                />
              </>
            ) : (
              <>
                <div className="connections-setup-head">
                  <p className="settings-hint">Pick what to add, or search for it by name.</p>
                  <button type="button" onClick={() => setSetup(null)}>
                    Cancel
                  </button>
                </div>
                <AddList items={addable} onPick={(item) => setSetup({ item })} />
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Your models as picker groups, one per connection, each model named as its connection lists it
 * (its id while the connection is down).
 */
function groupByConnection(models: ModelChoice[], providers: ProviderStatus[]): PickerGroup[] {
  const groups: PickerGroup[] = [];
  for (const choice of models) {
    const from = providers.find((p) => p.provider === choice.provider);
    const label = from?.name ?? choice.provider;
    const option = { value: modelKey(choice), label: from?.models.find((m) => m.id === choice.model)?.name ?? choice.model };
    const group = groups.find((g) => g.label === label);
    if (group) group.options.push(option);
    else groups.push({ label, options: [option] });
  }
  return groups;
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
