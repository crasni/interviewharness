import type { RoundKind } from '@interviewharness/core';
import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { roundKinds } from '../rounds.ts';
import { useSettings } from '../settings/settings.tsx';
import { IconButton, iconProps } from '../ui/IconButton.tsx';
import { ModelStep } from './ModelStep.tsx';
import { ProblemList } from './ProblemList.tsx';
import './start.css';

// The rounds not built yet, named in one quiet line under the one way to start.
const later = roundKinds.filter((r) => !r.available).map((r) => r.label.replace(/ round$/, ''));
const comingLater = later.length ? `${later.join(' and ')} rounds are coming later.` : null;

/** Starts a round of a kind; a coding round on the problem named, or on one picked at random. */
export function StartScreen({ onStart }: { onStart: (kind: RoundKind, problem?: string) => void }) {
  const { settings, setPanelOpen } = useSettings();
  // A round can't work without a model, so the first one waits for the candidate to pick one.
  const needsModel = settings.interviewerModel === null;
  const [unencryptedNote, setUnencryptedNote] = useState(false);
  const [choosing, setChoosing] = useState(false);
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
      <div className="start-body">
        {needsModel ? (
          <ModelStep onUnencrypted={() => setUnencryptedNote(true)} />
        ) : choosing ? (
          <ProblemList onPick={(problem) => onStart('coding', problem)} onBack={() => setChoosing(false)} />
        ) : (
          <>
            {unencryptedNote && (
              <div className="start-note" role="note" aria-label="Login not encrypted">
                <p>
                  Your login is saved on this computer without encryption, because no password keyring (like GNOME
                  Keyring or KWallet) is running. Only your user account can read the file.
                </p>
                <button type="button" onClick={() => setUnencryptedNote(false)}>
                  Got it
                </button>
              </div>
            )}
            <div className="start-actions">
              <button type="button" className="primary start-main" onClick={() => onStart('coding')}>
                Start coding round
              </button>
              <button type="button" className="start-choose" onClick={() => setChoosing(true)}>
                Choose a problem
              </button>
            </div>
            {comingLater && <p className="start-later">{comingLater}</p>}
          </>
        )}
      </div>
    </main>
  );
}
