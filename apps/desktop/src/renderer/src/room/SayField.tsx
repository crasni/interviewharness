import { useState } from 'react';

/** Where the candidate types what they said. Enter ends their turn. */
export function SayField({ onSay }: { onSay: (text: string) => void }) {
  const [text, setText] = useState('');

  return (
    <form
      className="say"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        onSay(text.trim());
        setText('');
      }}
    >
      <input
        className="say-input"
        aria-label="What you said"
        placeholder="Type what you said, then Enter"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </form>
  );
}
