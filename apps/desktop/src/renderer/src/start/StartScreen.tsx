import type { RoundKind } from '@interviewharness/core';
import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { roundKinds } from '../rounds.ts';
import { useSettings } from '../settings/settings.tsx';
import { IconButton, iconProps } from '../ui/IconButton.tsx';
import { ModelStep } from './ModelStep.tsx';
import './start.css';

export function StartScreen({ onStart }: { onStart: (kind: RoundKind) => void }) {
  const { settings, setPanelOpen } = useSettings();
  // A round can't work without a model, so the first one waits for the candidate to pick one.
  const needsModel = settings.interviewerModel === null;
  const [unencryptedNote, setUnencryptedNote] = useState(false);
  return (
    <main className="start">
      <IconButton
        className="start-settings"
        label="Settings"
        motion="spin"
        tip="below-end"
        icon={<SettingsIcon {...iconProps} />}
        onClick={() => setPanelOpen(true)}
      />
      <header className="start-head">
        <h1 className="start-title">InterviewHarness</h1>
        <p className="start-lede">Mock interviews, out loud, with an interviewer that listens.</p>
      </header>
      {needsModel && <ModelStep onUnencrypted={() => setUnencryptedNote(true)} />}
      {unencryptedNote && (
        <div className="start-note" role="note" aria-label="Login not encrypted">
          <p>
            Your ChatGPT login is saved on this computer without encryption, because no password keyring (like GNOME
            Keyring or KWallet) is running. Only your user account can read the file.
          </p>
          <button type="button" onClick={() => setUnencryptedNote(false)}>
            Got it
          </button>
        </div>
      )}
      <ul className="start-rounds">
        {roundKinds.map(({ kind, label, startLabel, available }) => (
          <li key={kind}>
            <button
              type="button"
              className={available && !needsModel ? 'primary' : undefined}
              disabled={!available || needsModel}
              onClick={() => onStart(kind)}
            >
              {available ? startLabel : label}
            </button>
            {!available && <span className="label">Later</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
