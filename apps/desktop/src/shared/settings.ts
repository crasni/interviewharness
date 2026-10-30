import type { ModelChoice } from '@interviewharness/providers';
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
};

export const defaultSettings: Settings = {
  textSize: 'medium',
  theme: 'system',
  transcriptShown: true,
  talkMode: 'click',
  language: 'python',
  autocomplete: true,
  highlighting: true,
  problemWidth: null,
  conversationHeight: null,
  interviewerModel: null,
  feedbackModel: null,
  smallModels: [],
  unencryptedLoginNoted: false,
};

const oneOf =
  <T>(values: readonly T[]) =>
  (value: unknown): value is T =>
    (values as readonly unknown[]).includes(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isSize = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);

const modelProviders: readonly ModelChoice['provider'][] = ['chatgpt'];
const isModelChoice = (value: unknown): value is ModelChoice | null => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const { provider, model, ...rest } = value as Record<string, unknown>;
  return modelProviders.includes(provider as ModelChoice['provider']) && typeof model === 'string' && model.length > 0 && !Object.keys(rest).length;
};

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
  problemWidth: isSize,
  conversationHeight: isSize,
  interviewerModel: isModelChoice,
  feedbackModel: isModelChoice,
  smallModels: isModelKeys,
  unencryptedLoginNoted: isBoolean,
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

/** The model that writes the Feedback: the one picked for it, else the interviewer's. */
export const feedbackModel = (settings: Settings) => settings.feedbackModel ?? settings.interviewerModel;

/** What logging out of a provider changes: models from it are no longer picked. */
export function settingsAfterLogout(settings: Settings, provider: ModelChoice['provider']): Partial<Settings> {
  const changes: Partial<Settings> = {};
  if (settings.interviewerModel?.provider === provider) changes.interviewerModel = null;
  if (settings.feedbackModel?.provider === provider) changes.feedbackModel = null;
  return changes;
}
