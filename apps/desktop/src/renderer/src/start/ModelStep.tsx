import { useChatGPTLogin } from '../models/useChatGPTLogin.ts';

/**
 * The one step before a first round: pick the model the interviewer talks with. For now that's the
 * candidate's ChatGPT plan; Ollama and API keys join here later.
 */
export function ModelStep({ onUnencrypted }: { onUnencrypted: () => void }) {
  const { step, start, cancel } = useChatGPTLogin({ onUnencrypted });

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
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="model-step-actions">
          <button type="button" className="primary" onClick={() => void start()}>
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
