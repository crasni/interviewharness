import './presence-dot.css';

export type PresenceState = 'listening' | 'nodding' | 'speaking';

interface PresenceDotProps {
  state: PresenceState;
  /** `large` is the circle in the interviewer tile: it pulses while speaking instead of showing bars. */
  size?: 'small' | 'large';
  /** Called when a nod finishes, so the owner can return to listening. */
  onNodEnd?: () => void;
}

/** The interviewer's presence: breathes while listening, nods, shows a waveform while speaking. */
export function PresenceDot({ state, size = 'small', onNodEnd }: PresenceDotProps) {
  return (
    <div className="presence" role="status" aria-label="Interviewer" data-state={state} data-size={size}>
      <span
        className="presence-dot"
        onAnimationEnd={() => {
          // Breathing and the waveform loop forever, so only a nod ever ends.
          if (state === 'nodding') onNodEnd?.();
        }}
      />
      {state === 'speaking' && size === 'small' && (
        <span className="presence-wave" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
    </div>
  );
}
