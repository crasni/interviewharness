import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Theme } from '../../../shared/api.ts';

export type { Theme };

export type TextSize = 'small' | 'medium' | 'large';
export type TalkMode = 'click';
export type CodeLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'cpp' | 'go';

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

const storageKey = 'settings';

// Settings are a per-person convenience kept in this app's storage: fine to lose, so a bad read means defaults.
function load(): Settings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return { ...defaultSettings, ...(typeof saved === 'object' && saved ? saved : {}) };
  } catch {
    return defaultSettings;
  }
}

function save(settings: Settings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings still apply for this run, they just won't be remembered.
  }
}

type SettingsContext = {
  settings: Settings;
  change: (changes: Partial<Settings>) => void;
  /** The settings panel, open over whichever screen is showing. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const Context = createContext<SettingsContext | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(load);
  const [panelOpen, setPanelOpen] = useState(false);

  const change = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...changes };
      save(next);
      return next;
    });
  }, []);

  // The theme is set app-wide by the main process, so prefers-color-scheme follows it (tokens.css).
  useEffect(() => window.harness.setTheme(settings.theme), [settings.theme]);

  // The type tokens (tokens.css) scale from an attribute on the root element.
  useEffect(() => {
    document.documentElement.dataset.textSize = settings.textSize;
  }, [settings.textSize]);

  // ⌘, on macOS, Ctrl+, elsewhere: the usual shortcut for settings, from any screen.
  useEffect(() => {
    const isMac = navigator.userAgent.includes('Mac');
    const toggle = (event: KeyboardEvent) => {
      const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (modifier && !event.shiftKey && !event.altKey && event.key === ',') {
        event.preventDefault();
        setPanelOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

  const value = useMemo(() => ({ settings, change, panelOpen, setPanelOpen }), [settings, change, panelOpen]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSettings() {
  const context = useContext(Context);
  if (!context) throw new Error('useSettings needs a SettingsProvider above it');
  return context;
}
