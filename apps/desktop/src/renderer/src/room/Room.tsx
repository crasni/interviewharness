import type { RoundSnapshot } from '@interviewharness/engine';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { phaseLabels, roundLabel } from '../rounds.ts';
import { PresenceDot, type PresenceState } from '../ui/PresenceDot.tsx';
import './room.css';
import { SayField } from './SayField.tsx';
import { useHoldToTalk } from './useHoldToTalk.ts';

export function Room({ initial }: { initial: RoundSnapshot }) {
  const [round, setRound] = useState(initial);
  const [presence, setPresence] = useState<PresenceState>('listening');
  const [subtitle, setSubtitle] = useState('');
  const [candidateWords, setCandidateWords] = useState('');

  const talking = useHoldToTalk(
    useCallback(() => window.harness.signal({ type: 'talk-start' }), []),
    useCallback(() => window.harness.signal({ type: 'talk-end' }), []),
  );

  // Subscribed before the room first paints, so no decision sent as it opens is missed.
  useLayoutEffect(
    () =>
      window.harness.onDecision((decision) => {
        switch (decision.kind) {
          case 'backchannel':
            setPresence('nodding');
            setSubtitle(decision.line);
            break;
          case 'ack':
          case 'answer':
            setPresence('speaking');
            setSubtitle(decision.line);
            break;
          case 'done-speaking':
            setPresence('listening');
            break;
          case 'stop-speaking':
            setPresence('listening');
            setSubtitle('');
            break;
        }
      }),
    [],
  );

  useEffect(() => {
    const id = setInterval(async () => {
      const snapshot = await window.harness.roundSnapshot();
      if (snapshot) setRound(snapshot);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="room">
      <header className="room-bar" aria-label="Round status">
        <span className="room-kind">{roundLabel(round.kind)}</span>
        <span className="label" data-testid="phase">
          {phaseLabels[round.phase]}
        </span>
        <span className="room-timer" data-testid="timer">
          {formatElapsed(round.elapsedMs)}
        </span>
      </header>

      <div className="room-work">
        <section className="room-problem" aria-label="Problem" />
        <section className="room-editor" aria-label="Editor" />
      </div>

      <footer className="room-presence">
        <PresenceDot state={presence} onNodEnd={() => setPresence('listening')} />
        <p className="room-subtitle" data-testid="subtitle">
          {subtitle}
        </p>
        <div className="room-talk-status">
          <span className="room-you label" role="status" aria-label="You" data-talking={talking}>
            {talking ? 'Talking' : 'Hold Space to talk'}
          </span>
          {import.meta.env.DEV && <PresenceControls state={presence} onChange={setPresence} />}
        </div>
        <div className="room-candidate">
          <span className="label">You</span>
          <p className="room-candidate-words" data-testid="candidate-words">
            {candidateWords}
          </p>
        </div>
        <SayField
          onSay={(text) => {
            setCandidateWords(text);
            window.harness.signal({ type: 'said', text });
          }}
        />
      </footer>
    </div>
  );
}

/** Dev-only: set the presence dot's state by hand to judge its look. */
function PresenceControls({ state, onChange }: { state: PresenceState; onChange: (s: PresenceState) => void }) {
  const states: PresenceState[] = ['listening', 'nodding', 'speaking'];
  return (
    <div className="room-dev" role="group" aria-label="Presence (dev)">
      {states.map((s) => (
        <button key={s} type="button" className="label" aria-pressed={state === s} onClick={() => onChange(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
