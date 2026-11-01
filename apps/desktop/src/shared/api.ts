import type { RoundKind } from '@interviewharness/core';
import type { CodeSnapshot, FeedbackPoint, InterviewerEvent, ModelErrorKind, RoundSnapshot, Signal } from '@interviewharness/engine';
import type { Verdict } from '@interviewharness/core';
import type { Connection, ModelListing } from '@interviewharness/providers';
import type { ModelChoice, Settings } from './settings.ts';

/** Signals the candidate can send. Ticks come from the main process, never the renderer. */
export const candidateSignalTypes = [
  'talk-start',
  'talk-end',
  'said',
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
  /** Ends the round in progress, with the code as it was left, and returns how it ended. Grading starts at once. */
  endRound(code?: CodeSnapshot): Promise<RoundSnapshot | null>;
  /** The Feedback on the round that just ended. */
  feedback: {
    /** Resolves once it's written (or has failed). */
    result(): Promise<FeedbackResult>;
    /** Writes it again after a failure; the round's record is kept, so nothing else is needed. */
    retry(): Promise<FeedbackResult>;
  };
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
  /** Picking the interviewer's model. Logins stay in main; the renderer only learns whether one worked. */
  models: {
    /**
     * Opens ChatGPT's sign-in in the browser and resolves once it comes back. On success the choice
     * is saved in settings (and announced through settings.onChange).
     */
    continueWithChatGPT(): Promise<LoginResult>;
    /** Gives up on a login that is waiting for the browser. */
    cancelLogin(): void;
    /** Each provider, whether it's connected, and its models. Never a credential. */
    providers(): Promise<ProviderStatus[]>;
    /** A provider's models, reached through an address or key not saved yet if given. */
    list(provider: ModelChoice['provider'], connection?: Connection): Promise<ModelList>;
    /** Checks that a model answers, then saves it for its slot with its address and key (announced through settings.onChange). */
    connect(connection: ModelConnection): Promise<ConnectResult>;
    /** Forgets a provider's login or key (a server's address too), and unpicks its models (announced through settings.onChange). */
    logout(provider: ModelChoice['provider']): Promise<void>;
    /**
     * Opens OpenRouter's sign-in in the browser and resolves once it comes back, with the key OpenRouter
     * issues saved. Picks no model. Cancelled with cancelLogin.
     */
    signInToOpenRouter(): Promise<LoginResult>;
  };
}

export interface ProviderStatus {
  provider: ModelChoice['provider'];
  /** The provider's name as the candidate knows it. */
  name: string;
  /** Signed in, a key saved, or (Ollama, a server) answering at its address. */
  connected: boolean;
  /** Connected by signing in (ChatGPT, OpenRouter) rather than with a pasted key. */
  signedIn?: boolean;
  /** Its models, when connected. */
  models: ModelListing[];
  /** Why it isn't connected, when that's worth saying (Ollama not running). */
  error?: string;
}

/** The Feedback as the candidate sees it: words and moments, no scores (those stay in the round's feedback.json). */
export type FeedbackResult =
  | { ok: true; verdict: Verdict; why: string; wentWell: FeedbackPoint[]; toFix: FeedbackPoint[]; rough: boolean }
  | { ok: false; error: ModelErrorKind | 'no-model' | 'no-round' | 'nothing-said' };

/** Which model a choice is for: the interviewer's words, or the Feedback. */
export type Slot = 'interviewer' | 'feedback';

/**
 * A model to pick for a slot, with the address (Ollama, a server) or key (a pasted API key, a server's
 * optional one) to reach it if they're new. Checked by main before anything is saved.
 */
export interface ModelConnection extends Connection {
  slot: Slot;
  provider: ModelChoice['provider'];
  model: string;
}

export type ConnectResult =
  /** `unencryptedNote`: say once that the key isn't encrypted on this machine (Linux with no keyring). */
  | { ok: true; unencryptedNote: boolean }
  | { ok: false; error: string };

export type { Connection, ModelListing };

export type ModelList = { ok: true; models: ModelListing[] } | { ok: false; error: string };

export type LoginResult =
  /** `unencryptedNote`: say once that the login isn't encrypted on this machine (Linux with no keyring). */
  | { ok: true; unencryptedNote: boolean }
  | { ok: false; cancelled: boolean; error: string };

export const channels = {
  startRound: 'round:start',
  roundSnapshot: 'round:snapshot',
  endRound: 'round:end',
  feedbackResult: 'feedback:result',
  feedbackRetry: 'feedback:retry',
  signal: 'floor:signal',
  decision: 'floor:decision',
  setTheme: 'window:theme',
  getSettings: 'settings:get',
  changeSettings: 'settings:change',
  settingsChanged: 'settings:changed',
  continueWithChatGPT: 'models:chatgpt-login',
  cancelLogin: 'models:cancel-login',
  providers: 'models:providers',
  listModels: 'models:list',
  connect: 'models:connect',
  logout: 'models:logout',
  signInToOpenRouter: 'models:openrouter-sign-in',
} as const;

export function isTheme(value: unknown): value is Theme {
  return (themes as readonly unknown[]).includes(value);
}

/** Checks a signal arriving over IPC: the renderer is not trusted to send well-formed data. */
export function isCandidateSignal(value: unknown): value is CandidateSignal {
  if (typeof value !== 'object' || value === null) return false;
  const { type, text, code } = value as { type?: unknown; text?: unknown; code?: unknown };
  if (!(candidateSignalTypes as readonly unknown[]).includes(type)) return false;
  if (type === 'said') return typeof text === 'string' && (code === undefined || isCodeSnapshot(code));
  return true;
}

/** A code snapshot as the renderer sends it: a language and the code, capped so a paste can't flood the log. */
export function isCodeSnapshot(value: unknown): value is CodeSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const { language, text } = value as { language?: unknown; text?: unknown };
  return typeof language === 'string' && language.length <= 20 && typeof text === 'string' && text.length <= 100_000;
}
