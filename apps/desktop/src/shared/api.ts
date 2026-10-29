import type { RoundKind } from '@interviewharness/core';
import type { Decision, RoundSnapshot, Signal } from '@interviewharness/engine';

/** Signals the candidate can send. Ticks come from the main process, never the renderer. */
export const candidateSignalTypes = [
  'talk-start',
  'talk-end',
  'said',
  'phase-answer',
  'editor-activity',
] as const satisfies readonly Signal['type'][];
export type CandidateSignal = Extract<Signal, { type: (typeof candidateSignalTypes)[number] }>;

/** The candidate's theme choice; 'system' follows the operating system. */
export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

/** Decisions worth showing: everything except staying silent. */
export type SpokenDecision = Exclude<Decision, { kind: 'silent' }>;

// The only surface the renderer has into the main process.
export interface HarnessApi {
  startRound(kind: RoundKind): Promise<RoundSnapshot>;
  roundSnapshot(): Promise<RoundSnapshot | null>;
  /** Ends the round in progress and returns how it ended. */
  endRound(): Promise<RoundSnapshot | null>;
  signal(signal: CandidateSignal): void;
  /** Subscribes to the interviewer's decisions; returns an unsubscribe function. */
  onDecision(listener: (decision: SpokenDecision) => void): () => void;
  /**
   * Sets the app's theme, so prefers-color-scheme, scrollbars and the window itself all follow it.
   * Resolves to whether the app is now dark.
   */
  setTheme(theme: Theme): Promise<boolean>;
  /** Tells main the page is dimmed under a dialog, so the native window buttons' strip dims with it. */
  setWindowDimmed(dimmed: boolean): void;
}

export const channels = {
  startRound: 'round:start',
  roundSnapshot: 'round:snapshot',
  endRound: 'round:end',
  signal: 'floor:signal',
  decision: 'floor:decision',
  setTheme: 'window:theme',
  setWindowDimmed: 'window:dimmed',
} as const;

export function isTheme(value: unknown): value is Theme {
  return (themes as readonly unknown[]).includes(value);
}

/** Checks a signal arriving over IPC: the renderer is not trusted to send well-formed data. */
export function isCandidateSignal(value: unknown): value is CandidateSignal {
  if (typeof value !== 'object' || value === null) return false;
  const { type, text, accept } = value as { type?: unknown; text?: unknown; accept?: unknown };
  if (!(candidateSignalTypes as readonly unknown[]).includes(type)) return false;
  if (type === 'said') return typeof text === 'string';
  if (type === 'phase-answer') return typeof accept === 'boolean';
  return true;
}
