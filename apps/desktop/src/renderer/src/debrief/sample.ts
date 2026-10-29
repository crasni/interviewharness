import type { Verdict } from '@interviewharness/core';

export interface FeedbackPoint {
  /** When in the round it happened, as time since the round started. */
  atMs: number;
  text: string;
}

export interface Feedback {
  verdict: Verdict;
  why: string;
  wentWell: FeedbackPoint[];
  toFix: FeedbackPoint[];
}

/**
 * Sample feedback, so the debrief's layout can be judged before real grading exists.
 * From v0.1 the AI interviewer writes this from the round's transcript and code.
 */
export const sampleFeedback: Feedback = {
  verdict: 'Lean hire',
  why: 'Clear communication and the right hash-map idea, but the code was finished late and only tested on the happy path. With edge cases covered, this would be a hire.',
  wentWell: [
    { atMs: (2 * 60 + 10) * 1000, text: 'Asked whether numbers can be negative and whether the same value can appear twice before designing anything.' },
    { atMs: (9 * 60 + 45) * 1000, text: 'Explained why checking every pair is O(n²) and moved to a hash map of seen values unprompted.' },
    { atMs: (21 * 60 + 30) * 1000, text: 'Kept talking while coding, so the interviewer never had to guess what the code was meant to do.' },
  ],
  toFix: [
    { atMs: (18 * 60 + 5) * 1000, text: 'Stored every value before looking any up, so a value paired with itself (6 + 6 for target 12) gave the same position twice.' },
    { atMs: (31 * 60 + 20) * 1000, text: 'Tested only the first example. A list with a repeated value, like [5, 1, 5], would have caught the reused position.' },
  ],
};
