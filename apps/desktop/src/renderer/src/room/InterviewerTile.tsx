import { type PointerEvent, useRef, useState } from 'react';
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
 * Drag it anywhere; when let go it settles in the nearest corner of the work area.
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

  function onPointerDown(event: PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY };
    setOffset({ x: 0, y: 0 });
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag.current) return;
    setOffset({ x: event.clientX - drag.current.startX, y: event.clientY - drag.current.startY });
  }

  function onPointerUp() {
    const area = tile.current?.offsetParent?.getBoundingClientRect();
    const box = tile.current?.getBoundingClientRect();
    drag.current = null;
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
