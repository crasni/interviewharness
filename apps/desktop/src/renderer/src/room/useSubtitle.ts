import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a finished line stays readable before it fades. */
const fadeAfter = 4_000;

/** The interviewer's current line: shown at once, faded a while after the interviewer finishes it. */
export function useSubtitle() {
  const [text, setText] = useState('');
  const [faded, setFaded] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const show = useCallback((line: string) => {
    clearTimeout(fadeTimer.current);
    setText(line);
    setFaded(false);
  }, []);

  const finish = useCallback(() => {
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setFaded(true), fadeAfter);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(fadeTimer.current);
    setText('');
    setFaded(false);
  }, []);

  return { text, faded, show, finish, clear };
}
