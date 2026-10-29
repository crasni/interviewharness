import type { LaterPhase, RoundSnapshot } from '@interviewharness/engine';
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { phaseLabels, roundLabel } from '../rounds.ts';
import { useSettings } from '../settings/settings.tsx';
import type { PresenceState } from '../ui/PresenceDot.tsx';
import { Splitter } from '../ui/Splitter.tsx';
import { formatElapsed } from '../ui/time.ts';
import { CodeEditor } from './CodeEditor.tsx';
import { Conversation } from './Conversation.tsx';
import { InterviewerTile } from './InterviewerTile.tsx';
import { ProblemPanel } from './ProblemPanel.tsx';
import './room.css';
import { SayField } from './SayField.tsx';
import { useTalking } from './useTalking.ts';
import { useSubtitle } from './useSubtitle.ts';
import { useTranscript } from './useTranscript.ts';

export function Room({ initial, onEnd }: { initial: RoundSnapshot; onEnd: () => void }) {
  const { settings, change, setPanelOpen } = useSettings();
  const [round, setRound] = useState(initial);
  const [presence, setPresence] = useState<PresenceState>('listening');
  const subtitle = useSubtitle();
  const transcript = useTranscript();
  const [transcriptShown, setTranscriptShown] = useState(settings.transcriptShown);
  const [problemShown, setProblemShown] = useState(true);
  const room = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLDivElement>(null);
  const [ending, setEnding] = useState(false);
  // A backchannel's words ("Mm-hm.") stay on the tile a moment longer than the nod itself.
  const [backchannelLine, setBackchannelLine] = useState<string | null>(null);
  const backchannelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The phase the interviewer has offered to move to, while it waits for "Move on" or "Not yet".
  const [suggestion, setSuggestion] = useState<LaterPhase | null>(null);

  const { talking, toggle: toggleTalking } = useTalking(
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
            clearTimeout(backchannelTimer.current);
            setBackchannelLine(decision.line);
            backchannelTimer.current = setTimeout(() => setBackchannelLine(null), backchannelShownFor);
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

  useEffect(() => () => clearTimeout(backchannelTimer.current), []);

  // ⌘T on macOS, Ctrl+T elsewhere, shows and hides the transcript. (On macOS, Ctrl+T stays the editor's.)
  useEffect(() => {
    const isMac = navigator.userAgent.includes('Mac');
    const toggle = (event: KeyboardEvent) => {
      const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (modifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTranscriptShown((shown) => !shown);
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

  const tileLabel = backchannelLine ?? (presence === 'speaking' ? 'Speaking' : 'Listening');
  const measure = (selector: string, side: 'offsetWidth' | 'offsetHeight') =>
    room.current?.querySelector<HTMLElement>(selector)?.[side] ?? 0;

  return (
    <div
      className="room"
      ref={room}
      style={sizeVar('--conversation-height', settings.conversationHeight)}
      data-conversation-sized={settings.conversationHeight !== null}
    >
      <header className="room-bar" aria-label="Round status">
        <span className="room-kind">{roundLabel(round.kind)}</span>
        <span className="room-sep" aria-hidden="true">
          ·
        </span>
        <span data-testid="phase">{phaseLabels[round.phase]}</span>
        <span className="room-spacer" />
        {import.meta.env.DEV && <PresenceControls state={presence} onChange={setPresence} />}
        <span className="room-timer" data-testid="timer">
          {formatElapsed(round.elapsedMs)}
        </span>
        <button type="button" onClick={() => setPanelOpen(true)}>
          Settings
        </button>
        <button type="button" aria-expanded={transcriptShown} onClick={() => setTranscriptShown((shown) => !shown)}>
          {transcriptShown ? 'Hide transcript' : 'Show transcript'}
        </button>
        <button
          type="button"
          disabled={ending}
          onClick={() => {
            setEnding(true); // once only: a second click would end a round that is already over
            onEnd();
          }}
        >
          End round
        </button>
      </header>

      <div
        className="room-work"
        ref={work}
        style={sizeVar('--problem-width', settings.problemWidth)}
      >
        <ProblemPanel shown={problemShown} onToggle={() => setProblemShown(!problemShown)} />
        {problemShown && (
          <Splitter
            label="Resize the problem"
            between="columns"
            grows="right"
            size={() => measure('.problem', 'offsetWidth')}
            min={problemMin}
            max={() => (work.current?.clientWidth ?? 0) - edgeWidth - editorMin}
            onResize={(problemWidth) => change({ problemWidth })}
            onReset={() => change({ problemWidth: null })}
          />
        )}
        <section className="room-editor" aria-label="Editor">
          <CodeEditor
            options={{ language: settings.language, autocomplete: settings.autocomplete, highlighting: settings.highlighting }}
            onActivity={() => window.harness.signal({ type: 'editor-activity' })}
          />
        </section>
        <InterviewerTile presence={presence} label={tileLabel} onNodEnd={() => setPresence('listening')} />
      </div>

      {transcriptShown ? (
        <Splitter
          label="Resize the transcript"
          between="rows"
          grows="up"
          size={() => measure('.conversation', 'offsetHeight')}
          min={conversationMin}
          max={() => (room.current?.clientHeight ?? 0) * conversationMaxShare}
          onResize={(conversationHeight) => change({ conversationHeight })}
          onReset={() => change({ conversationHeight: null })}
        />
      ) : (
        <div className="room-gap" aria-hidden="true" />
      )}

      <footer className="room-exchange">
        {transcriptShown ? (
          <Conversation entries={transcript.entries} />
        ) : (
          <p className="room-caption" data-testid="subtitle" data-faded={subtitle.faded}>
            {subtitle.text}
          </p>
        )}
        {suggestion && (
          <div className="room-suggestion" role="group" aria-label={`Move on to ${phaseLabels[suggestion]}?`}>
            <button type="button" className="primary" onClick={() => answerSuggestion(true)}>
              Move on
            </button>
            <button type="button" onClick={() => answerSuggestion(false)}>
              Not yet
            </button>
          </div>
        )}
        <div className="room-composer">
          <SayField
            onSay={(text) => {
              transcript.add('candidate', text);
              window.harness.signal({ type: 'said', text });
            }}
          />
          <button type="button" aria-pressed={talking} onClick={toggleTalking}>
            {talking ? 'Stop talking' : 'Talk'}
          </button>
        </div>
      </footer>
    </div>
  );
}

const backchannelShownFor = 1_500;

// Resize limits (px), so no area can be dragged out of use.
const problemMin = 220;
const editorMin = 360;
const edgeWidth = 16; // the edge itself (--space-4), standing in the gap
const conversationMin = 80;
const conversationMaxShare = 0.6;

/** A dragged size, handed to the CSS as a custom property; none means the stylesheet's default. */
function sizeVar(name: string, px: number | null) {
  return px === null ? undefined : ({ [name]: `${px}px` } as CSSProperties);
}

/** Dev-only: set the presence dot's state by hand to judge its look. */
function PresenceControls({ state, onChange }: { state: PresenceState; onChange: (s: PresenceState) => void }) {
  const states: PresenceState[] = ['listening', 'nodding', 'speaking'];
  return (
    <div className="room-dev" role="group" aria-label="Presence (dev)">
      {states.map((s) => (
        <button key={s} type="button" aria-pressed={state === s} onClick={() => onChange(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
