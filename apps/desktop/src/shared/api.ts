import type { RoundKind } from '@interviewharness/core';
import type { CodeSnapshot, Difficulty, FeedbackPoint, InterviewerEvent, ModelErrorKind, RoundSnapshot, Signal } from '@interviewharness/engine';
import type { Verdict } from '@interviewharness/core';
import type { Connection, ModelListing, Server } from '@interviewharness/providers';
import type { EffortLevel, ModelChoice, Settings } from './settings.ts';

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

/** The round's problem as the candidate sees it: never its notes, hints or reference. */
export interface RoundProblem {
  name: string;
  title: string;
  statement: string;
}

/** A problem as the Start screen lists it: never its topic, which gives the approach away. */
export interface ProblemChoice {
  name: string;
  title: string;
  difficulty: Difficulty;
  /** Rounds done on it so far, counted from the saved rounds. */
  timesDone: number;
}

/** A round as the room shows it: its state, and the problem it's on. */
export type RoomSnapshot = RoundSnapshot & { problem: RoundProblem };

// The only surface the renderer has into the main process.
export interface HarnessApi {
  /** Starts a round on the problem named, or on one picked at random when none is. */
  startRound(kind: RoundKind, problem?: string): Promise<RoomSnapshot>;
  roundSnapshot(): Promise<RoomSnapshot | null>;
  /** Every problem a round can be on, easiest first. */
  problems(): Promise<ProblemChoice[]>;
  /** Ends the round in progress, with the code as it was left, and returns how it ended. Grading starts at once. */
  endRound(code?: CodeSnapshot): Promise<RoomSnapshot | null>;
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
     * Opens ChatGPT's sign-in in the browser and resolves once it comes back. Its default model is then
     * checked, and joins your models (and the interviewer, if none is picked) once it answers, announced
     * through settings.onChange. If it doesn't answer, the sign-in is kept and the result says why.
     */
    continueWithChatGPT(): Promise<LoginResult>;
    /** Gives up on a login that is waiting for the browser. */
    cancelLogin(): void;
    /** Each provider, whether it's connected, and its models. Never a credential. */
    providers(): Promise<ProviderStatus[]>;
    /** A provider's models, reached through an address or key not saved yet if given. */
    list(provider: ModelChoice['provider'], connection?: Connection): Promise<ModelList>;
    /**
     * Checks that a model answers, then adds it to your models and picks it for its slot (with none, for the
     * interviewer only if none is picked), saving the address and key it was reached with (announced through
     * settings.onChange). Used to add a connection and to add a model.
     */
    connect(connection: ModelConnection): Promise<ConnectResult>;
    /** Checks that a model answers through a new key, then saves the key in place of the old one. Your models and the picks stay as they are. */
    replaceKey(replacement: KeyReplacement): Promise<ConnectResult>;
    /**
     * Forgets a provider's login or key, and removes its models from your models (announced through
     * settings.onChange). For a server, `server` names which one; the server itself is removed too.
     */
    logout(provider: ModelChoice['provider'], server?: string): Promise<void>;
    /**
     * Opens OpenRouter's sign-in in the browser and resolves once it comes back, with the key OpenRouter
     * issues saved. Picks no model. Cancelled with cancelLogin.
     */
    signInToOpenRouter(): Promise<LoginResult>;
    /** Takes a model off your models, and unpicks it wherever it was picked (announced through settings.onChange). */
    removeModel(model: ModelChoice): Promise<void>;
    /** The reasoning efforts a model offers, by its provider's names; none for a model that doesn't reason. */
    effortLevels(model: ModelChoice): Promise<EffortLevel[]>;
    /** Sets one of your models' reasoning effort, shared by every role using it (announced through settings.onChange). */
    setEffort(model: ModelChoice, effort: EffortLevel): Promise<void>;
    /** Opens the page where a key provider's keys are made, in the browser. Main opens only the pages in the table of key providers. */
    openKeyPage(provider: ModelChoice['provider']): void;
    /** A server's models: a saved one's, or through an address, format or key not saved yet. */
    listServer(listing: ServerListing): Promise<ModelList>;
    /** Adds a server once a model on it answers; the model joins your models (announced through settings.onChange). */
    addServer(setup: ServerSetup): Promise<ConnectResult>;
    /** Changes a server once a model on it answers; no key typed keeps the saved one. */
    editServer(setup: ServerSetup & { server: string }): Promise<ConnectResult>;
  };
}

/** A server's fields as the candidate fills them in, to add it (no `server`) or edit it. The key is never sent back. */
export interface ServerSetup {
  server?: string;
  name: string;
  address: string;
  format: Server['format'];
  /** Typed in; empty when the server needs none, or (editing) to keep the saved one. */
  key?: string;
  /** A model on the server, listed or typed, that's checked to answer. */
  model: string;
  /** Picks the model for this slot too. With none, a server added is the interviewer's only if none is picked. */
  slot?: Slot;
}

/** Which server's models to list: a saved one (`server`), maybe through new fields, or a new one at `address`. */
export interface ServerListing {
  server?: string;
  address?: string;
  format?: Server['format'];
  key?: string;
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
  /** For one of the candidate's servers: which, as saved (never its key). */
  server?: Server;
}

/** The Feedback as the candidate sees it: words and moments, no scores (those stay in the round's feedback.json). */
export type FeedbackResult =
  | { ok: true; verdict: Verdict; why: string; wentWell: FeedbackPoint[]; toFix: FeedbackPoint[]; rough: boolean }
  | { ok: false; error: ModelErrorKind | 'no-model' | 'no-round' | 'nothing-said' };

/** Which model a choice is for: the interviewer's words, or the Feedback. */
export type Slot = 'interviewer' | 'feedback' | 'check';

/**
 * A model to pick for a slot, with the address (Ollama, a server) or key (a pasted API key, a server's
 * optional one) to reach it if they're new. Checked by main before anything is saved.
 */
export interface ModelConnection extends Connection {
  /** With none (a connection added in Settings), the model is the interviewer's only if none is picked yet. */
  slot?: Slot;
  provider: ModelChoice['provider'];
  model: string;
  /** For a model on one of the candidate's saved servers: which. */
  server?: string;
}

/** A new key for a key provider already connected, and a model to check it with (which isn't added to your models). */
export interface KeyReplacement {
  provider: ModelChoice['provider'];
  model: string;
  key: string;
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
  problems: 'problems:list',
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
  replaceKey: 'models:replace-key',
  logout: 'models:logout',
  signInToOpenRouter: 'models:openrouter-sign-in',
  removeModel: 'models:remove-model',
  effortLevels: 'models:effort-levels',
  setEffort: 'models:set-effort',
  openKeyPage: 'models:open-key-page',
  listServer: 'models:server-list',
  addServer: 'models:server-add',
  editServer: 'models:server-edit',
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
