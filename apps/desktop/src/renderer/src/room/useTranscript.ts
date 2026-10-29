import { useCallback, useState } from 'react';

export interface TranscriptEntry {
  who: 'interviewer' | 'candidate';
  text: string;
  /** The candidate talked over this line, so it was not said in full. */
  cutOff?: boolean;
}

/** Everything said in the round: the interviewer's spoken lines and the candidate's words. */
export function useTranscript() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);

  const add = useCallback((who: TranscriptEntry['who'], text: string) => {
    setEntries((all) => [...all, { who, text }]);
  }, []);

  /** Marks the interviewer's latest line as cut off by a barge-in. */
  const markCutOff = useCallback(() => {
    setEntries((all) => {
      const last = all.findLastIndex((entry) => entry.who === 'interviewer');
      return last === -1 ? all : all.map((entry, i) => (i === last ? { ...entry, cutOff: true } : entry));
    });
  }, []);

  return { entries, add, markCutOff };
}
