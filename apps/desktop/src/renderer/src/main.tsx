import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './ui/base.css';
import { trackInputMode } from './ui/input-mode.ts';

trackInputMode();

createRoot(document.getElementById('root')!).render(<App />);
