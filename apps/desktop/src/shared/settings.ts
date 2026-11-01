import type { ModelChoice } from '@interviewharness/providers';
import { defaultOllamaAddress, keyProviderTable } from '@interviewharness/providers/defaults';
import { isTheme, type Theme } from './api.ts';

export type { ModelChoice };

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
  /** Your models: every model the candidate added, each checked to answer when it was. The pickers list only these. */
  yourModels: ModelChoice[];
  /** The model that writes the interviewer's words, one of your models. A round can't start without one. Logins live in the credential store. */
  interviewerModel: ModelChoice | null;
  /** The model that writes the Feedback, if not the interviewer's (a stronger one, say). */
  feedbackModel: ModelChoice | null;
  /** Models the candidate marked as small (see `modelKey`): their Feedback is marked rough. */
  smallModels: string[];
  /** Whether the candidate has been told their login isn't encrypted on this machine (Linux with no keyring). */
  unencryptedLoginNoted: boolean;
  /** Where Ollama listens on this computer. */
  ollamaAddress: string;
  /** Another OpenAI-compatible server (LM Studio, llama.cpp, vLLM), with its API path, e.g. http://localhost:1234/v1. Empty when none. */
  serverAddress: string;
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
  yourModels: [],
  interviewerModel: null,
  feedbackModel: null,
  smallModels: [],
  unencryptedLoginNoted: false,
  ollamaAddress: defaultOllamaAddress,
  serverAddress: '',
};

const oneOf =
  <T>(values: readonly T[]) =>
  (value: unknown): value is T =>
    (values as readonly unknown[]).includes(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isSize = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);

const modelProviders: readonly ModelChoice['provider'][] = ['chatgpt', 'ollama', ...keyProviderTable.map((row) => row.id), 'server'];

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
/** A well-formed model choice; nothing else rides along with it (a key, say). */
export const isModelChoice = (value: unknown): value is ModelChoice => {
  if (typeof value !== 'object' || value === null) return false;
  const { provider, model, ...rest } = value as Record<string, unknown>;
  return modelProviders.includes(provider as ModelChoice['provider']) && typeof model === 'string' && model.length > 0 && !Object.keys(rest).length;
};

const isPickedModel = (value: unknown): value is ModelChoice | null => value === null || isModelChoice(value);

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
  yourModels: (value): value is ModelChoice[] => Array.isArray(value) && value.every(isModelChoice),
  interviewerModel: isPickedModel,
  feedbackModel: isPickedModel,
  smallModels: isModelKeys,
  unencryptedLoginNoted: isBoolean,
  ollamaAddress: isServerAddress,
  serverAddress: (value): value is string => value === '' || isServerAddress(value),
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

/** A model's name as one string, e.g. "chatgpt/gpt-5-mini". */
export const modelKey = (choice: ModelChoice) => `${choice.provider}/${choice.model}`;

const sameModel = (a: ModelChoice, b: ModelChoice) => a.provider === b.provider && a.model === b.model;

/** Your models with `choice` added at the end, unless it's already one of them. */
export const withYourModel = (models: ModelChoice[], choice: ModelChoice) =>
  models.some((m) => sameModel(m, choice)) ? models : [...models, { provider: choice.provider, model: choice.model }];

/** A model's name back from `modelKey`'s string; the model's own id may hold slashes. Null for a provider that doesn't exist. */
export function choiceFromKey(key: string): ModelChoice | null {
  const slash = key.indexOf('/');
  const choice = { provider: key.slice(0, slash), model: key.slice(slash + 1) };
  return slash > 0 && isModelChoice(choice) ? (choice as ModelChoice) : null;
}

/** The model that writes the Feedback: the one picked for it, else the interviewer's. */
export const feedbackModel = (settings: Settings) => settings.feedbackModel ?? settings.interviewerModel;

/** What removing some of your models changes: they leave your models, and are unpicked wherever they were picked. */
export function settingsWithout(settings: Settings, removed: (choice: ModelChoice) => boolean): Partial<Settings> {
  const changes: Partial<Settings> = { yourModels: settings.yourModels.filter((choice) => !removed(choice)) };
  if (settings.interviewerModel && removed(settings.interviewerModel)) changes.interviewerModel = null;
  if (settings.feedbackModel && removed(settings.feedbackModel)) changes.feedbackModel = null;
  return changes;
}

/** What logging out of a provider changes: its models leave your models, and are no longer picked. */
export const settingsAfterLogout = (settings: Settings, provider: ModelChoice['provider']) =>
  settingsWithout(settings, (choice) => choice.provider === provider);

/** What removing one of your models changes. */
export const settingsAfterRemoving = (settings: Settings, model: ModelChoice) => settingsWithout(settings, (choice) => sameModel(choice, model));
