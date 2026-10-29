import type { RoundKind } from '@interviewharness/core';
import type { RoundSnapshot } from '@interviewharness/engine';
import { useEffect, useState } from 'react';

const roundKinds: { kind: RoundKind; label: string; startLabel: string; available: boolean }[] = [
  { kind: 'coding', label: 'Coding round', startLabel: 'Start coding round', available: true },
  { kind: 'system-design', label: 'System design round', startLabel: 'Start system design round', available: false },
  { kind: 'ai-assisted', label: 'AI-assisted round', startLabel: 'Start AI-assisted round', available: false },
];

const phaseLabels: Record<RoundSnapshot['phase'], string> = {
  clarify: 'Clarify',
  approach: 'Approach',
  code: 'Code',
  test: 'Test',
  complexity: 'Complexity',
  'wrap-up': 'Wrap-up',
};

export function App() {
  const [round, setRound] = useState<RoundSnapshot | null>(null);

  if (!round) {
    return <StartScreen onStart={async (kind) => setRound(await window.harness.startRound(kind))} />;
  }
  return <Room initial={round} />;
}

function StartScreen({ onStart }: { onStart: (kind: RoundKind) => void }) {
  return (
    <main className="start">
      <h1>InterviewHarness</h1>
      <ul className="round-kinds">
        {roundKinds.map(({ kind, label, startLabel, available }) => (
          <li key={kind}>
            <button type="button" disabled={!available} onClick={() => onStart(kind)}>
              {available ? startLabel : label}
            </button>
            {!available && <span className="later">Later</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Room({ initial }: { initial: RoundSnapshot }) {
  const [round, setRound] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      const snapshot = await window.harness.roundSnapshot();
      if (snapshot) setRound(snapshot);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const kindLabel = roundKinds.find((r) => r.kind === round.kind)?.label;

  return (
    <div className="room">
      <header className="top-bar" aria-label="Round status">
        <span>{kindLabel}</span>
        <span data-testid="phase">{phaseLabels[round.phase]}</span>
        <span data-testid="timer">{formatElapsed(round.elapsedMs)}</span>
      </header>
    </div>
  );
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
