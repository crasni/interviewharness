import type { RoundKind } from '@interviewharness/core';
import type { InterviewerEvent, RoundSnapshot, Signal } from '@interviewharness/engine';
import type { Settings } from './settings.ts';

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

/** What the room is told: the interviewer's decisions worth showing, and notices about its model. */
export type { InterviewerEvent };

// The only surface the renderer has into the main process.
export interface HarnessApi {
  startRound(kind: RoundKind): Promise<RoundSnapshot>;
  roundSnapshot(): Promise<RoundSnapshot | null>;
  /** Ends the round in progress and returns how it ended. */
  endRound(): Promise<RoundSnapshot | null>;
  signal(signal: CandidateSignal): void;
  /** Subscribes to the interviewer's decisions and notices; returns an unsubscribe function. */
  onDecision(listener: (event: InterviewerEvent) => void): () => void;
  /**
   * Sets the app's theme, so prefers-color-scheme, scrollbars and the window itself all follow it.
   * Resolves to whether the app is now dark.
   */
  setTheme(theme: Theme): Promise<boolean>;
  /** The candidate's settings, kept by main in settings.json. */
  settings: {
    /** The settings now in force, and whether settings.json was new this launch. */
    get(): Promise<{ values: Settings; fresh: boolean }>;
    /** Changes some settings. Main keeps only valid ones. */
    change(changes: Partial<Settings>): void;
    /** Subscribes to changes made elsewhere (main, or another window); returns an unsubscribe function. */
    onChange(listener: (values: Settings) => void): () => void;
  };
}

export const channels = {
  startRound: 'round:start',
  roundSnapshot: 'round:snapshot',
  endRound: 'round:end',
  signal: 'floor:signal',
  decision: 'floor:decision',
  setTheme: 'window:theme',
  getSettings: 'settings:get',
  changeSettings: 'settings:change',
  settingsChanged: 'settings:changed',
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
