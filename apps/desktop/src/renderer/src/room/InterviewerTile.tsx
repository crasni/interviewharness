import { type PointerEvent, useLayoutEffect, useRef, useState } from 'react';
import { PresenceDot, type PresenceState } from '../ui/PresenceDot.tsx';

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const cornerKey = 'interviewer-tile-corner';
const corners: Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

// The chosen corner is a per-person convenience: remembered in this browser, fine to lose.
function savedCorner(): Corner {
  try {
    const saved = localStorage.getItem(cornerKey);
    return corners.includes(saved as Corner) ? (saved as Corner) : 'bottom-right';
  } catch {
    return 'bottom-right';
  }
}

function saveCorner(corner: Corner) {
  try {
    localStorage.setItem(cornerKey, corner);
  } catch {
    // Storage unavailable: the tile still works, it just won't remember.
  }
}

/**
 * The interviewer, like a video-call tile: an animated circle and what it is doing.
 * Drag it anywhere; when let go it glides to the nearest corner of the work area.
 */
export function InterviewerTile({
  presence,
  label,
  onNodEnd,
}: {
  presence: PresenceState;
  label: string;
  onNodEnd: () => void;
}) {
  const [corner, setCorner] = useState<Corner>(savedCorner);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number } | null>(null);
  const tile = useRef<HTMLDivElement>(null);
  // Where the tile was on screen when let go; the glide to its corner starts there.
  const releasedAt = useRef<DOMRect | null>(null);

  // FLIP: the corner is set by `top`/`bottom`/`left`/`right`, which can't be transitioned
  // between, so after the jump we animate a transform from the old spot back to zero.
  useLayoutEffect(() => {
    const element = tile.current;
    const from = releasedAt.current;
    releasedAt.current = null;
    if (!element || !from) return;
    const to = element.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (dx === 0 && dy === 0) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const style = getComputedStyle(element);
    element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: parseFloat(style.getPropertyValue('--settle')) || 0,
      easing: style.getPropertyValue('--ease').trim() || 'ease-out',
    });
  }, [corner, offset]);

  function onPointerDown(event: PointerEvent) {
    const element = event.currentTarget as HTMLDivElement;
    element.setPointerCapture(event.pointerId);
    // Grabbed mid-glide: freeze it where it is and carry on dragging from there.
    const seen = element.getBoundingClientRect();
    element.getAnimations().forEach((animation) => animation.cancel());
    const rest = element.getBoundingClientRect();
    const x = seen.left - rest.left;
    const y = seen.top - rest.top;
    drag.current = { startX: event.clientX - x, startY: event.clientY - y };
    setOffset({ x, y });
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag.current) return;
    setOffset({ x: event.clientX - drag.current.startX, y: event.clientY - drag.current.startY });
  }

  function onPointerUp() {
    if (!drag.current) return;
    const area = tile.current?.offsetParent?.getBoundingClientRect();
    const box = tile.current?.getBoundingClientRect();
    drag.current = null;
    releasedAt.current = box ?? null;
    setOffset(null);
    if (!area || !box) return;
    const top = box.top + box.height / 2 < area.top + area.height / 2;
    const left = box.left + box.width / 2 < area.left + area.width / 2;
    const next: Corner = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`;
    setCorner(next);
    saveCorner(next);
  }

  return (
    <div
      ref={tile}
      className="interviewer-tile"
      data-corner={corner}
      data-dragging={offset !== null}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      title="Drag to move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <PresenceDot state={presence} size="large" onNodEnd={onNodEnd} />
      <span className="interviewer-tile-label" data-testid="interviewer-state">
        {label}
      </span>
    </div>
  );
}
