import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './icon-button.css';

/**
 * A button whose purpose is obvious from its icon. Its words stay as the accessible name and
 * show as a tooltip on hover, so nothing is lost for screen readers or the unsure.
 *
 * `swap` turns it into a two-state control: the icons cross-fade when `on` changes.
 * `motion` names the small movement the icon makes on hover (see icon-button.css).
 */
export function IconButton({
  label,
  icon,
  swap,
  on = false,
  motion,
  tip = 'below',
  className,
  ...rest
}: {
  label: string;
  icon?: ReactNode;
  swap?: { on: ReactNode; off: ReactNode };
  on?: boolean;
  motion?: 'turn' | 'spin' | 'unwind' | 'nudge';
  tip?: 'below' | 'above' | 'below-end';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      {...rest}
      className={['icon-button', className].filter(Boolean).join(' ')}
      aria-label={label}
      data-tip={label}
      data-tip-side={tip}
      data-motion={motion}
    >
      {swap ? (
        <span className="icon-swap">
          <span data-shown={on}>{swap.on}</span>
          <span data-shown={!on}>{swap.off}</span>
        </span>
      ) : (
        icon
      )}
    </button>
  );
}

/** Lucide icons at the room's size and stroke. */
export const iconProps = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;
