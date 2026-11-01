import type { ModelChoice, Server } from '@interviewharness/providers';
import { defaultOllamaAddress, serverFormats } from '@interviewharness/providers/defaults';
import { isTheme, type Theme } from './api.ts';

export type { ModelChoice, Server };

export const textSizes = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof textSizes)[number];
export const talkModes = ['click'] as const;
export type TalkMode = (typeof talkModes)[number];
export const codeLanguages = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go'] as const;
export type CodeLanguage = (typeof codeLanguages)[number];

/** The candidate's choices: how the room looks and behaves, and which model the interviewer runs on. None changes how the interviewer judges them. */
export type Settings = {
  textSize: TextSize;
  theme: Theme;
  /** Whether the transcript is shown when a round opens. */
  transcriptShown: boolean;
  /** Speech detection joins once the mic exists (v0.2). */
  talkMode: TalkMode;
  language: CodeLanguage;
  autocomplete: boolean;
  highlighting: boolean;
  /** Typing an opening bracket or quote adds its closing one. */
  closeBrackets: boolean;
  /** The bracket next to the cursor and its partner are marked. */
  matchBrackets: boolean;
  /** Ctrl/⌘+F opens find and replace in the editor. */
  findReplace: boolean;
  /** Long lines wrap instead of scrolling sideways. */
  wrapLines: boolean;
  /** Dragged sizes in px; null means the default size. */
  problemWidth: number | null;
  conversationHeight: number | null;
  /** The model that writes the interviewer's words. A round can't start without one. Logins live in the credential store. */
  interviewerModel: ModelChoice | null;
  /** The model that writes the Feedback, if not the interviewer's (a stronger one, say). */
  feedbackModel: ModelChoice | null;
  /** Models the candidate marked as small (see `modelKey`): their Feedback is marked rough. */
  smallModels: string[];
  /** Whether the candidate has been told their login isn't encrypted on this machine (Linux with no keyring). */
  unencryptedLoginNoted: boolean;
  /** Where Ollama listens on this computer. */
  ollamaAddress: string;
  /** The candidate's own servers (LM Studio, llama.cpp, vLLM, a gateway), each by name. Their keys live in the credential store. */
  servers: Server[];
};

export const defaultSettings: Settings = {
  textSize: 'medium',
  theme: 'system',
  transcriptShown: true,
  talkMode: 'click',
  language: 'python',
  autocomplete: true,
  highlighting: true,
  closeBrackets: true,
  matchBrackets: true,
  findReplace: true,
  wrapLines: true,
  problemWidth: null,
  conversationHeight: null,
  interviewerModel: null,
  feedbackModel: null,
  smallModels: [],
  unencryptedLoginNoted: false,
  ollamaAddress: defaultOllamaAddress,
  servers: [],
};

const oneOf =
  <T>(values: readonly T[]) =>
  (value: unknown): value is T =>
    (values as readonly unknown[]).includes(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isSize = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);

const modelProviders: readonly ModelChoice['provider'][] = ['chatgpt', 'ollama', 'openai', 'anthropic', 'google', 'openrouter', 'server'];

/** An http(s) address with nothing that could carry a credential (user:password@). */
export function isServerAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}
/** A server's id: made by the app, so plain; never holds a slash, which `modelKey` relies on. */
export const isServerId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,64}$/.test(value);

const isModelChoice = (value: unknown): value is ModelChoice | null => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const { provider, model, server, ...rest } = value as Record<string, unknown>;
  // A server's model names its server; no other model names one.
  const serverNamed = provider === 'server' ? isServerId(server) : server === undefined;
  return modelProviders.includes(provider as ModelChoice['provider']) && typeof model === 'string' && model.length > 0 && serverNamed && !Object.keys(rest).length;
};

/** A server's name, as the candidate typed it: something to tell it by, and short. */
export const isServerName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;

const isServer = (value: unknown): value is Server => {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, address, format, ...rest } = value as Record<string, unknown>;
  return isServerId(id) && isServerName(name) && isServerAddress(address) && (serverFormats as readonly unknown[]).includes(format) && !Object.keys(rest).length;
};

const isServers = (value: unknown): value is Server[] =>
  Array.isArray(value) && value.length <= 100 && value.every(isServer) && new Set(value.map((server: Server) => server.id)).size === value.length;

const isModelKeys = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((key) => typeof key === 'string' && key.includes('/'));

const validators: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  textSize: oneOf(textSizes),
  theme: isTheme,
  transcriptShown: isBoolean,
  talkMode: oneOf(talkModes),
  language: oneOf(codeLanguages),
  autocomplete: isBoolean,
  highlighting: isBoolean,
  closeBrackets: isBoolean,
  matchBrackets: isBoolean,
  findReplace: isBoolean,
  wrapLines: isBoolean,
  problemWidth: isSize,
  conversationHeight: isSize,
  interviewerModel: isModelChoice,
  feedbackModel: isModelChoice,
  smallModels: isModelKeys,
  unencryptedLoginNoted: isBoolean,
  ollamaAddress: isServerAddress,
  servers: isServers,
};

/**
 * The settings in `raw` that are known and valid; everything else is dropped.
 * Used for what the file holds and for every change the renderer asks for, since neither is trusted.
 */
export function validSettings(raw: unknown): Partial<Settings> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const valid: Partial<Record<keyof Settings, unknown>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const validate = validators[key as keyof Settings] as ((v: unknown) => boolean) | undefined;
    if (Object.hasOwn(validators, key) && validate?.(value)) valid[key as keyof Settings] = value;
  }
  return valid as Partial<Settings>;
}

/** A model's name as one string, e.g. "chatgpt/gpt-5-mini"; a server's model names its server, e.g. "server/home/qwen3-8b". */
export const modelKey = (choice: ModelChoice) =>
  choice.provider === 'server' ? `server/${choice.server}/${choice.model}` : `${choice.provider}/${choice.model}`;

/** A model's name back from `modelKey`'s string; the model's own id may hold slashes. Null for a provider that doesn't exist. */
export function choiceFromKey(key: string): ModelChoice | null {
  const slash = key.indexOf('/');
  const provider = key.slice(0, slash);
  const rest = key.slice(slash + 1);
  const serverSlash = rest.indexOf('/');
  const choice = provider === 'server' ? { provider, server: rest.slice(0, serverSlash), model: rest.slice(serverSlash + 1) } : { provider, model: rest };
  const whole = slash > 0 && (provider !== 'server' || serverSlash > 0);
  return whole && isModelChoice(choice) ? (choice as ModelChoice) : null;
}

/** The model that writes the Feedback: the one picked for it, else the interviewer's. */
export const feedbackModel = (settings: Settings) => settings.feedbackModel ?? settings.interviewerModel;

/** What logging out of a provider changes: models from it are no longer picked. */
export function settingsAfterLogout(settings: Settings, provider: ModelChoice['provider']): Partial<Settings> {
  const changes: Partial<Settings> = {};
  if (settings.interviewerModel?.provider === provider) changes.interviewerModel = null;
  if (settings.feedbackModel?.provider === provider) changes.feedbackModel = null;
  return changes;
}

/** What removing one of the candidate's servers changes: it's gone, and its models are no longer picked. */
export function settingsAfterRemovingServer(settings: Settings, server: string): Partial<Settings> {
  const onIt = (choice: ModelChoice | null) => choice?.provider === 'server' && choice.server === server;
  const changes: Partial<Settings> = { servers: settings.servers.filter((each) => each.id !== server) };
  if (onIt(settings.interviewerModel)) changes.interviewerModel = null;
  if (onIt(settings.feedbackModel)) changes.feedbackModel = null;
  return changes;
}
