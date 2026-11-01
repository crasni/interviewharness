import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadSettings } from './settings/settings.tsx';
import './ui/base.css';
import { trackInputMode } from './ui/input-mode.ts';

trackInputMode();

// Settings come from main before the first paint, so the theme and text size never flash from a default.
void loadSettings().then((settings) => createRoot(document.getElementById('root')!).render(<App settings={settings} />));
