import type { RoundKind } from '@interviewharness/core';
import { roundKinds } from '../rounds.ts';
import './start.css';

export function StartScreen({ onStart }: { onStart: (kind: RoundKind) => void }) {
  return (
    <main className="start">
      <h1 className="start-title">InterviewHarness</h1>
      <ul className="start-rounds">
        {roundKinds.map(({ kind, label, startLabel, available }) => (
          <li key={kind}>
            <button type="button" disabled={!available} onClick={() => onStart(kind)}>
              {available ? startLabel : label}
            </button>
            {!available && <span className="label">Later</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
