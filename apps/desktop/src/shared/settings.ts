import { isTheme, type Theme } from './api.ts';

export const textSizes = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof textSizes)[number];
export const talkModes = ['click'] as const;
export type TalkMode = (typeof talkModes)[number];
export const codeLanguages = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go'] as const;
export type CodeLanguage = (typeof codeLanguages)[number];

/** How the room looks and behaves for this candidate. Never changes how the interviewer judges them. */
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
};

const oneOf =
  <T>(values: readonly T[]) =>
  (value: unknown): value is T =>
    (values as readonly unknown[]).includes(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isSize = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);

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
