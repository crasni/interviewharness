import { useEffect } from 'react';
import type { TranscriptEntry } from './useTranscript.ts';

const speakerLabels: Record<TranscriptEntry['who'], string> = { interviewer: 'Interviewer', candidate: 'You' };

/** Everything said in the round so far, newest last. Sits beside the editor without taking focus. */
export function Transcript({ entries, onClose }: { entries: TranscriptEntry[]; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <aside className="transcript" aria-label="Transcript">
      <header className="transcript-head">
        <h2>Transcript</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <ol className="transcript-entries">
        {entries.map((entry, i) => (
          <li key={i} data-who={entry.who}>
            <span className="label">
              {speakerLabels[entry.who]}
              {entry.cutOff && ' · cut off'}
            </span>
            <p>{entry.text}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
