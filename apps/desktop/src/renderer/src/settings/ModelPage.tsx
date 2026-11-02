import { Plus, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ProviderStatus, Slot } from '../../../shared/api.ts';
import { checkModel, choiceFromKey, feedbackModel, type ModelChoice, modelKey, type Server, withEffort } from '../../../shared/settings.ts';
import { AddList, PickedHead } from '../models/AddList.tsx';
import { Reasoning } from '../models/Reasoning.tsx';
import { type AddableItem, addable } from '../models/addable.ts';
import { ModelSetup } from '../models/ModelSetup.tsx';
import { ProviderIcon } from '../models/ProviderIcon.tsx';
import { useConnect } from '../models/useConnect.ts';
import { IconButton, iconProps } from '../ui/IconButton.tsx';
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
  const [setup, setSetup] = useState<{ item: AddableItem | null; replacing?: boolean; editing?: Server } | null>(null);
  const interviewerId = useId();
  const feedbackId = useId();
  const checkId = useId();
  const addId = useId();
  /** "Add a model…" open, and the slot it was opened from. */
  const [adding, setAdding] = useState<Slot | null>(null);

  // Picked models arrive through settings; the connections may have changed with them.
  useEffect(refresh, [refresh, settings.interviewerModel, settings.feedbackModel, settings.yourModels, settings.servers, settings.ollamaAddress]);

  if (!providers.length) return null;

  const connected = providers.filter((p) => p.connected);
  // Ollama is always listed, running or not; a saved server stays listed while it's down, so it can be edited or removed.
  const listed = providers.filter((p) => p.provider === 'ollama' || p.connected || p.server);

  const grader = feedbackModel(settings);
  const checker = checkModel(settings);
  const graderKey = grader && modelKey(grader);
  const markedSmall = graderKey !== null && settings.smallModels.includes(graderKey);

  /** Picking one of your models needs no check: it answered when it was added. */
  const pick = (slot: Slot, key: string) => {
    if (slot === 'feedback' && !key) return change({ feedbackModel: null });
    if (slot === 'check' && !key) return change({ checkModel: null });
    const choice = choiceFromKey(key);
    if (choice) change(slot === 'interviewer' ? { interviewerModel: choice } : slot === 'feedback' ? { feedbackModel: choice } : { checkModel: choice });
  };

  const remove = async (p: ProviderStatus) => {
    await window.harness.models.logout(p.provider, p.server?.id);
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
        .filter((m) => !settings.yourModels.some((y) => isFrom(p, y) && y.model === m.id))
        .map((m) => ({ value: modelKey({ provider: p.provider, model: m.id, ...(p.server ? { server: p.server.id } : {}) }), label: m.name, icon: <ProviderIcon provider={p.provider} /> })),
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
        {settings.interviewerModel && <Reasoning label="Interviewer reasoning" hideLabel className="model-effort" model={withEffort(settings, settings.interviewerModel)} />}
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
        {grader && <Reasoning label="Feedback reasoning" hideLabel className="model-effort" model={withEffort(settings, grader)} />}
      </div>

      <div className="settings-row">
        <label htmlFor={checkId}>Reply check model</label>
        <Picker
          id={checkId}
          value={settings.checkModel ? modelKey(settings.checkModel) : ''}
          options={[{ value: '', label: 'Same as interviewer' }]}
          groups={yours}
          disabled={picking.step.name === 'checking'}
          action={addModel('check')}
          onRemove={removeModel}
          onChange={(key) => pick('check', key)}
        />
        {checker && <Reasoning label="Reply check reasoning" hideLabel className="model-effort" model={withEffort(settings, checker)} />}
      </div>
      <p className="settings-hint">Checks the interviewer's words for help you didn't ask for before they're said. Uses the interviewer's model unless you pick another.</p>
      {adding && (
        <div className="add-model" role="group" aria-label="Add a model">
          <div className="add-model-head">
            <p className="settings-hint">
              {catalog.length
                ? `Search every connection's models. The one you pick is checked to answer, then added to your models as the ${slotNames[adding]} model.`
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
            <li key={p.server?.id ?? p.provider} className="connection">
              <span className="connection-name">
                <ProviderIcon provider={p.provider} />
                {p.provider === 'chatgpt' ? 'ChatGPT' : p.name}
              </span>
              {/* Keyed by what it says, so a new state fades in after a refresh. */}
              <span className="connection-state" key={looking.refreshing && answers(p) ? 'looking' : connectionState(p)}>
                {looking.refreshing && answers(p) ? 'Looking…' : connectionState(p)}
              </span>
              <span className="connection-actions">
                {answers(p) && <RefreshButton refreshing={looking.refreshing} onClick={() => void looking.run()} />}
                {p.provider !== 'ollama' && (
                  <>
                    {p.server && (
                      <button type="button" onClick={() => setSetup({ item: addable.find((item) => item.fields === 'server') ?? null, editing: p.server })}>
                        Edit
                      </button>
                    )}
                    {p.provider !== 'chatgpt' && p.provider !== 'server' && !p.signedIn && (
                      <button type="button" onClick={() => setSetup({ item: addable.find((item) => item.provider === p.provider) ?? null, replacing: true })}>
                        Replace
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(p)}>
                      {p.provider === 'chatgpt' || p.signedIn ? 'Sign out' : 'Remove'}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        <SetupDialog
          open={!!setup}
          title={setup?.editing ? 'Edit the server' : setup?.replacing ? 'Replace the key' : 'Add a connection'}
          onClose={() => setSetup(null)}
        >
          {setup &&
            (setup.item ? (
              <>
                {/* Back goes to the list, or closes the dialog when it opened on one connection to change. */}
                <PickedHead
                  item={setup.editing ? { ...setup.item, name: setup.editing.name } : setup.item}
                  leave={setup.replacing || setup.editing ? 'Cancel' : 'Back'}
                  onLeave={() => setSetup(setup.replacing || setup.editing ? null : { item: null })}
                />
                <p className="settings-hint">
                  {setup.editing
                    ? 'Changes are saved once a model on the server answers; that model joins your models.'
                    : setup.replacing
                      ? "Paste the new key. It's saved once the model answers through it; your models and picks stay as they are."
                      : "The model you check here joins your models. It becomes the interviewer's model if none is picked yet."}
                </p>
                <ModelSetup
                  key={setup.editing?.id ?? setup.item.id}
                  item={setup.item}
                  editing={setup.editing}
                  replacing={setup.replacing}
                  onDone={() => {
                    setSetup(null);
                    refresh();
                  }}
                />
              </>
            ) : (
              <>
                <p className="settings-hint">Pick what to add, or search for it by name.</p>
                <AddList items={addable} onPick={(item) => setSetup({ item })} />
              </>
            ))}
        </SetupDialog>
      </section>
    </>
  );
}

/**
 * Adding, editing or re-keying a connection, in its own card floating above Settings: the list of what can be
 * added, or one item's fields. Escape, the close button or a click outside it goes back to Settings.
 */
function SetupDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      // The keyboard goes to the first field (the list's search, a key), not the Close button opening picks.
      element.querySelector<HTMLElement>('.setup-dialog-body input')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="setup-dialog"
      aria-label={title}
      onClose={(event) => event.target === event.currentTarget && onClose()}
      // A click on the dimmed Settings around the card lands on the dialog itself: close, as Escape does.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="setup-dialog-card">
        <header className="setup-dialog-head">
          <h3 className="setup-dialog-title">{title}</h3>
          <IconButton label="Close" motion="turn" icon={<X {...iconProps} />} onClick={onClose} />
        </header>
        <div className="setup-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Your models as picker groups, one per connection, each model named as its connection lists it
 * (its id while the connection is down).
 */
function groupByConnection(models: ModelChoice[], providers: ProviderStatus[]): PickerGroup[] {
  const groups: PickerGroup[] = [];
  for (const choice of models) {
    const from = providers.find((p) => isFrom(p, choice));
    const label = from?.name ?? choice.provider;
    const option = { value: modelKey(choice), label: from?.models.find((m) => m.id === choice.model)?.name ?? choice.model, icon: <ProviderIcon provider={choice.provider} /> };
    const group = groups.find((g) => g.label === label);
    if (group) group.options.push(option);
    else groups.push({ label, options: [option] });
  }
  return groups;
}

const slotNames: Record<Slot, string> = { interviewer: 'Interviewer', feedback: 'Feedback', check: 'Reply check' };

/** Whether a model comes from this connection: the same provider, and for a server, the same server. */
const isFrom = (p: ProviderStatus, choice: ModelChoice) => p.provider === choice.provider && p.server?.id === choice.server;

/** Ollama and a server are connected when they answer, which can change on its own; those rows can be refreshed. */
const answers = (p: ProviderStatus) => p.provider === 'ollama' || p.provider === 'server';

const plural = (n: number) => `${n} ${n === 1 ? 'model' : 'models'}`;

/** A connection's state in a few words. */
function connectionState(p: ProviderStatus) {
  switch (p.provider) {
    case 'chatgpt':
      return 'Signed in';
    case 'ollama':
      return p.connected ? `Running · ${plural(p.models.length)}` : 'Not running';
    case 'server':
      return p.connected ? `${p.server?.address} · ${plural(p.models.length)}` : `Not answering at ${p.server?.address}`;
    default:
      return p.signedIn ? 'Signed in' : 'Key saved';
  }
}
