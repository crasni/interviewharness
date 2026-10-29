import { CODING_PHASES, type CodingPhase, type RoundKind } from '@interviewharness/core';

export interface Clock {
  now(): number;
}

export interface RoundSnapshot {
  kind: RoundKind;
  phase: CodingPhase;
  elapsedMs: number;
  /** Time spent in the current phase. */
  phaseElapsedMs: number;
}

export interface Round {
  snapshot(): RoundSnapshot;
  /** Moves to the next phase; stays put in the last one. Returns the phase now in progress. */
  advancePhase(): CodingPhase;
}

const minute = 60_000;

/** Each phase's share of a 45-minute coding round, used to judge when a phase has run long. */
export const codingPhaseShares: Record<CodingPhase, number> = {
  clarify: 5 * minute,
  approach: 7 * minute,
  code: 18 * minute,
  test: 7 * minute,
  complexity: 5 * minute,
  'wrap-up': 3 * minute,
};

/** Any phase a round can move on to: every phase but the first. */
export type LaterPhase = Exclude<CodingPhase, 'clarify'>;

/** The phase after this one, or null for the last phase. */
export function nextPhase(phase: CodingPhase): LaterPhase | null {
  return (CODING_PHASES[CODING_PHASES.indexOf(phase) + 1] as LaterPhase | undefined) ?? null;
}

export function startRound(kind: RoundKind, clock: Clock): Round {
  const startedAt = clock.now();
  let phase: CodingPhase = 'clarify';
  let phaseStartedAt = startedAt;

  return {
    snapshot: () => ({
      kind,
      phase,
      elapsedMs: clock.now() - startedAt,
      phaseElapsedMs: clock.now() - phaseStartedAt,
    }),
    advancePhase() {
      const next = nextPhase(phase);
      if (next) {
        phase = next;
        phaseStartedAt = clock.now();
      }
      return phase;
    },
  };
}
