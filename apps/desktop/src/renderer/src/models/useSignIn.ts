import { useEffect, useState } from 'react';

export type LoginStep = { name: 'idle' } | { name: 'waiting' } | { name: 'failed'; error: string };

/**
 * Continue with ChatGPT, from wherever it's offered: the Start screen's first step, or Settings → Model.
 * On success main saves the choice in settings, so the screen showing it moves on by itself.
 */
export function useChatGPTLogin({ onUnencrypted }: { onUnencrypted?: () => void } = {}) {
  const [step, setStep] = useState<LoginStep>({ name: 'idle' });

  // Leaving mid-login (the screen or Settings closing) shouldn't leave a listener waiting for the browser.
  useEffect(() => () => window.harness.models.cancelLogin(), []);

  async function start() {
    setStep({ name: 'waiting' });
    const result = await window.harness.models.continueWithChatGPT();
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
