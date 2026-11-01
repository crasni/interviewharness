import { useState } from 'react';
import { KeyForm } from '../models/KeyForm.tsx';
import { OllamaPicker } from '../models/OllamaPicker.tsx';
import { useChatGPTLogin } from '../models/useChatGPTLogin.ts';

/**
 * The one step before a first round: pick the model the interviewer talks with. The candidate's ChatGPT
 * plan, Ollama on this computer, or an API key (or another OpenAI-compatible server).
 */
export function ModelStep({ onUnencrypted }: { onUnencrypted: () => void }) {
  const { step, start, cancel } = useChatGPTLogin({ onUnencrypted });
  const [addingKey, setAddingKey] = useState(false);

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

      <section className="model-option" aria-labelledby="model-step-ollama">
        <h3 id="model-step-ollama" className="model-option-title">
          Ollama on this computer
        </h3>
        <OllamaPicker />
      </section>

      <section className="model-option" aria-labelledby="model-step-key">
        <div className="model-option-head">
          <h3 id="model-step-key" className="model-option-title">
            API key or other server
          </h3>
          {!addingKey && (
            <button type="button" onClick={() => setAddingKey(true)}>
              Add
            </button>
          )}
        </div>
        {addingKey && <KeyForm onUnencrypted={onUnencrypted} />}
      </section>
    </section>
  );
}
