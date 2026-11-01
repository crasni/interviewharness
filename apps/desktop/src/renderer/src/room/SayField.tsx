import { useState } from 'react';

/**
 * Where the candidate types what they said. It grows with the text, up to a few lines, then scrolls.
 * Enter ends their turn; Shift+Enter starts a new line.
 */
export function SayField({ onSay }: { onSay: (text: string) => void }) {
  const [text, setText] = useState('');

  function send() {
    if (!text.trim()) return;
    onSay(text.trim());
    setText('');
  }

  return (
    <form
      className="say"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <textarea
        className="say-input"
        aria-label="What you said"
        placeholder="Type what you said, then Enter"
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter mid-composition (Chinese, Japanese input) picks a word; it doesn't send.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          send();
        }}
      />
    </form>
  );
}
