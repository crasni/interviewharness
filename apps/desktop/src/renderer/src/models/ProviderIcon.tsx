import { Server } from 'lucide-react';
import type { ModelChoice } from '../../../shared/settings.ts';
import './provider-icon.css';

// Each provider's logo (see icons/LICENSE.md), read as markup so the one-colour ones take the text colour.
const logos = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./icons/*.svg', { query: '?raw', import: 'default', eager: true })).map(([path, svg]) => [
    path.slice('./icons/'.length, -'.svg'.length),
    svg.trim(), // no trailing newline, which would show up in the text of whatever it sits in
  ]),
);

/** The logo ChatGPT is shown with: OpenAI's, whose plan it is. */
const logoNames: Partial<Record<ModelChoice['provider'], string>> = { chatgpt: 'openai' };

/**
 * A provider's logo, beside its name; a plain server glyph for a server of the candidate's own. Decorative:
 * the name next to it says the same, so screen readers skip it. Nothing for a provider with no logo.
 */
export function ProviderIcon({ provider }: { provider: ModelChoice['provider'] }) {
  if (provider === 'server') return <Server className="provider-icon" size={16} strokeWidth={1.75} aria-hidden />;
  const svg = logos[logoNames[provider] ?? provider];
  // The files are the app's own, copied in, never anything from outside: safe to set as markup.
  return svg ? <span className="provider-icon" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} /> : null;
}
