import { VERDICTS } from '@interviewharness/core';
import { ArrowLeft } from 'lucide-react';
import type { RoundSnapshot } from '@interviewharness/engine';
import { roundLabel } from '../rounds.ts';
import { iconProps } from '../ui/IconButton.tsx';
import { formatElapsed } from '../ui/time.ts';
import './feedback.css';
import { type FeedbackPoint, sampleFeedback } from './sample.ts';

/** The interviewer's written feedback after a round: a verdict, then what went well and what to fix. */
export function FeedbackScreen({ round, onBack }: { round: RoundSnapshot; onBack: () => void }) {
  const feedback = sampleFeedback;

  return (
    <main className="feedback" aria-label="Feedback">
      <header className="feedback-head">
        <div className="feedback-heading">
          <h1 className="feedback-title">Feedback</h1>
          <p>
            {roundLabel(round.kind)} · {formatElapsed(round.elapsedMs)}
          </p>
          <p className="feedback-sample label">Sample feedback · real feedback arrives with the AI interviewer</p>
        </div>

        <section className="feedback-section">
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
      <div className="feedback-body" tabIndex={0} aria-label="Written feedback">
        <section className="feedback-section" aria-label="Why">
          <h2 className="label">Why</h2>
          <p>{feedback.why}</p>
        </section>

        <Points title="What went well" points={feedback.wentWell} />
        <Points title="What to fix" points={feedback.toFix} />
      </div>

      <footer className="feedback-foot">
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
    <section className="feedback-section" aria-label={title}>
      <h2 className="label">{title}</h2>
      <ul className="feedback-points">
        {points.map((point, i) => (
          <li key={i}>
            <span className="feedback-moment">{formatElapsed(point.atMs)}</span>
            <p>{point.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
