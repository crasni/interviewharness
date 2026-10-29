import type { RoundKind } from '@interviewharness/core';
import type { Decision, RoundSnapshot, Signal } from '@interviewharness/engine';

/** Signals the candidate can send. Ticks come from the main process, never the renderer. */
export const candidateSignalTypes = ['talk-start', 'talk-end'] as const satisfies readonly Signal['type'][];
export type CandidateSignal = Extract<Signal, { type: (typeof candidateSignalTypes)[number] }>;

/** Decisions worth showing: everything except staying silent. */
export type SpokenDecision = Exclude<Decision, { kind: 'silent' }>;

// The only surface the renderer has into the main process.
export interface HarnessApi {
  startRound(kind: RoundKind): Promise<RoundSnapshot>;
  roundSnapshot(): Promise<RoundSnapshot | null>;
  signal(signal: CandidateSignal): void;
  /** Subscribes to the interviewer's decisions; returns an unsubscribe function. */
  onDecision(listener: (decision: SpokenDecision) => void): () => void;
}

export const channels = {
  startRound: 'round:start',
  roundSnapshot: 'round:snapshot',
  signal: 'floor:signal',
  decision: 'floor:decision',
} as const;
