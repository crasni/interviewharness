import { VERDICTS } from '@interviewharness/core';
import type { RoundSnapshot } from '@interviewharness/engine';
import { roundLabel } from '../rounds.ts';
import { formatElapsed } from '../ui/time.ts';
import './debrief.css';
import { type FeedbackPoint, sampleFeedback } from './sample.ts';

/** The interviewer's written feedback after a round: a verdict, then what went well and what to fix. */
export function Debrief({ round, onBack }: { round: RoundSnapshot; onBack: () => void }) {
  const feedback = sampleFeedback;

  return (
    <main className="debrief" aria-label="Debrief">
      <header className="debrief-head">
        <h1 className="debrief-title">Debrief</h1>
        <p>
          {roundLabel(round.kind)} · {formatElapsed(round.elapsedMs)}
        </p>
        <p className="debrief-sample label">Sample feedback · real feedback arrives with the AI interviewer</p>
      </header>

      <section className="debrief-section">
        <h2 className="label">Verdict</h2>
        <ol className="verdict-scale" aria-label="Verdict">
          {VERDICTS.map((verdict) => (
            <li key={verdict} aria-current={verdict === feedback.verdict}>
              {verdict}
            </li>
          ))}
        </ol>
      </section>

      <section className="debrief-section" aria-label="Why">
        <h2 className="label">Why</h2>
        <p>{feedback.why}</p>
      </section>

      <Points title="What went well" points={feedback.wentWell} />
      <Points title="What to fix" points={feedback.toFix} />

      <footer>
        <button type="button" onClick={onBack}>
          Back to start
        </button>
      </footer>
    </main>
  );
}

function Points({ title, points }: { title: string; points: FeedbackPoint[] }) {
  return (
    <section className="debrief-section" aria-label={title}>
      <h2 className="label">{title}</h2>
      <ul className="debrief-points">
        {points.map((point, i) => (
          <li key={i}>
            <span className="debrief-moment">{formatElapsed(point.atMs)}</span>
            <p>{point.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
