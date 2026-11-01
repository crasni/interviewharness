import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { marked } from 'marked';
import { useMemo } from 'react';
import { IconButton, iconProps } from '../ui/IconButton.tsx';

/** The round's problem statement, from its plain content file. Can be hidden to give the editor room. */
export function ProblemPanel({ statement, shown, onToggle }: { statement: string; shown: boolean; onToggle: () => void }) {
  // The statement is our own bundled content file, sent by main, not user input, so rendering its HTML is safe.
  const problemHtml = useMemo(() => marked.parse(statement, { async: false }), [statement]);
  return (
    <section className="problem" aria-label="Problem" data-shown={shown}>
      <IconButton
        className="problem-toggle"
        label={shown ? 'Hide problem' : 'Show problem'}
        on={shown}
        tip="below-start"
        motion={shown ? 'slide-left' : 'slide-right'}
        swap={{ on: <PanelLeftClose {...iconProps} />, off: <PanelLeftOpen {...iconProps} /> }}
        onClick={onToggle}
      />
      {shown && <article className="problem-text" dangerouslySetInnerHTML={{ __html: problemHtml }} />}
    </section>
  );
}
