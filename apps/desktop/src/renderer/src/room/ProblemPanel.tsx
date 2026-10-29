import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { marked } from 'marked';
import { IconButton, iconProps } from '../ui/IconButton.tsx';
import problemFile from '../../../../../../content/problems/two-sum.md?raw';

// The problem is our own bundled content file, not user input, so rendering its HTML is safe.
const problemHtml = marked.parse(problemFile, { async: false });

/** The round's problem, read from its plain content file. Can be hidden to give the editor room. */
export function ProblemPanel({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <section className="problem" aria-label="Problem" data-shown={shown}>
      <IconButton
        className="problem-toggle"
        label={shown ? 'Hide problem' : 'Show problem'}
        on={shown}
        swap={{ on: <PanelLeftClose {...iconProps} />, off: <PanelLeftOpen {...iconProps} /> }}
        onClick={onToggle}
      />
      {shown && <article className="problem-text" dangerouslySetInnerHTML={{ __html: problemHtml }} />}
    </section>
  );
}
