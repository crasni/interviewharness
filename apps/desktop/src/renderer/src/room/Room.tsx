import type { LaterPhase, RoundSnapshot } from '@interviewharness/engine';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { phaseLabels, roundLabel } from '../rounds.ts';
import { PresenceDot, type PresenceState } from '../ui/PresenceDot.tsx';
import { formatElapsed } from '../ui/time.ts';
import { CodeEditor } from './CodeEditor.tsx';
import { ProblemPanel } from './ProblemPanel.tsx';
import './room.css';
import { SayField } from './SayField.tsx';
import { Transcript } from './Transcript.tsx';
import { useHoldToTalk } from './useHoldToTalk.ts';
import { useSubtitle } from './useSubtitle.ts';
import { useTranscript } from './useTranscript.ts';

export function Room({ initial, onEnd }: { initial: RoundSnapshot; onEnd: () => void }) {
  const [round, setRound] = useState(initial);
  const [presence, setPresence] = useState<PresenceState>('listening');
  const subtitle = useSubtitle();
  const [candidateWords, setCandidateWords] = useState('');
  const transcript = useTranscript();
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const closeTranscript = useCallback(() => setTranscriptOpen(false), []);
  // The phase the interviewer has offered to move to, while it waits for "Move on" or "Not yet".
  const [suggestion, setSuggestion] = useState<LaterPhase | null>(null);

  const talking = useHoldToTalk(
    useCallback(() => window.harness.signal({ type: 'talk-start' }), []),
    useCallback(() => window.harness.signal({ type: 'talk-end' }), []),
  );

  function answerSuggestion(accept: boolean) {
    setSuggestion(null);
    window.harness.signal({ type: 'phase-answer', accept });
  }

  // Subscribed before the room first paints, so no decision sent as it opens is missed.
  useLayoutEffect(
    () =>
      window.harness.onDecision((decision) => {
        if ('speakingMs' in decision) {
          setPresence('speaking');
          subtitle.show(decision.line);
          transcript.add('interviewer', decision.line); // backchannels stay out: they don't take the floor
        }
        switch (decision.kind) {
          case 'backchannel':
            setPresence('nodding');
            subtitle.show(decision.line);
            subtitle.finish();
            break;
          case 'suggest-phase':
            setSuggestion(decision.next);
            break;
          case 'move-on':
          case 'suggestion-withdrawn':
            setSuggestion(null);
            break;
          case 'done-speaking':
            setPresence('listening');
            subtitle.finish();
            break;
          case 'stop-speaking':
            setPresence('listening');
            subtitle.clear();
            transcript.markCutOff();
            break;
        }
      }),
    [subtitle.show, subtitle.finish, subtitle.clear, transcript.add, transcript.markCutOff],
  );

  // ⌘T on macOS, Ctrl+T elsewhere, opens and closes the transcript. (On macOS, Ctrl+T stays the editor's.)
  useEffect(() => {
    const isMac = navigator.userAgent.includes('Mac');
    const toggle = (event: KeyboardEvent) => {
      const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (modifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTranscriptOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

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
        <button
          type="button"
          className="room-end label"
          disabled={ending}
          onClick={() => {
            setEnding(true); // once only: a second click would end a round that is already over
            onEnd();
          }}
        >
          End round
        </button>
      </header>

      <div className="room-work">
        <ProblemPanel />
        <section className="room-editor" aria-label="Editor">
          <CodeEditor onActivity={() => window.harness.signal({ type: 'editor-activity' })} />
        </section>
        {transcriptOpen && <Transcript entries={transcript.entries} onClose={closeTranscript} />}
      </div>

      <footer className="room-presence">
        <PresenceDot state={presence} onNodEnd={() => setPresence('listening')} />
        <p className="room-subtitle" data-testid="subtitle" data-faded={subtitle.faded}>
          {subtitle.text}
        </p>
        <div className="room-talk-status">
          {suggestion && (
            <div className="room-suggestion" role="group" aria-label={`Move on to ${phaseLabels[suggestion]}?`}>
              <button type="button" onClick={() => answerSuggestion(true)}>
                Move on
              </button>
              <button type="button" onClick={() => answerSuggestion(false)}>
                Not yet
              </button>
            </div>
          )}
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
            transcript.add('candidate', text);
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
