import { VERDICTS } from '@interviewharness/core';
import { ArrowLeft } from 'lucide-react';
import type { RoundSnapshot } from '@interviewharness/engine';
import { roundLabel } from '../rounds.ts';
import { iconProps } from '../ui/IconButton.tsx';
import { formatElapsed } from '../ui/time.ts';
import './debrief.css';
import { type FeedbackPoint, sampleFeedback } from './sample.ts';

/** The interviewer's written feedback after a round: a verdict, then what went well and what to fix. */
export function Debrief({ round, onBack }: { round: RoundSnapshot; onBack: () => void }) {
  const feedback = sampleFeedback;

  return (
    <main className="debrief" aria-label="Debrief">
      <header className="debrief-head">
        <div className="debrief-heading">
          <h1 className="debrief-title">Debrief</h1>
          <p>
            {roundLabel(round.kind)} · {formatElapsed(round.elapsedMs)}
          </p>
          <p className="debrief-sample label">Sample feedback · real feedback arrives with the AI interviewer</p>
        </div>

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
      </header>

      {/* Only the written feedback scrolls; the verdict above and the way out below stay in place. */}
      <div className="debrief-feedback" tabIndex={0} aria-label="Feedback">
        <section className="debrief-section" aria-label="Why">
          <h2 className="label">Why</h2>
          <p>{feedback.why}</p>
        </section>

        <Points title="What went well" points={feedback.wentWell} />
        <Points title="What to fix" points={feedback.toFix} />
      </div>

      <footer className="debrief-foot">
        <button type="button" className="primary with-icon" data-motion="nudge" onClick={onBack}>
          <ArrowLeft {...iconProps} size={16} />
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
