import type { RoundKind } from '@interviewharness/core';
import {
  type Clock,
  createFloorManager,
  type Decision,
  type FloorLog,
  type LineBook,
  type Signal,
  startRound,
} from '@interviewharness/engine';

const tickEvery = 100;

/** A round in progress: its clock, its Floor Manager, and the ticks that drive it. */
export function runRound(options: {
  kind: RoundKind;
  clock: Clock;
  lines: LineBook;
  log: FloorLog;
  onDecision: (decision: Decision) => void;
}) {
  const round = startRound(options.kind, options.clock);
  const floor = createFloorManager({ clock: options.clock, round, lines: options.lines, log: options.log });

  function signal(s: Signal) {
    const decision = floor.onSignal(s);
    if (decision.kind !== 'silent') options.onDecision(decision);
  }

  const ticker = setInterval(() => signal({ type: 'tick' }), tickEvery);

  return {
    snapshot: () => round.snapshot(),
    signal,
    stop() {
      clearInterval(ticker);
      floor.onSignal({ type: 'round-end' });
    },
  };
}

export type ActiveRound = ReturnType<typeof runRound>;
