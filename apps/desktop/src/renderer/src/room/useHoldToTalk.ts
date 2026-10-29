import { useEffect, useState } from 'react';

/** Hold Space to talk. Ignored while typing in a text field or editor, so Space still types. */
export function useHoldToTalk(onStart: () => void, onEnd: () => void) {
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    let held = false;

    function down(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || held || isTyping(event.target)) return;
      event.preventDefault();
      held = true;
      setTalking(true);
      onStart();
    }

    function up(event: KeyboardEvent) {
      if (event.code !== 'Space' || !held) return;
      event.preventDefault();
      release();
    }

    // Losing focus mid-hold (alt-tab) would otherwise leave the candidate "talking" forever.
    function release() {
      if (!held) return;
      held = false;
      setTalking(false);
      onEnd();
    }

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [onStart, onEnd]);

  return talking;
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}
