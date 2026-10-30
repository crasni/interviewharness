import { VERDICTS } from '@interviewharness/core';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { FeedbackPoint, RoundSnapshot } from '@interviewharness/engine';
import { useEffect, useRef, useState } from 'react';
import type { FeedbackResult } from '../../../shared/api.ts';
import { roundLabel } from '../rounds.ts';
import { iconProps } from '../ui/IconButton.tsx';
import { formatElapsed } from '../ui/time.ts';
import './feedback.css';

type Failure = Extract<FeedbackResult, { ok: false }>['error'];

/** Why the Feedback couldn't be written, in plain words. */
const failures: Record<Failure, string> = {
  offline: "Couldn't reach the model to write your Feedback.",
  auth: 'The model login failed. Sign in again in Settings → Model, then try again.',
  'rate-limit': 'The model is rate-limited right now. Wait a moment and try again.',
  timeout: 'The model took too long to write your Feedback.',
  'bad-output': "The model's answer couldn't be used.",
  aborted: 'Writing your Feedback was stopped.',
  other: 'Something went wrong writing your Feedback.',
  'no-model': 'There is no model to write your Feedback. Pick one in Settings → Model, then try again.',
  'no-round': 'There is no round to write Feedback for.',
};

/** The interviewer's written feedback after a round: a verdict, then what went well and what to fix. Words, never scores. */
export function FeedbackScreen({ round, onBack }: { round: RoundSnapshot; onBack: () => void }) {
  // Writing starts in main the moment the round ends; this waits for it.
  const [result, setResult] = useState<FeedbackResult | null>(null);
  // Results that arrive after the screen is gone (Back to start mid-write) are ignored.
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    void window.harness.feedback.result().then((written) => shown.current && setResult(written));
    return () => {
      shown.current = false;
    };
  }, []);

  async function tryAgain() {
    setResult(null);
    const written = await window.harness.feedback.retry();
    if (shown.current) setResult(written);
  }

  const feedback = result?.ok ? result : null;

  return (
    <main className="feedback" aria-label="Feedback" aria-busy={result === null}>
      <header className="feedback-head">
        <div className="feedback-heading">
          <h1 className="feedback-title">Feedback</h1>
          <p>
            {roundLabel(round.kind)} · {formatElapsed(round.elapsedMs)}
          </p>
        </div>

        {feedback && (
          // The verdict is the answer, so it leads: in words first, then where it sits on the scale.
          <section className="feedback-verdict" aria-labelledby="verdict-label">
            <h2 id="verdict-label" className="label">
              Verdict
              {feedback.rough && <span className="feedback-rough"> · Rough: written by a small model</span>}
            </h2>
            <p className="verdict-given">{feedback.verdict}</p>
            <ol className="verdict-scale" aria-label="Verdict">
              {VERDICTS.map((verdict) => (
                <li key={verdict} aria-current={verdict === feedback.verdict}>
                  {verdict}
                </li>
              ))}
            </ol>
          </section>
        )}
      </header>

      {/* Only the written feedback scrolls; the verdict above and the way out below stay in place. */}
      <div className="feedback-body" tabIndex={0} aria-label="Written feedback">
        {result === null && (
          <p className="feedback-status" role="status">
            Writing your Feedback…
          </p>
        )}
        {result && !result.ok && (
          <div className="feedback-status" role="alert">
            <p>{failures[result.error]}</p>
            <p className="feedback-status-note">Your round is kept, so trying again needs nothing else.</p>
          </div>
        )}
        {feedback && (
          <>
            <section className="feedback-section" aria-label="Why">
              <h2 className="label">Why</h2>
              <p>{feedback.why}</p>
            </section>
            <Points title="What went well" points={feedback.wentWell} />
            <Points title="What to fix" points={feedback.toFix} />
          </>
        )}
      </div>

      <footer className="feedback-foot">
        {result && !result.ok && result.error !== 'no-round' && (
          <button type="button" className="primary with-icon" onClick={() => void tryAgain()}>
            <RotateCcw {...iconProps} size={16} />
            Try again
          </button>
        )}
        <button type="button" className={result && !result.ok ? 'with-icon' : 'primary with-icon'} data-motion="nudge" onClick={onBack}>
          <ArrowLeft {...iconProps} size={16} />
          Back to start
        </button>
      </footer>
    </main>
  );
}

function Points({ title, points }: { title: string; points: FeedbackPoint[] }) {
  if (!points.length) return null;
  return (
    <section className="feedback-section" aria-label={title}>
      <h2 className="feedback-section-title">{title}</h2>
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
