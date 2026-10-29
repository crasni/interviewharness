import type { RoundKind } from '@interviewharness/core';
import {
  type Clock,
  createInterviewer,
  type InterviewerEvent,
  type LineBook,
  type Model,
  type Problem,
  type RoundLog,
  type Signal,
  startRound,
} from '@interviewharness/engine';

const tickEvery = 100;

/** A round in progress: its clock, its interviewer, and the ticks that drive it. */
export function runRound(options: {
  kind: RoundKind;
  clock: Clock;
  lines: LineBook;
  log: RoundLog;
  model: Model | null;
  problem: Problem;
  toneGuide: string;
  onEvent: (event: InterviewerEvent) => void;
}) {
  const round = startRound(options.kind, options.clock);
  const interviewer = createInterviewer({ ...options, round });

  const signal = (s: Signal) => interviewer.onSignal(s);
  const ticker = setInterval(() => signal({ type: 'tick' }), tickEvery);

  return {
    snapshot: () => round.snapshot(),
    signal,
    stop() {
      clearInterval(ticker);
      interviewer.onSignal({ type: 'round-end' });
    },
  };
}

export type ActiveRound = ReturnType<typeof runRound>;
