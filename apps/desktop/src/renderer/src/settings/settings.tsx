import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Theme } from '../../../shared/api.ts';
import type { Settings } from '../../../shared/settings.ts';

export type { CodeLanguage, Settings, TalkMode, TextSize } from '../../../shared/settings.ts';
export type { Theme };

/** Where v0.0 kept settings, in the renderer's own storage, before settings.json. */
const v00StorageKey = 'settings';

/**
 * Reads the settings from main. The first time there is a new settings.json, any v0.0 settings left in
 * browser storage are handed to main once (it keeps the valid ones) and then cleared, so nothing resets.
 */
export async function loadSettings(): Promise<Settings> {
  const { values, fresh } = await window.harness.settings.get();
  let carried: unknown = null;
  try {
    const saved = localStorage.getItem(v00StorageKey);
    if (saved !== null) {
      localStorage.removeItem(v00StorageKey);
      if (fresh) carried = JSON.parse(saved);
    }
  } catch {
    // Unreadable or unavailable: nothing to carry over.
  }
  if (typeof carried !== 'object' || carried === null) return values;
  window.harness.settings.change(carried as Partial<Settings>);
  return (await window.harness.settings.get()).values;
}

/** Sets the theme and resolves once the page's colour scheme has followed (it changes a moment after main's). */
async function applyTheme(theme: Theme) {
  const dark = await window.harness.setTheme(theme);
  const query = matchMedia('(prefers-color-scheme: dark)');
  if (query.matches === dark) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      query.removeEventListener('change', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 500); // never hold the cross-fade's snapshot longer than this
    query.addEventListener('change', done);
  });
}

type SettingsContext = {
  settings: Settings;
  change: (changes: Partial<Settings>) => void;
  /** The settings panel, open over whichever screen is showing. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const Context = createContext<SettingsContext | null>(null);

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  const [panelOpen, setPanelOpen] = useState(false);

  // Shown at once; main saves it. Main only reports back changes made elsewhere.
  const change = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...changes }));
    window.harness.settings.change(changes);
  }, []);

  useEffect(() => window.harness.settings.onChange(setSettings), []);

  // The theme is set app-wide by the main process, so prefers-color-scheme follows it (tokens.css).
  // When the candidate changes it, colours ease across for one fade (base.css) instead of flipping at once.
  const themeApplied = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    if (!themeApplied.current) {
      themeApplied.current = true;
      void applyTheme(settings.theme);
      return;
    }
    root.dataset.themeChanging = 'true';
    let done: ReturnType<typeof setTimeout>;
    void applyTheme(settings.theme).then(() => {
      const fade = parseFloat(getComputedStyle(root).getPropertyValue('--fade')) || 0;
      done = setTimeout(() => delete root.dataset.themeChanging, fade);
    });
    return () => clearTimeout(done);
  }, [settings.theme]);

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
