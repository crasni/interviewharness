import { ModelSetup } from '../models/ModelSetup.tsx';

/** The one step before a first round: pick the model the interviewer thinks with. */
export function ModelStep({ onUnencrypted }: { onUnencrypted: () => void }) {
  return (
    <section className="model-step" aria-labelledby="model-step-title">
      <header className="model-step-head">
        <h2 id="model-step-title" className="model-step-title">
          Pick a model
        </h2>
        <p className="model-step-lede">The interviewer needs a model to think with. You only do this once.</p>
      </header>
      <ModelSetup onUnencrypted={onUnencrypted} />
    </section>
  );
}
