import { useState } from 'react';

/** Click to talk, click again to stop. Leaves the keyboard to the editor and the text field. */
export function useTalking(onStart: () => void, onEnd: () => void) {
  const [talking, setTalking] = useState(false);

  function toggle() {
    if (talking) onEnd();
    else onStart();
    setTalking(!talking);
  }

  return { talking, toggle };
}
