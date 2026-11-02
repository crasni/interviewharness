import { useCallback, useState } from 'react';
import type { ConnectResult, KeyReplacement, ModelConnection } from '../../../shared/api.ts';

export type ConnectStep = { name: 'idle' } | { name: 'checking' } | { name: 'failed'; error: string };

/**
 * Picks a model for a slot: main asks it for one short reply first, and saves it (with its address or
 * key) only if it answers. On success the choice arrives through settings, so the screen moves on by itself.
 */
export function useConnect({ onUnencrypted }: { onUnencrypted?: () => void } = {}) {
  const [step, setStep] = useState<ConnectStep>({ name: 'idle' });

  async function checked(run: () => Promise<ConnectResult>) {
    setStep({ name: 'checking' });
    const result = await run();
    setStep(result.ok ? { name: 'idle' } : { name: 'failed', error: result.error });
    if (result.ok && result.unencryptedNote) onUnencrypted?.();
    return result.ok;
  }

  const connect = (connection: ModelConnection) => checked(() => window.harness.models.connect(connection));
  /** Saves a new key in place of the old once a model answers through it; your models and the picks stay. */
  const replaceKey = (replacement: KeyReplacement) => checked(() => window.harness.models.replaceKey(replacement));

  const reset = useCallback(() => setStep({ name: 'idle' }), []);

  return { step, connect, replaceKey, reset };
}
