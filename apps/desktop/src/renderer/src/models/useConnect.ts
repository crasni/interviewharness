import { useCallback, useState } from 'react';
import type { ModelConnection } from '../../../shared/api.ts';

export type ConnectStep = { name: 'idle' } | { name: 'checking' } | { name: 'failed'; error: string };

/**
 * Picks a model for a slot: main asks it for one short reply first, and saves it (with its address or
 * key) only if it answers. On success the choice arrives through settings, so the screen moves on by itself.
 */
export function useConnect({ onUnencrypted }: { onUnencrypted?: () => void } = {}) {
  const [step, setStep] = useState<ConnectStep>({ name: 'idle' });

  async function connect(connection: ModelConnection) {
    setStep({ name: 'checking' });
    const result = await window.harness.models.connect(connection);
    setStep(result.ok ? { name: 'idle' } : { name: 'failed', error: result.error });
    if (result.ok && result.unencryptedNote) onUnencrypted?.();
    return result.ok;
  }

  const reset = useCallback(() => setStep({ name: 'idle' }), []);

  return { step, connect, reset };
}
