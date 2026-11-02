import { useEffect, useId, useState } from 'react';
import { defaultEffort, type EffortLevel, type ModelChoice, modelKey } from '../../../shared/settings.ts';
import { Picker } from '../ui/Picker.tsx';

/**
 * A model's reasoning effort, by the levels that model offers; nothing for a model that doesn't reason.
 * The effort is the model's: setting it here sets it for every role using that model.
 */
export function Reasoning({
  label,
  hideLabel = false,
  keepPlace = false,
  className,
  model,
}: {
  label: string;
  hideLabel?: boolean;
  /** With no levels, a dash in the picker's place, so every model row reads the same and the pickers line up. */
  keepPlace?: boolean;
  className: string;
  model: ModelChoice;
}) {
  const id = useId();
  const [levels, setLevels] = useState<EffortLevel[]>([]);
  const key = modelKey(model);
  useEffect(() => {
    let current = true;
    void window.harness.models.effortLevels(model).then((found) => current && setLevels(found));
    return () => {
      current = false;
    };
    // The levels belong to the model, not to its effort: looked up again only for another model.
  }, [key]);
  if (!levels.length) {
    return keepPlace ? (
      <span className={className}>
        <span className="no-effort" title="This model has no reasoning levels to pick from">
          —
        </span>
      </span>
    ) : null;
  }
  return (
    <span className={className}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <Picker
        id={id}
        value={model.effort ?? defaultEffort}
        options={levels.map((level) => ({ value: level, label: level }))}
        onChange={(effort) => void window.harness.models.setEffort(model, effort as EffortLevel)}
      />
    </span>
  );
}
