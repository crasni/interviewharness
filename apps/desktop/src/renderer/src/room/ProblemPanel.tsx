import { marked } from 'marked';
import { useState } from 'react';
import problemFile from '../../../../../../content/problems/longest-calm-stretch.md?raw';

// The problem is our own bundled content file, not user input, so rendering its HTML is safe.
const problemHtml = marked.parse(problemFile, { async: false });

/** The round's problem, read from its plain content file. Can be hidden to give the editor room. */
export function ProblemPanel() {
  const [shown, setShown] = useState(true);

  return (
    <section className="problem" aria-label="Problem" data-shown={shown}>
      <button type="button" className="problem-toggle" onClick={() => setShown(!shown)}>
        {shown ? 'Hide problem' : 'Show problem'}
      </button>
      {shown && <article className="problem-text" dangerouslySetInnerHTML={{ __html: problemHtml }} />}
    </section>
  );
}
