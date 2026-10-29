import type { CodingPhase, RoundKind } from '@interviewharness/core';

export interface Clock {
  now(): number;
}

export interface RoundSnapshot {
  kind: RoundKind;
  phase: CodingPhase;
  elapsedMs: number;
}

export interface Round {
  snapshot(): RoundSnapshot;
}

export function startRound(kind: RoundKind, clock: Clock): Round {
  const startedAt = clock.now();
  return {
    snapshot: () => ({ kind, phase: 'clarify', elapsedMs: clock.now() - startedAt }),
  };
}
