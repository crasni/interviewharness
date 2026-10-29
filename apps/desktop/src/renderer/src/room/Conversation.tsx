import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from './useTranscript.ts';

/**
 * The transcript at the bottom of the room: the interviewer's lines on the left in its serif voice,
 * the candidate's words in bubbles on the right. Keeps the newest line in view.
 */
export function Conversation({ entries }: { entries: TranscriptEntry[] }) {
  const end = useRef<HTMLLIElement>(null);
  const lastInterviewer = entries.findLastIndex((entry) => entry.who === 'interviewer');
  const lastCandidate = entries.findLastIndex((entry) => entry.who === 'candidate');

  // A block body on purpose: scrollIntoView returns a Promise in current Chromium, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  return (
    <ol className="conversation" role="log" aria-label="Transcript">
      {entries.map((entry, i) => (
        <li
          key={i}
          data-who={entry.who}
          data-cut-off={entry.cutOff ?? false}
          data-testid={i === lastInterviewer ? 'subtitle' : i === lastCandidate ? 'candidate-words' : undefined}
        >
          {entry.text}
          {entry.cutOff && <span className="label"> · cut off</span>}
        </li>
      ))}
      <li ref={end} aria-hidden="true" className="conversation-end" />
    </ol>
  );
}
