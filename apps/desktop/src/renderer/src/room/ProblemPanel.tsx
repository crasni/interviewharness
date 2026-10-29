import { marked } from 'marked';
import problemFile from '../../../../../../content/problems/two-sum.md?raw';

// The problem is our own bundled content file, not user input, so rendering its HTML is safe.
const problemHtml = marked.parse(problemFile, { async: false });

/** The round's problem, read from its plain content file. Can be hidden to give the editor room. */
export function ProblemPanel({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <section className="problem" aria-label="Problem" data-shown={shown}>
      <button type="button" className="problem-toggle" onClick={onToggle}>
        {shown ? 'Hide problem' : 'Show problem'}
      </button>
      {shown && <article className="problem-text" dangerouslySetInnerHTML={{ __html: problemHtml }} />}
    </section>
  );
}
