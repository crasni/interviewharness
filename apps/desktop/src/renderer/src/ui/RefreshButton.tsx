import { RefreshCw } from 'lucide-react';
import { type ButtonHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react';
import './refresh-button.css';

/** Shortest time a refresh shows as working, so a fast one still reads as "it looked" rather than a flicker. */
const shortest = 600;

/**
 * Runs a refresh and says whether it's under way. It counts as working for at least `shortest` ms,
 * and a second press while it works is ignored.
 */
export function useRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    try {
      await Promise.all([refresh(), new Promise((resolve) => setTimeout(resolve, shortest))]);
    } finally {
      running.current = false;
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, run };
}

/**
 * "Refresh": its arrows turn while `refreshing`, and when it ends they finish the turn they're on and come
 * to rest, instead of snapping back. With reduced motion they don't turn; the words around it say what's happening.
 */
export function RefreshButton({ refreshing, ...rest }: { refreshing: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  // Turning outlasts `refreshing` until the turn in progress is done.
  const [turning, setTurning] = useState(refreshing);
  useEffect(() => {
    if (refreshing) setTurning(true);
  }, [refreshing]);

  return (
    <button type="button" className="with-icon refresh-button" aria-busy={refreshing} data-turning={turning} {...rest}>
      <RefreshCw
        size={14}
        strokeWidth={1.75}
        aria-hidden
        onAnimationIteration={() => !refreshing && setTurning(false)}
        onAnimationEnd={() => setTurning(false)}
      />
      Refresh
    </button>
  );
}
