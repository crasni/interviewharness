import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import './splitter.css';

/**
 * The edge between two areas, dragged to resize one of them. A double-click resets it;
 * arrow keys move it too. It reports the new size; the caller clamps it and keeps it.
 *
 * `columns`: the edge stands between side-by-side areas and moves left and right.
 * `grows`: which way of moving makes the resized area bigger.
 */
export function Splitter({
  label,
  between,
  grows,
  size,
  min,
  max,
  onResize,
  onReset,
}: {
  label: string;
  between: 'columns' | 'rows';
  grows: 'right' | 'up';
  size: () => number;
  min: number;
  max: () => number;
  onResize: (size: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ start: number; startSize: number } | null>(null);
  const position = (event: PointerEvent) => (between === 'columns' ? event.clientX : event.clientY);
  const sign = grows === 'right' ? 1 : -1;
  const clamp = (value: number) => Math.round(Math.min(Math.max(value, min), Math.max(min, max())));

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: position(event), startSize: size() };
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag.current) return;
    onResize(clamp(drag.current.startSize + sign * (position(event) - drag.current.start)));
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = event.shiftKey ? 64 : 16;
    // Moves on screen, like a drag: right and down are positive.
    const keys: Record<string, number> =
      between === 'columns' ? { ArrowRight: step, ArrowLeft: -step } : { ArrowDown: step, ArrowUp: -step };
    const delta = keys[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    onResize(clamp(size() + sign * delta));
  }

  return (
    <div
      className="splitter"
      data-between={between}
      role="separator"
      aria-label={label}
      aria-orientation={between === 'columns' ? 'vertical' : 'horizontal'}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
