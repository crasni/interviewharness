import { useEffect, useState } from 'react';

type Step = { name: 'idle' } | { name: 'waiting' } | { name: 'failed'; error: string };

/**
 * The one step before a first round: pick the model the interviewer talks with. For now that's the
 * candidate's ChatGPT plan; Ollama and API keys join here later.
 */
export function ModelStep({ onUnencrypted }: { onUnencrypted: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'idle' });

  // Leaving the screen mid-login (e.g. the window closing) shouldn't leave the browser's listener waiting.
  useEffect(() => () => window.harness.models.cancelLogin(), []);

  async function continueWithChatGPT() {
    setStep({ name: 'waiting' });
    const result = await window.harness.models.continueWithChatGPT();
    if (result.ok) {
      if (result.unencryptedNote) onUnencrypted();
      return; // settings now hold the model, and the Start screen moves on by itself
    }
    setStep(result.cancelled ? { name: 'idle' } : { name: 'failed', error: result.error });
  }

  return (
    <section className="model-step" aria-labelledby="model-step-title">
      <h2 id="model-step-title" className="model-step-title">
        Pick a model
      </h2>
      <p className="model-step-lede">The interviewer needs a model to think with. You only do this once.</p>
      {step.name === 'waiting' ? (
        <div className="model-step-actions">
          <p className="model-step-status" role="status">
            Finish signing in in your browser…
          </p>
          <button type="button" onClick={() => window.harness.models.cancelLogin()}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="model-step-actions">
          <button type="button" className="primary" onClick={() => void continueWithChatGPT()}>
            Continue with ChatGPT
          </button>
          <p className="model-step-note">Signs in through your browser, and uses your ChatGPT plan.</p>
        </div>
      )}
      {step.name === 'failed' && (
        <p className="model-step-error" role="alert">
          {step.error}
        </p>
      )}
    </section>
  );
}
