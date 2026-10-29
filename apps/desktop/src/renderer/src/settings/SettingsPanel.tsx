import { useEffect, useId, useRef } from 'react';
import { type CodeLanguage, type Settings, type TextSize, type Theme, useSettings } from './settings.tsx';
import './settings.css';

export const languageLabels: Record<CodeLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
};

/**
 * Settings, as a sheet over whichever screen is showing. A round keeps running underneath,
 * and every change applies at once, so the candidate sees what it does.
 */
export function SettingsPanel() {
  const { settings, change, panelOpen, setPanelOpen } = useSettings();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panelOpen && !element.open) element.showModal();
    if (!panelOpen && element.open) element.close();
  }, [panelOpen]);

  return (
    <dialog
      ref={dialog}
      className="settings"
      aria-label="Settings"
      onClose={() => setPanelOpen(false)}
      // A click on the dim area around the sheet lands on the dialog itself: close, as Escape does.
      onClick={(event) => event.target === event.currentTarget && setPanelOpen(false)}
    >
      <div className="settings-sheet">
        <header className="settings-head">
          <h2 className="settings-title">Settings</h2>
          <button type="button" onClick={() => setPanelOpen(false)}>
            Close
          </button>
        </header>

        <section className="settings-group" aria-label="Room">
          <h3 className="label">Room</h3>
          <Choice<TextSize>
            legend="Text size"
            value={settings.textSize}
            options={[
              ['small', 'Small'],
              ['medium', 'Medium'],
              ['large', 'Large'],
            ]}
            onChange={(textSize) => change({ textSize })}
          />
          <Choice<Theme>
            legend="Theme"
            value={settings.theme}
            options={[
              ['system', 'System'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(theme) => change({ theme })}
          />
          <Choice<Settings['talkMode'] | 'speech'>
            legend="How you talk"
            value={settings.talkMode}
            options={[
              ['click', 'Click to talk'],
              ['speech', 'Speech detection'],
            ]}
            unavailable={{ speech: 'Arrives with the mic' }}
            onChange={() => change({ talkMode: 'click' })}
          />
          <Toggle
            label="Show the transcript when a round starts"
            checked={settings.transcriptShown}
            onChange={(transcriptShown) => change({ transcriptShown })}
          />
          <div className="settings-row">
            <span>Panel sizes</span>
            <button
              type="button"
              disabled={settings.problemWidth === null && settings.conversationHeight === null}
              onClick={() => change({ problemWidth: null, conversationHeight: null })}
            >
              Reset panel sizes
            </button>
          </div>
        </section>

        <section className="settings-group" aria-label="Editor">
          <h3 className="label">Editor</h3>
          <LanguagePicker value={settings.language} onChange={(language) => change({ language })} />
          <Toggle
            label="Autocomplete"
            checked={settings.autocomplete}
            onChange={(autocomplete) => change({ autocomplete })}
          />
          <Toggle
            label="Syntax highlighting"
            checked={settings.highlighting}
            onChange={(highlighting) => change({ highlighting })}
          />
        </section>

        <p className="settings-note label">Saved on this computer. Nothing here changes how you are judged.</p>
      </div>
    </dialog>
  );
}

/** One of a few options, shown side by side. Options not available yet are shown but can't be picked. */
function Choice<T extends string>({
  legend,
  value,
  options,
  unavailable = {},
  onChange,
}: {
  legend: string;
  value: T;
  options: [T, string][];
  unavailable?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="settings-row">
      <legend>{legend}</legend>
      <div className="choice">
        {options.map(([option, label]) => (
          <label key={option} title={unavailable[option]}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              disabled={option in unavailable}
              onChange={() => onChange(option)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function LanguagePicker({ value, onChange }: { value: CodeLanguage; onChange: (language: CodeLanguage) => void }) {
  const id = useId();
  return (
    <div className="settings-row">
      <label htmlFor={id}>Code language</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as CodeLanguage)}>
        {Object.entries(languageLabels).map(([language, label]) => (
          <option key={language} value={language}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
