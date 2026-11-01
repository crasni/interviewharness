import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProblemChoice } from '../../../shared/api.ts';
import { iconProps } from '../ui/IconButton.tsx';

const difficultyLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** "Done once", "Done twice", "Done 3 times"; nothing for a problem never done. */
function doneLabel(times: number) {
  if (times === 0) return null;
  return times === 1 ? 'Done once' : times === 2 ? 'Done twice' : `Done ${times} times`;
}

/** Every problem, by title and difficulty: picking one starts a coding round on it. */
export function ProblemList({ onPick, onBack }: { onPick: (problem: string) => void; onBack: () => void }) {
  const [problems, setProblems] = useState<ProblemChoice[] | null>(null);
  useEffect(() => {
    void window.harness.problems().then(setProblems);
  }, []);

  return (
    <section className="problem-list" aria-label="Choose a problem">
      <header className="problem-list-head">
        <button type="button" className="with-icon" data-motion="nudge" onClick={onBack} autoFocus>
          <ArrowLeft {...iconProps} size={16} />
          Back
        </button>
        <h2 className="problem-list-title">Choose a problem</h2>
      </header>
      <ul className="problem-list-rows">
        {problems?.map(({ name, title, difficulty, timesDone }) => (
          <li key={name}>
            <button type="button" onClick={() => onPick(name)}>
              <span className="problem-list-name">{title}</span>
              <span className="problem-list-done">{doneLabel(timesDone)}</span>
              <span className="problem-list-difficulty">{difficultyLabels[difficulty]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
