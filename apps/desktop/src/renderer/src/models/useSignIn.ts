import { useEffect, useState } from 'react';

export type LoginStep = { name: 'idle' } | { name: 'waiting' } | { name: 'failed'; error: string };

/** The providers signed in to through the browser. */
export type SignInProvider = 'chatgpt' | 'openrouter';

/**
 * Signing in through the browser, from wherever it's offered: Continue with ChatGPT (the Start screen's
 * first step, or Settings → Model), or Sign in with OpenRouter. On ChatGPT's success main adds its default
 * model through settings, so the screen showing it moves on by itself; OpenRouter's only saves the key.
 */
export function useSignIn({ provider = 'chatgpt', onUnencrypted }: { provider?: SignInProvider; onUnencrypted?: () => void } = {}) {
  const [step, setStep] = useState<LoginStep>({ name: 'idle' });

  // Leaving mid-login (the screen or Settings closing) shouldn't leave a listener waiting for the browser.
  useEffect(() => () => window.harness.models.cancelLogin(), []);

  async function start() {
    setStep({ name: 'waiting' });
    const result = provider === 'openrouter' ? await window.harness.models.signInToOpenRouter() : await window.harness.models.continueWithChatGPT();
    if (result.ok) {
      setStep({ name: 'idle' });
      if (result.unencryptedNote) onUnencrypted?.();
    } else {
      setStep(result.cancelled ? { name: 'idle' } : { name: 'failed', error: result.error });
    }
    return result.ok;
  }

  return { step, start, cancel: () => window.harness.models.cancelLogin() };
}
