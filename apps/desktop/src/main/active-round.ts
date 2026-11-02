import type { RoundKind } from '@interviewharness/core';
import {
  type Clock,
  type CodeSnapshot,
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
  checkModel?: Model;
  problem: Problem;
  toneGuide: string;
  onEvent: (event: InterviewerEvent) => void;
}) {
  const round = startRound(options.kind, options.clock);
  const interviewer = createInterviewer({ ...options, round });

  const signal = (s: Signal) => interviewer.onSignal(s);
  const ticker = setInterval(() => signal({ type: 'tick' }), tickEvery);

  const { name, details, statement } = options.problem;
  const problem = { name, title: details.title, statement };

  return {
    problem: options.problem,
    snapshot: () => ({ ...round.snapshot(), problem }),
    signal,
    /** Ends the round, with the code as the candidate left it. */
    stop(code?: CodeSnapshot) {
      clearInterval(ticker);
      interviewer.onSignal({ type: 'round-end', ...(code ? { code } : {}) });
    },
    /** What the round leaves for grading. */
    record: () => interviewer.record(),
  };
}

export type ActiveRound = ReturnType<typeof runRound>;
