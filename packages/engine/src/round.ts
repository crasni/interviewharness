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
  /** Time left in the round; below zero once it has run over. */
  timeLeftMs(): number;
  /** Moves to the next phase; stays put in the last one. Returns the phase now in progress. */
  advancePhase(): CodingPhase;
  /** Moves to any phase, earlier or later (the candidate went back to fix their code). */
  moveTo(phase: CodingPhase): void;
}

const minute = 60_000;

/** Each phase's share of a 45-minute coding round, used to judge when a phase has run long. */
export const codingPhaseShares: Record<CodingPhase, number> = {
  clarify: 5 * minute,
  approach: 7 * minute,
  code: 16 * minute,
  test: 6 * minute,
  complexity: 3 * minute,
  'follow-up': 5 * minute,
  'wrap-up': 3 * minute,
};

/** How long a coding round lasts: the sum of its phases' shares. */
export const codingRoundMs = Object.values(codingPhaseShares).reduce((sum, share) => sum + share, 0);

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
    timeLeftMs: () => codingRoundMs - (clock.now() - startedAt),
    advancePhase() {
      const next = nextPhase(phase);
      if (next) {
        phase = next;
        phaseStartedAt = clock.now();
      }
      return phase;
    },
    moveTo(to) {
      if (to === phase) return;
      phase = to;
      phaseStartedAt = clock.now();
    },
  };
}
