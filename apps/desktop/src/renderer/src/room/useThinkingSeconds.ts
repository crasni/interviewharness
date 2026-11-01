import { useEffect, useState } from 'react';

/** Whole seconds since `thinking` turned true, like a chat app's "Thinking… 12s"; 0 while not thinking. */
export function useThinkingSeconds(thinking: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    if (!thinking) return;
    const since = performance.now();
    const id = setInterval(() => setSeconds(Math.floor((performance.now() - since) / 1000)), 250);
    return () => clearInterval(id);
  }, [thinking]);

  return seconds;
}
