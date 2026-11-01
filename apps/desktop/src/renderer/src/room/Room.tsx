import type { CodeSnapshot, ModelErrorKind, RoundSnapshot } from '@interviewharness/engine';
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { phaseLabels, roundLabel } from '../rounds.ts';
import { useSettings } from '../settings/settings.tsx';
import type { PresenceState } from '../ui/PresenceDot.tsx';
import { Mic, PanelBottomClose, PanelBottomOpen, Settings as SettingsIcon } from 'lucide-react';
import { IconButton, iconProps } from '../ui/IconButton.tsx';
import { Splitter } from '../ui/Splitter.tsx';
import { formatElapsed } from '../ui/time.ts';
import { CodeEditor, type CodeEditorHandle } from './CodeEditor.tsx';
import { Conversation } from './Conversation.tsx';
import { InterviewerTile } from './InterviewerTile.tsx';
import { ProblemPanel } from './ProblemPanel.tsx';
import './room.css';
import { SayField } from './SayField.tsx';
import { useTalking } from './useTalking.ts';
import { useSubtitle } from './useSubtitle.ts';
import { useTranscript } from './useTranscript.ts';

export function Room({ initial, onEnd }: { initial: RoundSnapshot; onEnd: (code: CodeSnapshot) => void }) {
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
  // Ending asks first: the round's Feedback depends on it, and a stray click shouldn't cost that.
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  // A backchannel's words ("Mm-hm.") stay on the tile a moment longer than the nod itself.
  const [backchannelLine, setBackchannelLine] = useState<string | null>(null);
  const backchannelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const notice = useNotice();
  const editor = useRef<CodeEditorHandle>(null);

  const { talking, toggle: toggleTalking } = useTalking(
    useCallback(() => window.harness.signal({ type: 'talk-start' }), []),
    useCallback(() => window.harness.signal({ type: 'talk-end' }), []),
  );

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
          case 'preparing':
            setPresence('preparing');
            break;
          case 'stop-preparing':
            setPresence('listening'); // nothing was said, so no line is cut off
            break;
          case 'quiet':
            setPresence('listening'); // heard as thinking aloud: it keeps listening
            break;
          case 'model-failed':
            notice.show(modelFailures[decision.error]);
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
    [subtitle.show, subtitle.finish, subtitle.clear, transcript.add, transcript.markCutOff, notice.show],
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

  const tileLabel = backchannelLine ?? tileLabels[presence];
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
        {notice.text && (
          <span className="room-notice" role="status" aria-label="Notice" data-faded={notice.faded}>
            {notice.text}
          </span>
        )}
        <span className="room-timer" data-testid="timer">
          {formatElapsed(round.elapsedMs)}
        </span>
        <IconButton
          label={transcriptShown ? 'Hide transcript' : 'Show transcript'}
          aria-expanded={transcriptShown}
          on={transcriptShown}
          swap={{ on: <PanelBottomClose {...iconProps} />, off: <PanelBottomOpen {...iconProps} /> }}
          onClick={() => setTranscriptShown((shown) => !shown)}
        />
        <IconButton
          label="Settings"
          motion="spin"
          icon={<SettingsIcon {...iconProps} />}
          onClick={() => setPanelOpen(true)}
        />
        {confirmingEnd ? (
          <span
            className="room-confirm"
            role="group"
            aria-label="End the round?"
            onKeyDown={(event) => event.key === 'Escape' && setConfirmingEnd(false)}
          >
            <span>End the round?</span>
            <button
              type="button"
              className="primary"
              disabled={ending}
              onClick={() => {
                setEnding(true); // once only: a second click would end a round that is already over
                onEnd({ language: settings.language, text: editor.current?.text() ?? '' });
              }}
            >
              End round
            </button>
            {/* Focused first, so Enter right after the first click keeps the round going. */}
            <button type="button" autoFocus onClick={() => setConfirmingEnd(false)}>
              Keep going
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmingEnd(true)}>
            End round
          </button>
        )}
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
            ref={editor}
            options={{
              language: settings.language,
              autocomplete: settings.autocomplete,
              highlighting: settings.highlighting,
              closeBrackets: settings.closeBrackets,
              matchBrackets: settings.matchBrackets,
              findReplace: settings.findReplace,
              wrapLines: settings.wrapLines,
            }}
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
        <div className="room-composer">
          <SayField
            onSay={(text) => {
              transcript.add('candidate', text);
              // What they said goes with their code as it stands, so the interviewer's reply fits where they are.
              window.harness.signal({ type: 'said', text, code: { language: settings.language, text: editor.current?.text() ?? '' } });
            }}
          />
          <IconButton
            className="talk"
            label={talking ? 'Stop talking' : 'Talk'}
            tip="above"
            aria-pressed={talking}
            icon={<Mic {...iconProps} />}
            onClick={toggleTalking}
          />
        </div>
      </footer>
    </div>
  );
}

const backchannelShownFor = 1_500;

const tileLabels: Record<PresenceState, string> = {
  listening: 'Listening',
  nodding: 'Listening',
  preparing: 'Thinking',
  speaking: 'Speaking',
};

/** What the room says when the model couldn't give the interviewer's words, and a stock line was said instead. */
const modelFailures: Record<ModelErrorKind, string> = {
  offline: "Couldn't reach the model, so the interviewer used a stock line.",
  auth: 'The model login failed, so the interviewer used a stock line.',
  'rate-limit': 'The model is rate-limited, so the interviewer used a stock line.',
  timeout: 'The model took too long, so the interviewer used a stock line.',
  'bad-output': 'The model gave no usable words, so the interviewer used a stock line.',
  aborted: 'The model stopped, so the interviewer used a stock line.',
  other: 'The model failed, so the interviewer used a stock line.',
};

/** How long a notice stays before it fades. */
const noticeShownFor = 6_000;

/** A small notice in the bar that fades on its own. */
function useNotice() {
  const [text, setText] = useState<string | null>(null);
  const [faded, setFaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((message: string) => {
    clearTimeout(timer.current);
    setText(message);
    setFaded(false);
    timer.current = setTimeout(() => setFaded(true), noticeShownFor);
  }, []);
  return { text, faded, show };
}

// Resize limits (px), so no area can be dragged out of use.
const problemMin = 220;
const editorMin = 360;
const edgeWidth = 8; // the edge itself (--space-2), standing in the gap
const conversationMin = 80;
const conversationMaxShare = 0.6;

/** A dragged size, handed to the CSS as a custom property; none means the stylesheet's default. */
function sizeVar(name: string, px: number | null) {
  return px === null ? undefined : ({ [name]: `${px}px` } as CSSProperties);
}
