import type { RoundKind } from '@interviewharness/core';
import { roundKinds } from '../rounds.ts';
import { useSettings } from '../settings/settings.tsx';
import './start.css';

export function StartScreen({ onStart }: { onStart: (kind: RoundKind) => void }) {
  const { setPanelOpen } = useSettings();
  return (
    <main className="start">
      <button type="button" className="start-settings" onClick={() => setPanelOpen(true)}>
        Settings
      </button>
      <header className="start-head">
        <h1 className="start-title">InterviewHarness</h1>
        <p className="start-lede">Mock interviews, out loud, with an interviewer that listens.</p>
      </header>
      <ul className="start-rounds">
        {roundKinds.map(({ kind, label, startLabel, available }) => (
          <li key={kind}>
            <button type="button" className={available ? 'primary' : undefined} disabled={!available} onClick={() => onStart(kind)}>
              {available ? startLabel : label}
            </button>
            {!available && <span className="label">Later</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
