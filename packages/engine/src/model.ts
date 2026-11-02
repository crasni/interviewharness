/**
 * The model interface: the one seam between the engine and any LLM. The engine never knows which
 * provider is behind it; the providers package implements this, and tests use a scripted fake.
 */

/** What a model call is for. Logged with every call, and lets a fake script replies per purpose. */
export type ModelPurpose = 'interviewer-reply' | 'reply-check' | 'grading' | 'feedback-prose' | 'setup-check';

export interface ModelMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ModelRequest {
  purpose: ModelPurpose;
  system: string;
  messages: ModelMessage[];
  /** Aborts the call, e.g. when the candidate talks over the interviewer. */
  signal?: AbortSignal;
  /** A cap on the reply's length, so small models stay short and in role. */
  maxOutputTokens?: number;
}

/** A JSON Schema for a structured reply, with a check that the value really fits it. */
export interface ObjectSchema<T> {
  name: string;
  jsonSchema: Record<string, unknown>;
  /** Returns the value if it fits the schema; throws a description of what's wrong otherwise. */
  parse(value: unknown): T;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Which model answered. Never holds a key or token. */
export interface ModelIdentity {
  provider: string;
  model: string;
  /** The reasoning effort it was asked for, for a model that reasons. */
  effort?: string;
}

export interface TextResult {
  text: string;
  usage: ModelUsage;
}

export interface ObjectResult<T> {
  object: T;
  usage: ModelUsage;
}

export interface Model {
  readonly identity: ModelIdentity;
  /** Writes text, passing each piece to `onText` as it arrives; resolves with the whole text. */
  streamText(request: ModelRequest, onText?: (delta: string) => void): Promise<TextResult>;
  /** Returns a value that fits `schema`. */
  generateObject<T>(request: ModelRequest & { schema: ObjectSchema<T> }): Promise<ObjectResult<T>>;
}

/** Why a model call failed, in terms the candidate and the log can use. */
export type ModelErrorKind = 'offline' | 'auth' | 'rate-limit' | 'bad-output' | 'timeout' | 'aborted' | 'other';

export class ModelError extends Error {
  readonly kind: ModelErrorKind;

  constructor(kind: ModelErrorKind, message: string = kind) {
    super(message);
    this.name = 'ModelError';
    this.kind = kind;
  }
}

/** The failures where saying it again can bring an answer: not a failed login, nor a call that was stopped. */
export type HelpedBySayingAgain = Exclude<ModelErrorKind, 'auth' | 'aborted'>;

/** Whether a candidate whose turn got no answer should be told to say it again. */
export function sayingItAgainHelps(kind: ModelErrorKind): kind is HelpedBySayingAgain {
  return kind !== 'auth' && kind !== 'aborted';
}

/** The kind of any error a model call threw: a ModelError's own, or 'other'. */
export function modelErrorKind(error: unknown): ModelErrorKind {
  return error instanceof ModelError ? error.kind : 'other';
}

/** The longest reason kept in the log. */
const reasonLength = 200;

/**
 * Why a model call failed, in the error's own words, for the log: a ModelError's message (providers strip saved
 * keys from theirs), or any other error's name and message, since that one is a bug of ours; anything else thrown,
 * as JSON. None when the message only repeats the kind. Cut by characters, so an emoji is never split in half.
 */
export function modelErrorReason(error: unknown): string | undefined {
  const reason = error instanceof ModelError ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : printed(error);
  if (error instanceof ModelError && reason === error.kind) return undefined;
  const characters = Array.from(reason);
  return characters.length > reasonLength ? `${characters.slice(0, reasonLength - 1).join('')}…` : reason;
}

/** A thrown value that is no Error, as text: its JSON, or what String makes of it, or neither when both throw. */
function printed(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return 'A value that could not be printed';
    }
  }
}
